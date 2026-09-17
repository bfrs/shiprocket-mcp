import { describe, expect, it } from "vitest";
import { ALL_SCOPES, DEFAULT_SCOPES, formatScope, isScope, parseScope, permits } from "./scopes";

describe("scopes", () => {
  it("defaults to seller:read when the client asks for nothing", () => {
    expect([...parseScope(undefined).scopes]).toEqual(["seller:read"]);
    expect([...parseScope("").scopes]).toEqual(["seller:read"]);
    expect([...parseScope("   ").scopes]).toEqual(["seller:read"]);
    expect(DEFAULT_SCOPES).toEqual(["seller:read"]);
  });

  it("parses a space-delimited list and reports unknown values separately", () => {
    const { scopes, unknown } = parseScope("seller:write  seller:read mcp offline_access");
    expect(scopes).toEqual(new Set(["seller:read", "seller:write"]));
    expect(unknown).toEqual(["mcp", "offline_access"]);
  });

  it("does not fall back to the default when only unknown scopes were requested", () => {
    const { scopes, unknown } = parseScope("bogus");
    expect(scopes.size).toBe(0);
    expect(unknown).toEqual(["bogus"]);
  });

  it("formats in canonical order", () => {
    expect(formatScope(["seller:write", "seller:read"])).toBe("seller:read seller:write");
    expect(formatScope([])).toBe("");
    expect(ALL_SCOPES).toEqual(["seller:read", "seller:write"]);
  });

  it("permits from either a set or a stored scope string", () => {
    expect(permits(new Set(["seller:read"]), "seller:write")).toBe(false);
    expect(permits(new Set(["seller:read", "seller:write"]), "seller:write")).toBe(true);
    expect(permits("seller:read seller:write", "seller:write")).toBe(true);
    expect(permits("seller:read", "seller:write")).toBe(false);
  });

  it("does not treat the legacy 'mcp' scope as any permission", () => {
    expect(permits("mcp", "seller:read")).toBe(false);
    expect(isScope("mcp")).toBe(false);
    expect(isScope("seller:read")).toBe(true);
  });
});
