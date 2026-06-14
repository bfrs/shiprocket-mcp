import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initializeTools } from "../src/mcp/tools";
import { getOrCreateClient, globalSessionId, storeConnection } from "../src/mcp/connections";
import { createShiprocketClient } from "../src/api/client";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

describe("Regression", () => {
  it("should create client and store connection", () => {
    const client = createShiprocketClient({
      email: "test@example.com",
      password: "testpass",
    });

    const transport = new StdioServerTransport();
    storeConnection(globalSessionId, transport, client);

    expect(client).toBeDefined();
    expect(getOrCreateClient(globalSessionId)).toBeDefined();
  });
});
