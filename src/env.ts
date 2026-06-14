import { logger } from "@/logger";

export interface Env {
  SELLER_EMAIL: string;
  SELLER_PASSWORD: string;
  PORT: number;
  API_BASE_SHIPROCKET: string;
  API_BASE_SERVICEABILITY: string;
  MCP_AUTH_TOKEN: string | undefined;
}

export function validateEnv(): Env {
  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;

  if (!sellerEmail || !sellerPassword) {
    const error = new Error(
      "SELLER_EMAIL and SELLER_PASSWORD are required environment variables. " +
        "Please set them in your environment or .env file before starting the server."
    );
    logger.error(error.message);
    throw error;
  }

  return {
    SELLER_EMAIL: sellerEmail,
    SELLER_PASSWORD: sellerPassword,
    PORT: parseInt(process.env.PORT || process.env.APP_PORT || "3000", 10),
    API_BASE_SHIPROCKET:
      process.env.API_BASE_SHIPROCKET || "https://apiv2.shiprocket.in",
    API_BASE_SERVICEABILITY:
      process.env.API_BASE_SERVICEABILITY ||
      "https://serviceability.shiprocket.in",
    MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN,
  };
}
