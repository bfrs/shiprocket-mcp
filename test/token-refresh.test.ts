import { describe, it, expect } from "vitest";
import { ShiprocketClient } from "../src/api/client";
import { server } from "./msw/server";
import { http, HttpResponse } from "msw";
import { API_DOMAINS } from "../src/config";

describe("Token Refresh", () => {
  it("should handle token refresh on 401", async () => {
    let shouldFail = true;
    server.use(
      http.get(
        `${API_DOMAINS.SHIPROCKET}/v1/external/orders`,
        () => {
          if (shouldFail) {
            shouldFail = false;
            return new HttpResponse(null, { status: 401 });
          }
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
    // The request should succeed after retry
    const response = await client.get(`${API_DOMAINS.SHIPROCKET}/v1/external/orders`);
    expect(response).toBeDefined();
  });
});
