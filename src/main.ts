import { validateEnv } from "@/env";
import { logger } from "@/logger";

async function main() {
  try {
    validateEnv();

    const isStdio =
      process.argv.includes("--stdio") ||
      process.env.MCP_TRANSPORT === "STDIO";

    if (isStdio) {
      logger.info("Starting Shiprocket MCP server in STDIO mode");
      await import("@/transports/stdio.js");
    } else {
      logger.info("Starting Shiprocket MCP server in HTTP mode");
      const { startHttpTransport } = await import("@/transports/http.js");
      await startHttpTransport();
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error({ error: error.message }, "Failed to start server");
    } else {
      logger.error({ error: String(error) }, "Failed to start server with non-Error throw");
    }
    process.exit(1);
  }
}

main();
