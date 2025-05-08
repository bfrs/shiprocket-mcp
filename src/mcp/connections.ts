import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export const connectionsBySessionId: Record<
  string,
  { transport: SSEServerTransport; sellerToken: string }
> = {};
