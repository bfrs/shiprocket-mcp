import { mcpServer } from "@/mcp/index";
import express, { NextFunction, Request, Response } from "express";
import { transportBySessionId } from "@/mcp/connections";
import "dotenv/config";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import {
  ErrorCode,
  isInitializeRequest,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { WeaviateService } from "@/services/weaviate";

const PORT = process.env.APP_PORT;

const app = express();

app.use(express.json());
app.use(cors());

app.get("/health-check", async (req, res) => {
  res.json({
    success: true,
    message: "All is well!!!",
  });
});

app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transportBySessionId[sessionId]) {
      transport = transportBySessionId[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          console.log("Session initialized with ID: " + sessionId);
          transportBySessionId[sessionId] = transport;
        },
      });

      await mcpServer.connect(transport);
    } else {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Session ID missing or invalid"
      );
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (err instanceof McpError) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: err.code,
          message: err.message,
        },
        id: null,
      });
    } else if (err instanceof Error) {
      console.log(err.stack);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: ErrorCode.InternalError,
          message: "Something went wrong",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  res.status(405).json({ success: false, error: "Method not allowed" });
});

app.delete("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transportBySessionId[sessionId]) {
      res
        .status(400)
        .json({ success: false, error: "Session ID missing or invalid" });
      return;
    }

    const transport = transportBySessionId[sessionId];
    await transport.handleRequest(req, res);

    console.log("Session closed for ID: " + transport.sessionId);
    if (transport.sessionId) {
      delete transportBySessionId[transport.sessionId];
    }
  } catch (err) {
    if (err instanceof Error) {
      console.log(err.stack);
      res.status(500).send({ success: false, error: "Something went wrong" });
    }
  }
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

WeaviateService.initialize().then(() =>
  app.listen(PORT, () => console.log(`MCP Server listening on port ${PORT}...`))
);
