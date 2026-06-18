import { storeConnection, globalSessionId } from "@/mcp/connections";
import { mcpServer } from "@/mcp/index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ShiprocketClient } from "@/api/client";
import { ShiprocketAuth } from "@/api/auth";
import { validateEnv } from "@/env";
import { logger } from "@/logger";

const transport = new StdioServerTransport();

(async () => {
  try {
    const env = validateEnv();

    const auth = new ShiprocketAuth({
      email: env.SELLER_EMAIL,
      password: env.SELLER_PASSWORD,
      sellerToken: env.SELLER_TOKEN,
    });
    const client = new ShiprocketClient({ auth });

    await client.initialize();
    logger.info("Shiprocket authentication successful via stdio transport");

    storeConnection(globalSessionId, transport, client);
    await mcpServer.connect(transport);

    async function shutdown(signal: string): Promise<void> {
      logger.info({ signal }, "Shutting down stdio transport...");
      await transport.close();
      process.exit(0);
    }

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    if (err instanceof Error) {
      logger.error({ error: err.message }, "Failed to start stdio transport");
    } else {
      logger.error({ error: String(err) }, "Failed to start stdio transport with non-Error throw");
    }

    process.exit(1);
  }
})();
