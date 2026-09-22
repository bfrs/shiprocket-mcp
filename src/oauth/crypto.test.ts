import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, loadKey, resetKeyForTests } from "./crypto";

const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");
const SELLER_JWT = "eyJhbGciOiJIUzI1NiJ9.seller.signature";

describe("crypto", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetKeyForTests();
    process.env.TOKEN_ENC_KEY = KEY_A;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetKeyForTests();
    vi.restoreAllMocks();
  });

  it("round-trips a secret and never emits the plaintext", () => {
    const blob = encryptSecret(SELLER_JWT);
    expect(blob).not.toContain(SELLER_JWT);
    expect(blob.split(".")).toHaveLength(4);
    expect(blob.startsWith("v1.")).toBe(true);
    expect(decryptSecret(blob)).toBe(SELLER_JWT);
  });

  it("uses a fresh IV so equal plaintexts produce different blobs", () => {
    expect(encryptSecret(SELLER_JWT)).not.toBe(encryptSecret(SELLER_JWT));
  });

  it("rejects a tampered ciphertext", () => {
    const [v, iv, ct, tag] = encryptSecret(SELLER_JWT).split(".");
    const flipped = (ct[0] === "A" ? "B" : "A") + ct.slice(1);
    expect(() => decryptSecret([v, iv, flipped, tag].join("."))).toThrow();
  });

  it("rejects a truncated auth tag", () => {
    // A 4-byte prefix of a valid tag still verifies under GCM unless the
    // expected tag length is pinned, which cuts forgery cost to 2^32.
    const [v, iv, ct, tag] = encryptSecret(SELLER_JWT).split(".");
    const short = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url");
    expect(() => decryptSecret([v, iv, ct, short].join("."))).toThrow(/unrecognised/);
  });

  it("rejects a blob encrypted under a different key", () => {
    const blob = encryptSecret(SELLER_JWT);
    resetKeyForTests();
    process.env.TOKEN_ENC_KEY = KEY_B;
    expect(() => decryptSecret(blob)).toThrow();
  });

  it("rejects an unknown blob format", () => {
    expect(() => decryptSecret("plain-old-jwt")).toThrow(/unrecognised/);
    expect(() => decryptSecret("v9.a.b.c")).toThrow(/unrecognised/);
  });

  it("names TOKEN_ENC_KEY when the key has the wrong length", () => {
    process.env.TOKEN_ENC_KEY = Buffer.alloc(5).toString("base64");
    expect(() => loadKey()).toThrow(/TOKEN_ENC_KEY must decode to exactly 32 bytes \(got 5\)/);
  });

  it("refuses to start in production without a key", () => {
    delete process.env.TOKEN_ENC_KEY;
    process.env.NODE_ENV = "production";
    expect(() => loadKey()).toThrow(/TOKEN_ENC_KEY is required in production/);
  });

  it("falls back to an ephemeral key outside production, with a warning", () => {
    delete process.env.TOKEN_ENC_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const blob = encryptSecret(SELLER_JWT);
    expect(decryptSecret(blob)).toBe(SELLER_JWT);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/ephemeral/);
  });
});
