import crypto from "node:crypto";
import Redis from "ioredis";
import { decryptSecret, encryptSecret } from "./crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Client {
  clientId: string;
  redirectUris: string[];
  grantTypes: string[];
  tokenEndpointAuthMethod: string;
  createdAt: number;
  /** RFC 7591 `client_name` — shown to the seller on the consent page. */
  clientName?: string;
  /** RFC 7591 `client_uri` — the app's homepage, if it declared one. */
  clientUri?: string;
}

/**
 * One in-flight authorization between GET /oauth/authorize and the code
 * being issued. Holds every OAuth parameter server-side so the consent and
 * login forms only ever carry an opaque `txn`. Never holds a seller token.
 */
export interface PendingAuth {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  resource?: string;
  /** Set when the seller clicked Allow; login is refused until then. */
  consented: boolean;
}

interface AuthCode {
  clientId: string;
  redirectUri: string;
  shiprocketToken: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  resource?: string;
  expiresAt: number;
}

export interface AccessTokenData {
  clientId: string;
  shiprocketToken: string;
  scope: string;
  resource?: string;
  expiresAt: number;
}

// Refresh tokens carry the session data themselves so rotation never depends
// on the (much shorter-lived) access token record still being in the store.
interface RefreshTokenData {
  linkedAccessToken: string;
  clientId: string;
  shiprocketToken: string;
  scope: string;
  resource?: string;
}

// ─── Redis key helpers ────────────────────────────────────────────────────────

const K = {
  client: (id: string) => `sr:client:${id}`,
  authCode: (code: string) => `sr:authcode:${code}`,
  accessToken: (token: string) => `sr:at:${token}`,
  refreshToken: (token: string) => `sr:rt:${token}`,
  atToRt: (accessToken: string) => `sr:at_to_rt:${accessToken}`,
  pendingAuth: (txn: string) => `sr:txn:${txn}`,
};

const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60; // 30 days
const ACCESS_TOKEN_TTL_S = 3_600;               // 1 hour
const AUTH_CODE_TTL_S = 60;                     // 60 seconds
const PENDING_AUTH_TTL_S = 10 * 60;             // 10 minutes to read the consent page and log in

// ─── Encryption boundary (H1) ─────────────────────────────────────────────────
// Every record that carries a seller token is serialized through these two
// functions and nowhere else, so neither backend can ever hold a plaintext JWT.

interface WithSellerToken {
  shiprocketToken: string;
}

/** JSON-encode with the seller token encrypted. The only write path for secrets. */
export function serializeRecord<T extends WithSellerToken>(rec: T): string {
  return JSON.stringify({ ...rec, shiprocketToken: encryptSecret(rec.shiprocketToken) });
}

/**
 * Inverse of serializeRecord. Returns undefined instead of throwing so a
 * record written before encryption existed (or under a rotated key) is
 * treated as invalid and the client simply re-authenticates.
 */
export function deserializeRecord<T extends WithSellerToken>(raw: string): T | undefined {
  try {
    const rec = JSON.parse(raw) as T;
    return { ...rec, shiprocketToken: decryptSecret(rec.shiprocketToken) };
  } catch {
    return undefined;
  }
}

// ─── Backend selection ────────────────────────────────────────────────────────
// A minimal KV surface is all the store needs; implementing it twice keeps the
// business logic below single-pathed instead of `if (redis) … else …` per call.

interface KV {
  get(key: string): Promise<string | null>;
  getdel(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setMany(entries: Array<{ key: string; value: string; ttlSeconds: number }>): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

function redisKV(redis: Redis): KV {
  return {
    get: (key) => redis.get(key),
    getdel: (key) => redis.getdel(key),
    async set(key, value, ttlSeconds) {
      if (ttlSeconds) await redis.set(key, value, "EX", ttlSeconds);
      else await redis.set(key, value);
    },
    async setMany(entries) {
      const pipeline = redis.pipeline();
      for (const e of entries) pipeline.set(e.key, e.value, "EX", e.ttlSeconds);
      await pipeline.exec();
    },
    async del(...keys) {
      if (keys.length) await redis.del(...keys);
    },
  };
}

function memoryKV(): KV {
  const data = new Map<string, { value: string; expiresAt: number | null }>();

  const live = (key: string): string | null => {
    const entry = data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      data.delete(key);
      return null;
    }
    return entry.value;
  };

  // Sweep expired entries so a long-running dev process doesn't grow forever.
  setInterval(() => {
    for (const key of data.keys()) live(key);
  }, 60_000).unref();

  return {
    get: async (key) => live(key),
    async getdel(key) {
      const value = live(key);
      data.delete(key);
      return value;
    },
    async set(key, value, ttlSeconds) {
      data.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    },
    async setMany(entries) {
      for (const e of entries) await this.set(e.key, e.value, e.ttlSeconds);
    },
    async del(...keys) {
      for (const key of keys) data.delete(key);
    },
  };
}

let kv: KV;

if (process.env.REDIS_HOST) {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
    lazyConnect: false,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  redis.on("error", (err) => console.error("Redis error:", err.message));
  redis.on("connect", () => console.log("Redis connected"));
  kv = redisKV(redis);
} else {
  kv = memoryKV();
}

// ─── Client registration ──────────────────────────────────────────────────────

export async function registerClient(data: Omit<Client, "clientId" | "createdAt">): Promise<Client> {
  const clientId = `sr_client_${crypto.randomBytes(16).toString("hex")}`;
  const client: Client = { ...data, clientId, createdAt: Date.now() };
  await kv.set(K.client(clientId), JSON.stringify(client));
  return client;
}

export async function getClient(clientId: string): Promise<Client | undefined> {
  const raw = await kv.get(K.client(clientId));
  return raw ? (JSON.parse(raw) as Client) : undefined;
}

// ─── Pending authorizations (10 min TTL) ──────────────────────────────────────
// Plain JSON: the record carries no secret (a PKCE challenge is public by design).

export async function createPendingAuth(data: Omit<PendingAuth, "consented">): Promise<string> {
  const txn = `txn_${crypto.randomBytes(24).toString("hex")}`;
  const entry: PendingAuth = { ...data, consented: false };
  await kv.set(K.pendingAuth(txn), JSON.stringify(entry), PENDING_AUTH_TTL_S);
  return txn;
}

export async function getPendingAuth(txn: string): Promise<PendingAuth | undefined> {
  const raw = await kv.get(K.pendingAuth(txn));
  return raw ? (JSON.parse(raw) as PendingAuth) : undefined;
}

/** Record the seller's Allow. Restarts the TTL so they have the full window to log in. */
export async function markConsented(txn: string): Promise<PendingAuth | undefined> {
  const entry = await getPendingAuth(txn);
  if (!entry) return undefined;
  const consented: PendingAuth = { ...entry, consented: true };
  await kv.set(K.pendingAuth(txn), JSON.stringify(consented), PENDING_AUTH_TTL_S);
  return consented;
}

/** Atomic take: the txn can produce at most one authorization code. */
export async function consumePendingAuth(txn: string): Promise<PendingAuth | undefined> {
  const raw = await kv.getdel(K.pendingAuth(txn));
  return raw ? (JSON.parse(raw) as PendingAuth) : undefined;
}

export async function deletePendingAuth(txn: string): Promise<void> {
  await kv.del(K.pendingAuth(txn));
}

// ─── Auth codes (60s TTL, one-time use) ──────────────────────────────────────

export async function storeAuthCode(code: string, data: Omit<AuthCode, "expiresAt">): Promise<void> {
  const entry: AuthCode = { ...data, expiresAt: Date.now() + AUTH_CODE_TTL_S * 1000 };
  await kv.set(K.authCode(code), serializeRecord(entry), AUTH_CODE_TTL_S);
}

/** Single atomic GETDEL: two concurrent exchanges of one code cannot both succeed. */
export async function consumeAuthCode(code: string): Promise<AuthCode | undefined> {
  const raw = await kv.getdel(K.authCode(code));
  if (!raw) return undefined;
  const entry = deserializeRecord<AuthCode>(raw);
  if (!entry || entry.expiresAt < Date.now()) return undefined;
  return entry;
}

// ─── Access + refresh tokens ──────────────────────────────────────────────────

export async function issueTokens(
  data: Omit<AccessTokenData, "expiresAt">
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = `mcp_${crypto.randomBytes(24).toString("hex")}`;
  const refreshToken = `mcp_r_${crypto.randomBytes(24).toString("hex")}`;

  const atData: AccessTokenData = { ...data, expiresAt: Date.now() + ACCESS_TOKEN_TTL_S * 1000 };
  const rtData: RefreshTokenData = { linkedAccessToken: accessToken, ...data };

  await kv.setMany([
    { key: K.accessToken(accessToken), value: serializeRecord(atData), ttlSeconds: ACCESS_TOKEN_TTL_S },
    { key: K.refreshToken(refreshToken), value: serializeRecord(rtData), ttlSeconds: REFRESH_TOKEN_TTL_S },
    { key: K.atToRt(accessToken), value: refreshToken, ttlSeconds: REFRESH_TOKEN_TTL_S },
  ]);

  return { accessToken, refreshToken };
}

export async function getAccessTokenData(token: string): Promise<AccessTokenData | undefined> {
  const raw = await kv.get(K.accessToken(token));
  if (!raw) return undefined;
  const data = deserializeRecord<AccessTokenData>(raw);
  if (!data || data.expiresAt < Date.now()) return undefined;
  return data;
}

/** Invalidate an access token and the refresh token paired with it. */
export async function revokeAccessToken(accessToken: string): Promise<void> {
  const refreshToken = await kv.get(K.atToRt(accessToken));
  await kv.del(
    K.accessToken(accessToken),
    K.atToRt(accessToken),
    ...(refreshToken ? [K.refreshToken(refreshToken)] : [])
  );
}

/**
 * Invalidate a refresh token and the access token it is paired with.
 * Returns that access token so callers can close any live MCP session.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<string | undefined> {
  const raw = await kv.getdel(K.refreshToken(refreshToken));
  if (!raw) return undefined;
  // The record may be undecryptable (pre-encryption or rotated key); we still
  // want the paired access token gone, so parse without decrypting.
  let linked: string | undefined;
  try {
    linked = (JSON.parse(raw) as RefreshTokenData).linkedAccessToken;
  } catch {
    return undefined;
  }
  if (linked) await kv.del(K.accessToken(linked), K.atToRt(linked));
  return linked;
}

/**
 * RFC 7009 entry point: the caller does not have to know which kind of token
 * it holds. Returns every access token that stopped being valid. An unknown
 * token resolves to an empty list — revocation of nothing is still success.
 */
export async function revokeToken(
  token: string,
  hint?: string
): Promise<{ accessTokens: string[] }> {
  if (hint !== "refresh_token") {
    const isAccessToken =
      (await kv.get(K.accessToken(token))) !== null || (await kv.get(K.atToRt(token))) !== null;
    if (isAccessToken) {
      await revokeAccessToken(token);
      return { accessTokens: [token] };
    }
  }
  const linked = await revokeRefreshToken(token);
  return { accessTokens: linked ? [linked] : [] };
}

export async function rotateTokens(
  oldRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string; data: AccessTokenData; oldAccessToken: string } | undefined> {
  // GETDEL makes rotation single-use: a replayed refresh token finds nothing.
  const raw = await kv.getdel(K.refreshToken(oldRefreshToken));
  if (!raw) return undefined;

  const rtData = deserializeRecord<RefreshTokenData>(raw);
  if (!rtData) return undefined;

  const { linkedAccessToken: oldAccessToken, ...sessionData } = rtData;

  // The old access token may already have TTL'd out — deleting a missing key is a no-op.
  await kv.del(K.accessToken(oldAccessToken), K.atToRt(oldAccessToken));

  const data: AccessTokenData = { ...sessionData, expiresAt: Date.now() + ACCESS_TOKEN_TTL_S * 1000 };
  const tokens = await issueTokens(sessionData);

  return { ...tokens, data, oldAccessToken };
}
