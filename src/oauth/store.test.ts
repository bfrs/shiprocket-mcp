import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeAuthCode,
  consumePendingAuth,
  createPendingAuth,
  deletePendingAuth,
  deserializeRecord,
  getPendingAuth,
  markConsented,
  getAccessTokenData,
  issueTokens,
  registerClient,
  getClient,
  revokeAccessToken,
  revokeRefreshToken,
  revokeToken,
  rotateTokens,
  serializeRecord,
  storeAuthCode,
} from "./store";

// REDIS_HOST is blanked in vitest.config.ts, so this exercises the in-memory
// backend. The Redis backend shares every line above the KV interface.

const SELLER_JWT = "eyJhbGciOiJIUzI1NiJ9.seller.signature";
const session = { clientId: "sr_client_test", shiprocketToken: SELLER_JWT, scope: "mcp" };
const codeData = {
  ...session,
  redirectUri: "https://client.example/cb",
  codeChallenge: "challenge",
  codeChallengeMethod: "S256",
};

describe("encryption boundary", () => {
  it("serialized records never contain the plaintext seller token", () => {
    const raw = serializeRecord(session);
    expect(raw).not.toContain(SELLER_JWT);
    expect(JSON.parse(raw).shiprocketToken).toMatch(/^v1\./);
    expect(deserializeRecord<typeof session>(raw)?.shiprocketToken).toBe(SELLER_JWT);
  });

  it("treats a legacy plaintext record as invalid instead of throwing", () => {
    expect(deserializeRecord(JSON.stringify(session))).toBeUndefined();
    expect(deserializeRecord("not json")).toBeUndefined();
  });
});

describe("clients", () => {
  it("registers and reads back a client", async () => {
    const client = await registerClient({
      redirectUris: ["https://client.example/cb"],
      grantTypes: ["authorization_code"],
      tokenEndpointAuthMethod: "none",
    });
    expect(client.clientId).toMatch(/^sr_client_/);
    expect(await getClient(client.clientId)).toEqual(client);
    expect(await getClient("sr_client_missing")).toBeUndefined();
  });
});

describe("pending authorizations", () => {
  afterEach(() => vi.useRealTimers());

  const pending = {
    clientId: "sr_client_test",
    clientName: "Claude",
    redirectUri: "https://claude.ai/cb",
    state: "st",
    codeChallenge: "challenge",
    codeChallengeMethod: "S256",
    scope: "seller:read",
  };

  it("starts un-consented and records Allow", async () => {
    const txn = await createPendingAuth(pending);
    expect(txn).toMatch(/^txn_[0-9a-f]{48}$/);
    expect((await getPendingAuth(txn))?.consented).toBe(false);
    expect((await markConsented(txn))?.consented).toBe(true);
    expect((await getPendingAuth(txn))?.consented).toBe(true);
  });

  it("can be consumed exactly once", async () => {
    const txn = await createPendingAuth(pending);
    expect((await consumePendingAuth(txn))?.clientName).toBe("Claude");
    expect(await consumePendingAuth(txn)).toBeUndefined();
    expect(await markConsented(txn)).toBeUndefined();
  });

  it("expires after 10 minutes", async () => {
    vi.useFakeTimers();
    const txn = await createPendingAuth(pending);
    vi.advanceTimersByTime(10 * 60_000 + 1);
    expect(await getPendingAuth(txn)).toBeUndefined();
  });

  it("can be discarded on Deny", async () => {
    const txn = await createPendingAuth(pending);
    await deletePendingAuth(txn);
    expect(await getPendingAuth(txn)).toBeUndefined();
  });
});

describe("auth codes", () => {
  afterEach(() => vi.useRealTimers());

  it("can be consumed exactly once", async () => {
    await storeAuthCode("code-1", codeData);
    const first = await consumeAuthCode("code-1");
    expect(first?.shiprocketToken).toBe(SELLER_JWT);
    expect(await consumeAuthCode("code-1")).toBeUndefined();
  });

  it("expire after 60 seconds", async () => {
    vi.useFakeTimers();
    await storeAuthCode("code-2", codeData);
    vi.advanceTimersByTime(61_000);
    expect(await consumeAuthCode("code-2")).toBeUndefined();
  });
});

describe("tokens", () => {
  it("issues a pair whose access token resolves to the decrypted seller token", async () => {
    const { accessToken, refreshToken } = await issueTokens(session);
    expect(accessToken).toMatch(/^mcp_/);
    expect(refreshToken).toMatch(/^mcp_r_/);
    expect((await getAccessTokenData(accessToken))?.shiprocketToken).toBe(SELLER_JWT);
  });

  it("rotates: new pair works, old pair is dead, replay fails", async () => {
    const old = await issueTokens(session);
    const rotated = await rotateTokens(old.refreshToken);
    expect(rotated?.data.shiprocketToken).toBe(SELLER_JWT);
    expect(rotated?.oldAccessToken).toBe(old.accessToken);
    expect(await getAccessTokenData(old.accessToken)).toBeUndefined();
    expect(await getAccessTokenData(rotated!.accessToken)).toBeDefined();
    expect(await rotateTokens(old.refreshToken)).toBeUndefined();
  });

  it("revokeAccessToken removes the access token and its paired refresh token", async () => {
    const t = await issueTokens(session);
    await revokeAccessToken(t.accessToken);
    expect(await getAccessTokenData(t.accessToken)).toBeUndefined();
    expect(await rotateTokens(t.refreshToken)).toBeUndefined();
  });

  it("revokeRefreshToken removes the refresh token and returns the paired access token", async () => {
    const t = await issueTokens(session);
    expect(await revokeRefreshToken(t.refreshToken)).toBe(t.accessToken);
    expect(await getAccessTokenData(t.accessToken)).toBeUndefined();
    expect(await revokeRefreshToken(t.refreshToken)).toBeUndefined();
  });

  it("revokeToken works out the token type and reports the dead access tokens", async () => {
    const a = await issueTokens(session);
    expect(await revokeToken(a.accessToken)).toEqual({ accessTokens: [a.accessToken] });
    expect(await getAccessTokenData(a.accessToken)).toBeUndefined();

    const b = await issueTokens(session);
    expect(await revokeToken(b.refreshToken, "refresh_token")).toEqual({ accessTokens: [b.accessToken] });
    expect(await getAccessTokenData(b.accessToken)).toBeUndefined();

    await expect(revokeToken("mcp_unknown")).resolves.toEqual({ accessTokens: [] });
  });
});
