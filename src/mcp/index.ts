import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initializeTools } from "@/mcp/tools";
import type { Scope } from "@/oauth/scopes";

/**
 * One server per connection, built for the scopes that connection was
 * granted. HTTP calls this per session with the token's scopes; stdio calls
 * it once with every scope, since the seller supplied their own credentials.
 */
export const createMcpServer = (scopes: Iterable<Scope>): McpServer => {
  const server = new McpServer({
    name: "shiprocket-mcp",
    version: "1.0.0",
  });
  initializeTools(server, scopes);
  return server;
};
