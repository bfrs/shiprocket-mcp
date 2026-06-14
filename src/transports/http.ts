import express, { Request, Response } from "express";
import type { Server } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";

function isInitializeRequest(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "jsonrpc" in body &&
    (body as Record<string, unknown>).jsonrpc === "2.0" &&
    "method" in body &&
    (body as Record<string, unknown>).method === "initialize"
  );
}

import { createMcpServer } from "@/mcp/index";
import { storeConnection, deleteConnection, touchConnection, pruneStaleConnections, SESSION_TTL_MS } from "@/mcp/connections";
import { createShiprocketClient } from "@/api/client";
import { validateEnv } from "@/env";
import { logger } from "@/logger";

const transports: Record<string, StreamableHTTPServerTransport> = {};

export async function startHttpTransport(): Promise<void> {
  const env = validateEnv();
  const port = env.PORT;

  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  if (env.MCP_AUTH_TOKEN) {
    app.use("/mcp", (req: Request, res: Response, next) => {
      const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
      const expected = env.MCP_AUTH_TOKEN!;
      if (
        token.length !== expected.length ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
      ) {
        res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized" },
          id: null,
        });
        return;
      }
      next();
    });
  }

  // MCP endpoint - POST for initialization and messages
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
        touchConnection(sessionId);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        const MAX_SESSIONS = 100;
        if (Object.keys(transports).length >= MAX_SESSIONS) {
          res.status(503).json({
            jsonrpc: "2.0",
            error: { code: -32002, message: "Server busy: too many active sessions" },
            id: null,
          });
          return;
        }

        const reservationId = `__pending_${randomUUID()}`;
        transports[reservationId] = null as unknown as StreamableHTTPServerTransport;

        try {
          const client = createShiprocketClient({
            email: env.SELLER_EMAIL,
            password: env.SELLER_PASSWORD,
          });

          await client.initialize();

          // Create a new MCP server per session
          const server = createMcpServer();

          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              logger.info({ sessionId: sid }, "MCP session initialized");
              // Store transport INSIDE the callback to ensure correct session ID
              storeConnection(sid, transport, client);
              transports[sid] = transport;
              if (transports[reservationId] === null) {
                delete transports[reservationId];
              }
            },
          });

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid) {
              delete transports[sid];
              deleteConnection(sid);
              logger.info({ sessionId: sid }, "MCP session closed");
            }
          };

          // Connect MCP server to transport
          await server.connect(transport);

          await transport.handleRequest(req, res, req.body);
        } catch (err) {
          if (transports[reservationId] === null) {
            delete transports[reservationId];
          }
          throw err;
        }
        return;
      } else {
        // Bad request - missing session ID for non-initialize request
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Bad Request" },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error(error, "Error handling MCP POST request");
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // MCP endpoint - GET for SSE stream
  app.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Missing or invalid session ID");
      return;
    }

    try {
      await transports[sessionId].handleRequest(req, res);
    } catch (error) {
      logger.error(error, "Error handling MCP SSE request");
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  });

  // MCP endpoint - DELETE for session termination
  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(404).send("Session not found");
      return;
    }

    try {
      await transports[sessionId].handleRequest(req, res);
    } catch (error) {
      logger.error(error, "Error handling MCP DELETE request");
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  });

  const server: Server = app.listen(port, () => {
    logger.info(
      { port },
      `Shiprocket MCP server listening on http://localhost:${port}`
    );
  });

  const cleanupInterval = setInterval(async () => {
    const pruned = pruneStaleConnections();
    for (const sid of pruned) {
      if (transports[sid]) {
        await transports[sid].close();
      }
    }
    if (pruned.length > 0) {
      logger.info({ pruned: pruned.length }, "Pruned stale MCP sessions");
    }
  }, SESSION_TTL_MS);

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "Shutting down HTTP transport...");
    clearInterval(cleanupInterval);
    for (const sessionId in transports) {
      await transports[sessionId].close();
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      setTimeout(() => resolve(), 5000).unref();
    });
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
