import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initializeTools } from "../src/mcp/tools";

describe("Tool Registration", () => {
  it("should register all tools without errors", () => {
    const server = new McpServer({
      name: "test-server",
      version: "1.0.0",
    });

    expect(() => initializeTools(server)).not.toThrow();
  });
});
