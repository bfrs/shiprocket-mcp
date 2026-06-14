import axios from "axios";
import { API_DOMAINS } from "@/config";
import { logger } from "@/logger";
import type { AuthResponse } from "./types";

export interface AuthCredentials {
  email: string;
  password: string;
}

export async function authenticate(
  credentials: AuthCredentials
): Promise<string> {
  const url = `${API_DOMAINS.SHIPROCKET}/v1/external/auth/login`;
  logger.info({ url }, "Authenticating with Shiprocket");

  try {
    const response = await axios.post<AuthResponse>(url, {
      email: credentials.email,
      password: credentials.password,
    });

    const token = response.data.token;
    if (!token) {
      throw new Error("Authentication failed: no token received");
    }

    logger.info("Authentication successful");
    return token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        { status: error.response?.status, data: error.response?.data },
        "Authentication failed"
      );
      throw new Error(
        `Authentication failed: ${error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }
}
