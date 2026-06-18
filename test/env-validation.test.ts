import { describe, it, expect } from "vitest";
import { validateEnv } from "../src/env";

describe("Env Validation", () => {
  it("should throw if SELLER_EMAIL is missing", () => {
    const originalEmail = process.env.SELLER_EMAIL;
    const originalPassword = process.env.SELLER_PASSWORD;
    delete process.env.SELLER_EMAIL;
    process.env.SELLER_PASSWORD = "test";

    expect(() => validateEnv()).toThrow(
      "Authentication requires either SELLER_TOKEN or both SELLER_EMAIL and SELLER_PASSWORD"
    );

    process.env.SELLER_EMAIL = originalEmail;
    process.env.SELLER_PASSWORD = originalPassword;
  });

  it("should return env vars when set", () => {
    const originalEmail = process.env.SELLER_EMAIL;
    const originalPassword = process.env.SELLER_PASSWORD;
    process.env.SELLER_EMAIL = "test@example.com";
    process.env.SELLER_PASSWORD = "testpass";

    const env = validateEnv();
    expect(env.SELLER_EMAIL).toBe("test@example.com");
    expect(env.SELLER_PASSWORD).toBe("testpass");
    expect(env.PORT).toBe(3000);

    process.env.SELLER_EMAIL = originalEmail;
    process.env.SELLER_PASSWORD = originalPassword;
  });
});
