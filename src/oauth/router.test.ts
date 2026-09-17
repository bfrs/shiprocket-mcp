import axios from "axios";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { oauthRouter } from "./router";
import { consumeAuthCode, getAccessTokenData, issueTokens, rotateTokens } from "./store";
import { connectionsBySessionId } from "@/mcp/connections";

const session = { clientId: "sr_client_test", shiprocketToken: "seller.jwt", scope: "mcp" };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(oauthRouter);
  return app;
}

const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const strip = (html: string) =>
  html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const txnOf = (html: string) => html.match(/name="txn" value="([^"]+)"/)![1];
const hiddenFields = (html: string) => [...html.matchAll(/type="hidden" name="(\w+)"/g)].map((m) => m[1]);

async function registerClient(app: express.Express, clientName?: string): Promise<string> {
  const res = await request(app)
    .post("/oauth/register")
    .send({ redirect_uris: [REDIRECT], ...(clientName && { client_name: clientName }) });
  expect(res.status).toBe(201);
  return res.body.client_id as string;
}

function authorizeQuery(clientId: string, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: "challenge",
    code_challenge_method: "S256",
    state: "st1",
    ...extra,
  });
  return `/oauth/authorize?${q}`;
}

describe("AS metadata", () => {
  it("advertises the revocation endpoint for public clients", async () => {
    const res = await request(buildApp()).get("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);
    expect(res.body.revocation_endpoint).toBe(`${res.body.issuer}/oauth/revoke`);
    expect(res.body.revocation_endpoint_auth_methods_supported).toEqual(["none"]);
  });

  it("advertises the scope vocabulary on both discovery documents", async () => {
    const app = buildApp();
    const as = await request(app).get("/.well-known/oauth-authorization-server");
    const prm = await request(app).get("/.well-known/oauth-protected-resource");
    expect(as.body.scopes_supported).toEqual(["seller:read", "seller:write"]);
    expect(prm.body.scopes_supported).toEqual(["seller:read", "seller:write"]);
  });
});

describe("consent → login flow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the consent page naming the client, its redirect host and the requested scopes", async () => {
    const app = buildApp();
    const clientId = await registerClient(app, "Claude");
    const res = await request(app).get(authorizeQuery(clientId, { scope: "seller:read seller:write" }));

    expect(res.status).toBe(200);
    const text = strip(res.text);
    expect(text).toContain("Authorize Claude");
    expect(text).toContain("claude.ai");
    expect(text).toContain("View orders, tracking");
    expect(text).toContain("Create, ship and cancel");
    expect(hiddenFields(res.text)).toEqual(["txn"]);
  });

  it("only offers seller:read when the client requests no scope", async () => {
    const app = buildApp();
    const res = await request(app).get(authorizeQuery(await registerClient(app, "Claude")));
    expect(res.text).toContain("View orders, tracking");
    expect(res.text).not.toContain("Create, ship and cancel");
  });

  it("escapes a hostile client_name on the consent page", async () => {
    const app = buildApp();
    const res = await request(app).get(authorizeQuery(await registerClient(app, "<script>alert(1)</script>")));
    expect(res.text).not.toContain("<script>alert(1)</script>");
    expect(res.text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("returns invalid_scope to the validated redirect_uri for an unknown scope", async () => {
    const app = buildApp();
    const res = await request(app).get(authorizeQuery(await registerClient(app), { scope: "seller:read bogus" }));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location);
    expect(loc.origin + loc.pathname).toBe(REDIRECT);
    expect(loc.searchParams.get("error")).toBe("invalid_scope");
    expect(loc.searchParams.get("state")).toBe("st1");
  });

  it("still renders a 400 page, never a redirect, for an unknown client or redirect_uri", async () => {
    const app = buildApp();
    const unknownClient = await request(app).get(authorizeQuery("sr_client_nope"));
    expect(unknownClient.status).toBe(400);
    expect(unknownClient.headers.location).toBeUndefined();

    const badRedirect = await request(app).get(authorizeQuery(await registerClient(app), { redirect_uri: "https://evil.example/cb" }));
    expect(badRedirect.status).toBe(400);
    expect(badRedirect.headers.location).toBeUndefined();
  });

  it("Deny sends access_denied back to the client and discards the txn", async () => {
    const app = buildApp();
    const consent = await request(app).get(authorizeQuery(await registerClient(app)));
    const txn = txnOf(consent.text);

    const res = await request(app).post("/oauth/consent").type("form").send({ txn, decision: "deny" });
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location);
    expect(loc.searchParams.get("error")).toBe("access_denied");
    expect(loc.searchParams.get("state")).toBe("st1");

    const reuse = await request(app).post("/oauth/consent").type("form").send({ txn, decision: "allow" });
    expect(reuse.status).toBe(400);
  });

  it("refuses login before consent was given", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("must not be called"));
    const app = buildApp();
    const consent = await request(app).get(authorizeQuery(await registerClient(app)));
    const res = await request(app)
      .post("/oauth/authorize")
      .type("form")
      .send({ txn: txnOf(consent.text), email: "s@example.com", password: "pw" });
    expect(res.status).toBe(400);
    expect(axios.post).not.toHaveBeenCalledWith(expect.stringContaining("/auth/login"), expect.anything());
  });

  it("Allow → login page carrying only the txn; wrong password re-renders it generically", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("401"));
    const app = buildApp();
    const consent = await request(app).get(authorizeQuery(await registerClient(app, "Claude")));
    const txn = txnOf(consent.text);

    const login = await request(app).post("/oauth/consent").type("form").send({ txn, decision: "allow" });
    expect(login.status).toBe(200);
    expect(strip(login.text)).toContain("Sign in to Shiprocket");
    expect(strip(login.text)).toContain("Claude");
    expect(hiddenFields(login.text)).toEqual(["txn"]);

    const bad = await request(app).post("/oauth/authorize").type("form").send({ txn, email: "s@example.com", password: "wrong" });
    expect(bad.status).toBe(401);
    expect(strip(bad.text)).toContain("Invalid email or password");
    expect(bad.text).not.toContain("wrong");
  });

  it("successful login issues a code to the stored redirect_uri, ignoring forged form fields, once", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { token: "seller.jwt.from.mock" } });
    const app = buildApp();
    const consent = await request(app).get(authorizeQuery(await registerClient(app), { scope: "seller:read seller:write" }));
    const txn = txnOf(consent.text);
    await request(app).post("/oauth/consent").type("form").send({ txn, decision: "allow" });

    const res = await request(app)
      .post("/oauth/authorize")
      .type("form")
      .send({ txn, email: "s@example.com", password: "right", redirect_uri: "https://evil.example/steal", client_id: "x", scope: "seller:write" });

    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location);
    expect(loc.origin + loc.pathname).toBe(REDIRECT);
    expect(loc.searchParams.get("state")).toBe("st1");
    const stored = await consumeAuthCode(loc.searchParams.get("code")!);
    expect(stored?.scope).toBe("seller:read seller:write");
    expect(stored?.shiprocketToken).toBe("seller.jwt.from.mock");
    expect(stored?.redirectUri).toBe(REDIRECT);

    const replay = await request(app).post("/oauth/authorize").type("form").send({ txn, email: "s@example.com", password: "right" });
    expect(replay.status).toBe(400);
  });

  it("token exchange returns the granted scope — seller:read when none was requested", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { token: "seller.jwt" } });
    const app = buildApp();
    const verifier = "verifier-verifier-verifier-verifier-verifier";
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const consent = await request(app).get(authorizeQuery(await registerClient(app), { code_challenge: challenge }));
    const txn = txnOf(consent.text);
    await request(app).post("/oauth/consent").type("form").send({ txn, decision: "allow" });
    const login = await request(app).post("/oauth/authorize").type("form").send({ txn, email: "s@example.com", password: "pw" });
    const code = new URL(login.headers.location).searchParams.get("code")!;

    const token = await request(app)
      .post("/oauth/token")
      .type("form")
      .send({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier });

    expect(token.status).toBe(200);
    expect(token.body.scope).toBe("seller:read");
    expect((await getAccessTokenData(token.body.access_token))?.scope).toBe("seller:read");
  });
});

describe("POST /oauth/revoke", () => {
  beforeEach(() => {
    for (const id of Object.keys(connectionsBySessionId)) delete connectionsBySessionId[id];
  });

  it("rejects a request without a token", async () => {
    const res = await request(buildApp()).post("/oauth/revoke").type("form").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_request");
  });

  it("revokes an access token, its refresh token, and closes the live session", async () => {
    const { accessToken, refreshToken } = await issueTokens(session);
    let closed = false;
    connectionsBySessionId["sess-1"] = {
      transport: { close: async () => { closed = true; } } as never,
      sellerToken: "seller.jwt",
      accessToken,
    };

    const res = await request(buildApp()).post("/oauth/revoke").type("form").send({ token: accessToken });

    expect(res.status).toBe(200);
    expect(await getAccessTokenData(accessToken)).toBeUndefined();
    expect(await rotateTokens(refreshToken)).toBeUndefined();
    expect(closed).toBe(true);
    expect(connectionsBySessionId["sess-1"]).toBeUndefined();
  });

  it("revokes by refresh token with a hint, via the bare /revoke alias", async () => {
    const { accessToken, refreshToken } = await issueTokens(session);
    const res = await request(buildApp())
      .post("/revoke")
      .type("form")
      .send({ token: refreshToken, token_type_hint: "refresh_token" });

    expect(res.status).toBe(200);
    expect(await getAccessTokenData(accessToken)).toBeUndefined();
  });

  it("answers 200 for an unknown token so it cannot be used as an oracle", async () => {
    const res = await request(buildApp()).post("/oauth/revoke").type("form").send({ token: "mcp_nope" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });
});
