import { logger } from "@/logger";

export interface Env {
  SELLER_EMAIL: string | undefined;
  SELLER_PASSWORD: string | undefined;
  SELLER_TOKEN: string | undefined;
  PORT: number;
  API_BASE_SHIPROCKET: string;
  API_BASE_SERVICEABILITY: string;
  SR_API_BASE: string;
  MCP_AUTH_TOKEN: string | undefined;
}

export function validateEnv(): Env {
  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;
  const sellerToken = process.env.SELLER_TOKEN;

  if (!sellerToken && (!sellerEmail || !sellerPassword)) {
    const error = new Error(
      "Authentication requires either SELLER_TOKEN or both SELLER_EMAIL and SELLER_PASSWORD. " +
        "Set one of these in your environment or .env file before starting the server."
    );
    logger.error(error.message);
    throw error;
  }

  return {
    SELLER_EMAIL: sellerEmail,
    SELLER_PASSWORD: sellerPassword,
    SELLER_TOKEN: sellerToken,
    PORT: parseInt(process.env.PORT || process.env.APP_PORT || "3000", 10),
    API_BASE_SHIPROCKET:
      process.env.API_BASE_SHIPROCKET || "https://apiv2.shiprocket.in",
    API_BASE_SERVICEABILITY:
      process.env.API_BASE_SERVICEABILITY ||
      "https://serviceability.shiprocket.in",
    SR_API_BASE:
      process.env.SR_API_BASE || "https://apiv2.shiprocket.in/v1/external",
    MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN,
  };
}
