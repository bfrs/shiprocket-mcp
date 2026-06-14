import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import crypto from "node:crypto";
import { ShiprocketClient } from "@/api/client";
import type { AuthCredentials } from "@/api/auth";

export interface Connection {
  transport: StdioServerTransport | StreamableHTTPServerTransport;
  client: ShiprocketClient;
}

export const connectionsBySessionId: Record<string, Connection & { lastActivity: number }> = {};

export const globalSessionId = crypto.randomUUID();

export const SESSION_TTL_MS = 30 * 60 * 1000;

export function getOrCreateClient(
  sessionId: string,
  credentials?: AuthCredentials
): ShiprocketClient {
  const connection = connectionsBySessionId[sessionId];
  if (connection) {
    return connection.client;
  }

  if (!credentials) {
    throw new Error(
      `No client found for session ${sessionId} and no credentials provided`
    );
  }

  const client = new ShiprocketClient({ credentials });
  return client;
}

export function storeConnection(
  sessionId: string,
  transport: StdioServerTransport | StreamableHTTPServerTransport,
  client: ShiprocketClient
): void {
  connectionsBySessionId[sessionId] = { transport, client, lastActivity: Date.now() };
}

export function deleteConnection(sessionId: string): void {
  delete connectionsBySessionId[sessionId];
}

export function touchConnection(sessionId: string): void {
  const conn = connectionsBySessionId[sessionId];
  if (conn) {
    conn.lastActivity = Date.now();
  }
}

export function pruneStaleConnections(): string[] {
  const now = Date.now();
  const pruned: string[] = [];
  for (const sessionId in connectionsBySessionId) {
    if (now - connectionsBySessionId[sessionId].lastActivity > SESSION_TTL_MS) {
      pruned.push(sessionId);
      deleteConnection(sessionId);
    }
  }
  return pruned;
}
