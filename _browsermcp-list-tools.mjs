import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync } from "node:fs";

const transport = new StdioClientTransport({
  command: "/home/patch/.npm-global/bin/mcp-server-browsermcp",
  args: [],
});

const client = new Client({ name: "browsermcp-smoke", version: "1.0.0" });
await client.connect(transport);

const result = await client.listTools();
writeFileSync("/tmp/browsermcp-tools.json", JSON.stringify(result, null, 2));
console.log("OK tools=" + result.tools.length);

await client.close();
