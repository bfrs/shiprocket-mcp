import { mcpServer } from "@/mcp/index";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { connectionsBySessionId } from "@/mcp/connections";
import "dotenv/config";

const PORT = process.env.APP_PORT;

const app = express();

app.use(express.json());

app.get("/sse", async (req, res) => {
  const sellerToken = req.query?.st as string;
  const transport = new SSEServerTransport("/messages", res);
  connectionsBySessionId[transport.sessionId] = {
    transport,
    sellerToken,
  };

  res.on("close", () => {
    delete connectionsBySessionId[transport.sessionId];
  });

  await mcpServer.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const { transport } = connectionsBySessionId[sessionId];

  if (!transport) {
    res.json({ success: false, message: "No transport found for sessionId" }); //UD: Update structure according to MCP
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

app.listen(PORT, () => console.log(`MCP Server listening on port ${PORT}...`));
