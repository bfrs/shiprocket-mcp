import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import crypto from "node:crypto";
import type { Scope } from "@/oauth/scopes";

export const connectionsBySessionId: Record<
  string,
  {
    transport: SSEServerTransport | StdioServerTransport | StreamableHTTPServerTransport;
    sellerToken: string;
    accessToken?: string; // MCP bearer token — stored so tools can revoke it on SR 401
    /**
     * Scopes the seller granted on the consent page. Tools check this before
     * any upstream call. Absent means "nothing granted" — never "everything".
     */
    scopes?: Set<Scope>;
  }
> = {};

export const globalSessionId = crypto.randomUUID();

// Sessions where Shiprocket returned 401 — MCP tokens are revoked on the next HTTP request
// to force a full OAuth re-auth (login form) rather than a silent token refresh
export const expiredSellerTokenSessions = new Set<string>();

/**
 * Tear down every live MCP session that was opened with the given access token.
 * Called after a token is revoked so an in-flight client cannot keep using a
 * session whose credentials no longer exist. Closing the transport fires its
 * onclose handler, which http.ts uses to drop the session from every map.
 */
export async function closeSessionsForAccessToken(accessToken: string): Promise<void> {
  for (const [sessionId, conn] of Object.entries(connectionsBySessionId)) {
    if (conn.accessToken !== accessToken) continue;
    delete connectionsBySessionId[sessionId];
    expiredSellerTokenSessions.delete(sessionId);
    await conn.transport.close();
  }
}
