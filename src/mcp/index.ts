import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initializeTools as initializeInternalTools } from "@/mcp/tools/internal";
import { initializeTools as initializeExternalTools } from "@/mcp/tools/external";

export const mcpServer = new McpServer({
  name: "shiprocket-mcp",
  version: "1.0.0",
});

if (process.env.MCP_TRANSPORT === "STREAMABLE_HTTP") {
  initializeInternalTools(mcpServer);
} else if (process.env.MCP_TRANSPORT === "STDIO") {
  initializeExternalTools(mcpServer);
}
