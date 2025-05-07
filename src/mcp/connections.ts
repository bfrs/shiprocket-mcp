import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import crypto from "node:crypto";

export const connectionsBySessionId: Record<
  string,
  { transport: SSEServerTransport | StdioServerTransport; sellerToken: string }
> = {};

export const globalSessionId = crypto.randomUUID();
