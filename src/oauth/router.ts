import { Router, type Response } from "express";
import crypto from "node:crypto";
import axios from "axios";
import { API_DOMAINS } from "@/config";
import {
  registerClient,
  getClient,
  storeAuthCode,
  consumeAuthCode,
  issueTokens,
  rotateTokens,
  revokeToken,
  createPendingAuth,
  getPendingAuth,
  markConsented,
  consumePendingAuth,
  deletePendingAuth,
} from "./store";
import { verifyS256, redirectUriMatches } from "./pkce";
import { ALL_SCOPES, formatScope, parseScope } from "./scopes";
import { consentPage, errorPage, loginPage } from "./pages";
import { connectionsBySessionId, closeSessionsForAccessToken } from "@/mcp/connections";

export const oauthRouter = Router();

const issuer = (): string =>
  process.env.OAUTH_ISSUER ?? `http://localhost:${process.env.APP_PORT ?? "3000"}`;

const EXPIRED_TXN = "This authorization request has expired or was already used. Please start again from your application.";

// ─── RFC 9728: Protected Resource Metadata ───────────────────────────────────
oauthRouter.get("/.well-known/oauth-protected-resource", (_req, res) => {
  const base = issuer();
  res.json({
    resource: base,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ALL_SCOPES,
  });
});

// ─── RFC 8414: Authorization Server Metadata ─────────────────────────────────
oauthRouter.get("/.well-known/oauth-authorization-server", (_req, res) => {
  const base = issuer();
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    revocation_endpoint_auth_methods_supported: ["none"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: ALL_SCOPES,
    client_id_metadata_document_supported: true,
  });
});

// ─── RFC 7591: Dynamic Client Registration ────────────────────────────────────
// Handle both /oauth/register and the bare /register fallback used by some clients
// when auth server metadata discovery fails (e.g. ngrok interstitial blocking discovery).
oauthRouter.post(["/oauth/register", "/register"], async (req, res) => {
  const { redirect_uris, grant_types, token_endpoint_auth_method, client_name, client_uri } = req.body as {
    redirect_uris?: string[];
    grant_types?: string[];
    token_endpoint_auth_method?: string;
    client_name?: string;
    client_uri?: string;
  };

  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    res.status(400).json({
      error: "invalid_client_metadata",
      error_description: "redirect_uris is required",
    });
    return;
  }

  const client = await registerClient({
    redirectUris: redirect_uris,
    grantTypes: grant_types ?? ["authorization_code", "refresh_token"],
    tokenEndpointAuthMethod: token_endpoint_auth_method ?? "none",
    // Shown verbatim on the consent page (escaped there); cap so it can't be a wall of text.
    clientName: typeof client_name === "string" ? client_name.trim().slice(0, 100) || undefined : undefined,
    clientUri: typeof client_uri === "string" ? client_uri.slice(0, 500) : undefined,
  });

  res.status(201).json({
    client_id: client.clientId,
    redirect_uris: client.redirectUris,
    grant_types: client.grantTypes,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    ...(client.clientName && { client_name: client.clientName }),
    ...(client.clientUri && { client_uri: client.clientUri }),
    client_id_issued_at: Math.floor(client.createdAt / 1000),
  });
});

// ─── Client resolution: DCR record or CIMD document ──────────────────────────
interface ResolvedClient {
  redirectUris: string[];
  /** What the seller sees on the consent page. */
  name: string;
}

async function resolveClient(clientId: string): Promise<ResolvedClient | null> {
  const registered = await getClient(clientId);
  if (registered) {
    return { redirectUris: registered.redirectUris, name: registered.clientName ?? "An unnamed application" };
  }

  // CIMD: client_id is an HTTPS URL — fetch and trust the metadata document
  try {
    const url = new URL(clientId);
    if (url.protocol !== "https:") return null;

    const { data } = await axios.get<{ redirect_uris?: string[]; client_name?: string }>(clientId, {
      headers: { Accept: "application/json" },
      timeout: 5000,
    });

    if (!Array.isArray(data.redirect_uris)) return null;
    return {
      redirectUris: data.redirect_uris,
      name: typeof data.client_name === "string" && data.client_name.trim() ? data.client_name.trim().slice(0, 100) : url.host,
    };
  } catch {
    return null;
  }
}

/** RFC 6749 §4.1.2.1 error return — only ever called with an already-validated redirect_uri. */
function redirectWithError(res: Response, redirectUri: string, error: string, description: string, state: string): void {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  res.redirect(302, url.toString());
}

// ─── Step 1: Authorization request → consent page ────────────────────────────
// Validation failures render a 400 page and never redirect; otherwise this
// endpoint would be an open redirector.
oauthRouter.get(["/oauth/authorize", "/authorize"], async (req, res) => {
  const {
    client_id = "",
    redirect_uri = "",
    response_type,
    state = "",
    code_challenge = "",
    code_challenge_method = "S256",
    scope,
    resource = "",
  } = req.query as Record<string, string | undefined>;

  if (response_type !== "code") {
    res.status(400).send(errorPage("Unsupported response_type. Only 'code' is supported."));
    return;
  }

  if (!redirect_uri) {
    res.status(400).send(errorPage("Missing redirect_uri parameter."));
    return;
  }

  const client = await resolveClient(client_id);
  if (client === null) {
    res.status(400).send(errorPage("Unknown client. Register via /oauth/register or use an HTTPS client_id URL."));
    return;
  }
  if (!client.redirectUris.some((uri) => redirectUriMatches(uri, redirect_uri))) {
    res.status(400).send(errorPage("redirect_uri not registered for this client."));
    return;
  }

  if (!code_challenge) {
    res.status(400).send(errorPage("PKCE code_challenge is required."));
    return;
  }

  // From here on redirect_uri is trusted, so protocol errors go back to the client.
  const { scopes, unknown } = parseScope(scope);
  if (unknown.length > 0) {
    redirectWithError(res, redirect_uri, "invalid_scope", `Unknown scope: ${unknown.join(" ")}`, state);
    return;
  }

  const txn = await createPendingAuth({
    clientId: client_id,
    clientName: client.name,
    redirectUri: redirect_uri,
    state,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method,
    scope: formatScope(scopes),
    resource,
  });

  res.send(consentPage({ txn, clientName: client.name, redirectHost: new URL(redirect_uri).host, scopes }));
});

// ─── Step 2: Consent decision → login page (allow) or error return (deny) ────
oauthRouter.post(["/oauth/consent", "/consent"], async (req, res) => {
  const { txn = "", decision = "" } = req.body as Record<string, string | undefined>;

  const pending = await getPendingAuth(txn);
  if (!pending) {
    res.status(400).send(errorPage(EXPIRED_TXN));
    return;
  }

  if (decision !== "allow") {
    await deletePendingAuth(txn);
    redirectWithError(res, pending.redirectUri, "access_denied", "The seller declined the request.", pending.state);
    return;
  }

  await markConsented(txn);
  res.send(loginPage({ txn, clientName: pending.clientName }));
});

// ─── Step 3: Login → authorization code ──────────────────────────────────────
// Reads only the credentials and the txn from the form; every OAuth parameter
// comes from the server-side record, so a tampered form cannot change where
// the code is delivered.
oauthRouter.post(["/oauth/authorize", "/authorize"], async (req, res) => {
  const { email, password, txn = "" } = req.body as Record<string, string | undefined>;

  const pending = await getPendingAuth(txn);
  if (!pending || !pending.consented) {
    res.status(400).send(errorPage(EXPIRED_TXN));
    return;
  }

  // Authenticate with Shiprocket. Credentials are forwarded once and dropped.
  let shiprocketToken: string;
  try {
    const { data } = await axios.post(
      `${API_DOMAINS.SHIPROCKET}/v1/external/auth/login`,
      { email, password }
    );
    shiprocketToken = data.token as string;
  } catch {
    res.status(401).send(
      loginPage({ txn, clientName: pending.clientName }, "Invalid email or password. Please try again.")
    );
    return;
  }

  // Take the txn atomically so one authorization yields at most one code.
  const taken = await consumePendingAuth(txn);
  if (!taken) {
    res.status(400).send(errorPage(EXPIRED_TXN));
    return;
  }

  const code = crypto.randomBytes(24).toString("hex");
  await storeAuthCode(code, {
    clientId: taken.clientId,
    redirectUri: taken.redirectUri,
    shiprocketToken,
    codeChallenge: taken.codeChallenge,
    codeChallengeMethod: taken.codeChallengeMethod,
    scope: taken.scope,
    resource: taken.resource,
  });

  const redirectUrl = new URL(taken.redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (taken.state) redirectUrl.searchParams.set("state", taken.state);

  res.redirect(302, redirectUrl.toString());
});

// ─── Token endpoint — authorization_code + refresh_token grants ──────────────
oauthRouter.post(["/oauth/token", "/token"], async (req, res) => {
  const { grant_type, code, redirect_uri, code_verifier, refresh_token } =
    req.body as Record<string, string>;

  // ── Authorization Code ────────────────────────────────────────────────────
  if (grant_type === "authorization_code") {
    if (!code) {
      res.status(400).json({ error: "invalid_request", error_description: "code is required" });
      return;
    }

    const authCode = await consumeAuthCode(code);
    if (!authCode) {
      res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" });
      return;
    }

    if (authCode.redirectUri !== redirect_uri) {
      res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
      return;
    }

    if (!code_verifier) {
      res.status(400).json({ error: "invalid_request", error_description: "code_verifier is required" });
      return;
    }

    if (!verifyS256(code_verifier, authCode.codeChallenge)) {
      res.status(400).json({ error: "invalid_grant", error_description: "code_verifier does not match code_challenge" });
      return;
    }

    const { accessToken, refreshToken } = await issueTokens({
      clientId: authCode.clientId,
      shiprocketToken: authCode.shiprocketToken,
      scope: authCode.scope,
      resource: authCode.resource,
    });

    res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.scope,
      ...(authCode.resource && { aud: authCode.resource }),
    });
    return;
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────
  if (grant_type === "refresh_token") {
    if (!refresh_token) {
      res.status(400).json({ error: "invalid_request", error_description: "refresh_token is required" });
      return;
    }

    const result = await rotateTokens(refresh_token);
    if (!result) {
      res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired refresh token" });
      return;
    }

    // Keep session map in sync — session.accessToken goes stale after rotation
    for (const sessionId of Object.keys(connectionsBySessionId)) {
      if (connectionsBySessionId[sessionId].accessToken === result.oldAccessToken) {
        connectionsBySessionId[sessionId].accessToken = result.accessToken;
      }
    }

    res.json({
      access_token: result.accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: result.refreshToken,
      scope: result.data.scope,
      ...(result.data.resource && { aud: result.data.resource }),
    });
    return;
  }

  res.status(400).json({ error: "unsupported_grant_type" });
});

// ─── RFC 7009: Token Revocation ───────────────────────────────────────────────
// Public clients (auth method "none") may revoke any token they hold. The
// token is opaque, so the store works out whether it is an access or refresh
// token; the optional hint only short-circuits that lookup. Per the RFC an
// unknown or already-revoked token is still a 200 — the caller learns nothing.
oauthRouter.post(["/oauth/revoke", "/revoke"], async (req, res) => {
  const { token, token_type_hint } = req.body as Record<string, string | undefined>;

  if (!token) {
    res.status(400).json({ error: "invalid_request", error_description: "token is required" });
    return;
  }

  const { accessTokens } = await revokeToken(token, token_type_hint);
  for (const accessToken of accessTokens) {
    await closeSessionsForAccessToken(accessToken);
  }

  res.status(200).json({});
});
