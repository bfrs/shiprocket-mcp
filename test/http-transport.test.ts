import { describe, it, expect } from "vitest";
import { startHttpTransport } from "../src/transports/http";

describe("HTTP Transport", () => {
  it("should export startHttpTransport function", () => {
    expect(typeof startHttpTransport).toBe("function");
  });
});
