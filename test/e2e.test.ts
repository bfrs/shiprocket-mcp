import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startHttpTransport } from "../src/transports/http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server } from "node:http";
import { server as mswServer } from "./msw/server";
import { http, passthrough } from "msw";

describe("E2E HTTP Transport", () => {
  let serverInstance: Server;
  let closeServer: () => Promise<void>;
  let baseUrl: URL;

  beforeAll(async () => {
    process.env.SELLER_EMAIL = "test@example.com";
    process.env.SELLER_PASSWORD = "testpass";
    process.env.PORT = "3456";

    // Bypass MSW for local server requests
    mswServer.use(
      http.all('*', ({ request }) => {
        if (request.url.startsWith('http://localhost:3456')) {
          return passthrough();
        }
      })
    );

    const { server, close } = await startHttpTransport();
    serverInstance = server;
    closeServer = close;
    baseUrl = new URL("http://localhost:3456/mcp");
  });

  afterAll(async () => {
    await closeServer();
    delete process.env.SELLER_EMAIL;
    delete process.env.SELLER_PASSWORD;
    delete process.env.PORT;
  });

  it("should respond to health check", async () => {
    const res = await fetch("http://localhost:3456/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("should initialize MCP session and list tools", async () => {
    const transport = new StreamableHTTPClientTransport(baseUrl);
    const client = new Client({ name: "e2e-test", version: "1.0.0" });
    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.length).toBe(24);

    await client.close();
  });

  it("should call a tool end-to-end", async () => {
    const transport = new StreamableHTTPClientTransport(baseUrl);
    const client = new Client({ name: "e2e-test", version: "1.0.0" });
    await client.connect(transport);

    const result = await client.callTool({
      name: "order_list",
      arguments: {},
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();

    await client.close();
  });
});
