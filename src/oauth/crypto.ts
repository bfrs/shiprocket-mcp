import crypto from "node:crypto";

// Encryption-at-rest for seller tokens (H1). Every record that carries a
// shiprocketToken goes through encryptSecret() before it is written to Redis
// or the in-memory store, so a Redis dump, backup or debug session never
// exposes a usable apiv2 JWT.

const ENV_KEY = "TOKEN_ENC_KEY";
const VERSION = "v1"; // bump when the key or algorithm changes; old blobs stay decryptable
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12;  // GCM standard nonce length

let cachedKey: Buffer | null = null;

/**
 * Resolve the key once per process. Production MUST set TOKEN_ENC_KEY
 * (base64, 32 bytes); anything else fails fast with the variable name.
 * Outside production a random ephemeral key keeps `npm run dev:http`
 * working — tokens simply do not survive a restart.
 */
export function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env[ENV_KEY];
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${ENV_KEY} is required in production (base64-encoded, ${KEY_BYTES} bytes)`);
    }
    console.warn(`${ENV_KEY} not set — using an ephemeral key; stored tokens will not survive a restart`);
    cachedKey = crypto.randomBytes(KEY_BYTES);
    return cachedKey;
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`${ENV_KEY} must decode to exactly ${KEY_BYTES} bytes (got ${key.length})`);
  }
  cachedKey = key;
  return key;
}

/** Forget the cached key so tests can swap TOKEN_ENC_KEY between cases. */
export function resetKeyForTests(): void {
  cachedKey = null;
}

const b64u = (b: Buffer): string => b.toString("base64url");

/** AES-256-GCM; output is `v1.<iv>.<ciphertext>.<tag>` in base64url. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", loadKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, b64u(iv), b64u(ciphertext), b64u(cipher.getAuthTag())].join(".");
}

/** Inverse of encryptSecret. Throws on a wrong key, a tampered blob, or an unknown version. */
export function decryptSecret(blob: string): string {
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("unrecognised encrypted secret format");
  }
  const [, iv, ciphertext, tag] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", loadKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
