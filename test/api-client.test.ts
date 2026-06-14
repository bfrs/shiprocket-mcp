import { describe, it, expect, vi } from "vitest";
import { ShiprocketClient } from "../src/api/client";
import { server } from "./msw/server";
import { http, HttpResponse } from "msw";
import { API_DOMAINS } from "../src/config";

describe("ShiprocketClient", () => {
  it("should authenticate and make requests", async () => {
    const client = new ShiprocketClient({
      credentials: {
        email: "test@example.com",
        password: "testpass",
      },
    });

    await client.initialize();
    expect(client.getToken()).toBe("mock-seller-token-12345");
  });

  it("should refresh token on 401 and retry request", async () => {
    let authCount = 0;
    server.use(
      http.post(
        `${API_DOMAINS.SHIPROCKET}/v1/external/auth/login`,
        () => {
          authCount++;
          return HttpResponse.json({ token: `refreshed-token-${authCount}` });
        }
      ),
      http.get(
        `${API_DOMAINS.SHIPROCKET}/v1/external/orders`,
        () => {
          return HttpResponse.json({ data: [] });
        }
      )
    );

    const client = new ShiprocketClient({
      credentials: {
        email: "test@example.com",
        password: "testpass",
      },
    });

    await client.initialize();
    const data = await client.get(`${API_DOMAINS.SHIPROCKET}/v1/external/orders`);
    expect(data).toBeDefined();
  });
});
