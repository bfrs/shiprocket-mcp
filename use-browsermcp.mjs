import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "/home/patch/.npm-global/bin/mcp-server-browsermcp",
  args: []
});

const client = new Client({
  name: "test-client",
  version: "1.0.0"
});

await client.connect(transport);

const tools = await client.listTools();
console.log("Tools:", JSON.stringify(tools, null, 2));

await client.close();
