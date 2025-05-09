import { mcpServer } from "@/mcp/index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();

(async () => {
  await mcpServer.connect(transport);
})();
