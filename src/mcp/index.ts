import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initializeTools } from "@/mcp/tools";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "shiprocket-mcp",
    version: "1.0.0",
  });

  initializeTools(server);
  return server;
}

// Legacy singleton for stdio transport
export const mcpServer = createMcpServer();
