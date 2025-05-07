import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ChatOpenAI } from "@langchain/openai";
import { loadMcpTools } from "@langchain/mcp-adapters";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const router = express.Router();

const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_KEY,
  modelName: "gpt-4o-mini-2024-07-18",
  temperature: 0,
  maxRetries: 1,
});

router.post("/send", async (req, res) => {
  const userMessage = req.body.message;
  const authorization = req.headers.authorization;
  const token = authorization?.split(" ")[1] as string;
  const client = new Client({
    name: "shiprocket-mcp-client",
    version: "1.0.0",
  });

  const transport = new SSEClientTransport(
    new URL(`${process.env.MCP_SERVER_HOST}/sse?st=${token}`)
  );

  await client.connect(transport);

  const tools = await loadMcpTools("shiprocket-mcp", client, {
    throwOnLoadError: true,
    prefixToolNameWithServerName: false,
    additionalToolNamePrefix: "",
  });

  const agent = createReactAgent({ llm: chatModel, tools });
  const agentResponse = await agent.invoke({
    messages: [{ role: "user", content: userMessage }],
  });

  res.json({
    success: true,
    message: agentResponse.messages.at(-1)?.content,
  });

  await client.close();
});

export default router;
