import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "@/mcp/index";
import { connectionsBySessionId, expiredSellerTokenSessions } from "@/mcp/connections";
import { oauthRouter } from "@/oauth/router";
import { getAccessTokenData, revokeAccessToken } from "@/oauth/store";
import { loadKey } from "@/oauth/crypto";
import { parseScope } from "@/oauth/scopes";

if (process.env.NODE_ENV === "production" && !process.env.OAUTH_ISSUER) {
  console.error("FATAL: OAUTH_ISSUER environment variable must be set in production");
  process.exit(1);
}

// Resolve the token-encryption key now rather than on the first login, so a
// misconfigured pod dies at boot instead of serving 500s to the first seller.
try {
  loadKey();
} catch (err) {
  console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const PORT = parseInt(process.env.APP_PORT ?? "3000", 10);

function extractBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function sendUnauthorized(res: Response): void {
  const base = process.env.OAUTH_ISSUER ?? `http://localhost:${process.env.APP_PORT ?? "3000"}`;
  res
    .status(401)
    .set(
      "WWW-Authenticate",
      `Bearer realm="Shiprocket MCP", resource_metadata="${base}/.well-known/oauth-protected-resource"`
    )
    .json({ error: "unauthorized", error_description: "Valid Bearer token required" });
}

const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", error_description: "Rate limit exceeded, try again later" },
  validate: { xForwardedForHeader: false },
});

async function startHttpServer(): Promise<void> {
  const app = express();

  app.set("trust proxy", 1); // trust first proxy (ngrok, nginx, etc.)
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, mcp-protocol-version, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, WWW-Authenticate");
    if (req.method === "OPTIONS") {
      res.status(204).send();
      return;
    }
    next();
  });

  const transports = new Map<string, StreamableHTTPServerTransport>();

  function cleanupSession(sessionId: string): void {
    transports.delete(sessionId);
    expiredSellerTokenSessions.delete(sessionId);
    delete connectionsBySessionId[sessionId];
  }

  // Apply rate limiting to auth endpoints
  app.use("/oauth/authorize", authRateLimiter);
  app.use("/oauth/token", authRateLimiter);
  app.use("/oauth/register", authRateLimiter);
  app.use("/oauth/revoke", authRateLimiter);
  app.use("/oauth/consent", authRateLimiter);

  app.use(oauthRouter);

  app.get("/health-check", (_req, res) => {
    res.json({ success: true, sessions: transports.size });
  });

  app.post("/mcp", async (req, res) => {
    const token = extractBearer(req);
    if (!token) { sendUnauthorized(res); return; }

    const tokenData = await getAccessTokenData(token);
    if (!tokenData) { sendUnauthorized(res); return; }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ success: false, message: "Session not found or expired" });
        return;
      }

      // Shiprocket expired in a previous tool call — revoke MCP tokens now and force full re-auth
      if (expiredSellerTokenSessions.has(sessionId)) {
        expiredSellerTokenSessions.delete(sessionId);
        await revokeAccessToken(token);
        sendUnauthorized(res);
        return;
      }

      // Keep session token current — handles rotation and sessions initialised before token was set
      if (connectionsBySessionId[sessionId]) {
        connectionsBySessionId[sessionId].accessToken = token;
      }

      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — bind this user's Shiprocket token and granted scopes to it
    const { scopes } = parseScope(tokenData.scope);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        transports.set(newSessionId, transport);
        connectionsBySessionId[newSessionId] = {
          transport,
          sellerToken: tokenData.shiprocketToken,
          accessToken: token,
          scopes,
        };
        transport.onclose = () => cleanupSession(newSessionId);
      },
    });

    const server = createMcpServer(scopes);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({ success: false, message: "Missing mcp-session-id header" });
      return;
    }

    const token = extractBearer(req);
    if (!token) { sendUnauthorized(res); return; }

    const tokenData = await getAccessTokenData(token);
    if (!tokenData) { sendUnauthorized(res); return; }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ success: false, message: "Session not found or expired" });
      return;
    }

    // Same expiry check on the SSE channel
    if (expiredSellerTokenSessions.has(sessionId)) {
      expiredSellerTokenSessions.delete(sessionId);
      await revokeAccessToken(token);
      sendUnauthorized(res);
      return;
    }

    if (connectionsBySessionId[sessionId]) {
      connectionsBySessionId[sessionId].accessToken = token;
    }

    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId) {
      const transport = transports.get(sessionId);
      if (transport) {
        await transport.close();
        cleanupSession(sessionId);
      }
    }
    res.status(200).json({ success: true });
  });

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Not found" });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if ("status" in err && (err as { status?: number }).status === 400 && "body" in err) {
      res.status(400).json({ success: false, message: "Invalid JSON payload" });
      return;
    }
    console.error(`Request error: ${err.stack}`);
    res.status(500).json({ success: false, message: "Something went wrong" });
  });

  process.on("uncaughtException", (error: Error) => {
    console.error(`Uncaught Exception: ${error.stack}`);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    console.error(`Unhandled Rejection: ${reason}`);
  });

  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`Shiprocket MCP HTTP server running on http://localhost:${PORT}`);
      resolve();
    });
  });
}

(async () => {
  try {
    await startHttpServer();
  } catch (err) {
    if (err instanceof Error) {
      console.error({ success: false, error: err.message });
    }
    process.exit(1);
  }
})();
