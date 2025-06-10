import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export const transportBySessionId = new Map<
  string,
  { transport: StreamableHTTPServerTransport; lastUsedAt: number }
>();

const SESSION_EXPIRATION_DURATION = 60 * 1000;

setInterval(() => {
  for (const [sessionId, session] of transportBySessionId) {
    if (Date.now() - session.lastUsedAt > SESSION_EXPIRATION_DURATION) {
      transportBySessionId.delete(sessionId);
    }
  }
}, SESSION_EXPIRATION_DURATION);

export const sellerToken = null;
