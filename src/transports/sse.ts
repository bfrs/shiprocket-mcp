import { mcpServer } from "@/mcp/index";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { NextFunction, Request, Response } from "express";
import { connectionsBySessionId } from "@/mcp/connections";
import "dotenv/config";

const PORT = process.env.APP_PORT;

const app = express();

app.use(express.json());

app.get("/health-check", async (req, res) => {
  res.json({
    success: true,
    message: "All is well!!!",
  });
});

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
  const { transport } = connectionsBySessionId[sessionId] as {
    transport: SSEServerTransport;
  };

  if (!transport) {
    res.json({ success: false, message: "No transport found for sessionId" }); //UD: Update structure according to MCP
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Looking for something?",
  });
});

app.use((err: Error, req: Request, res: Response, _: NextFunction) => {
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    err.status === 400 &&
    "body" in err
  ) {
    res.status(400).json({ success: false, message: "Invalid JSON payload" });
    return;
  }

  console.error(`Error occurred during request: ${err.stack}`);

  res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
});

// Catch synchronous exceptions that are not caught by Express
process.on("uncaughtException", (error: Error) => {
  console.error(`Uncaught Exception: ${error.stack}`);
  process.exit(1);
});

// Catch unhandled promise rejections
process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    console.error(
      `Unhandled Rejection at: ${promise} reason: ${
        reason instanceof Error ? reason.stack : reason
      }`
    );
    process.exit(1);
  }
);

app.listen(PORT, () => console.log(`MCP Server listening on port ${PORT}...`));
