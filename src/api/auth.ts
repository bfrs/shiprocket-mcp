import axios from "axios";
import { SR_API_BASE } from "@/config";
import { logger } from "@/logger";
import type { AuthResponse } from "./types";

export interface AuthCredentials {
  email: string;
  password: string;
}

export class MfaRequiredError extends Error {
  readonly userId: number;
  readonly isSubuser: boolean;
  readonly mfaMessage: string;

  constructor(userId: number, isSubuser: boolean, mfaMessage: string) {
    super(`MFA required: ${mfaMessage}`);
    this.name = "MfaRequiredError";
    this.userId = userId;
    this.isSubuser = isSubuser;
    this.mfaMessage = mfaMessage;
  }
}

export interface ShiprocketAuthOptions {
  email?: string;
  password?: string;
  sellerToken?: string;
  apiBase?: string;
}

export class ShiprocketAuth {
  private email: string;
  private password: string;
  private readonly sellerToken: string | null;
  private readonly apiBase: string;
  private token: string | null = null;
  private pendingMfaUserId: number | null = null;

  constructor(options: ShiprocketAuthOptions) {
    if (options.sellerToken && options.sellerToken.length > 0) {
      this.sellerToken = options.sellerToken;
      this.email = options.email ?? "";
      this.password = options.password ?? "";
    } else {
      if (!options.email || !options.password) {
        throw new Error(
          "ShiprocketAuth requires either sellerToken or both email and password"
        );
      }
      this.sellerToken = null;
      this.email = options.email;
      this.password = options.password;
    }
    this.apiBase = options.apiBase ?? SR_API_BASE;
  }

  isSellerTokenMode(): boolean {
    return this.sellerToken !== null;
  }

  hasPendingMfa(): boolean {
    return this.pendingMfaUserId !== null;
  }

  getToken(): string | null {
    return this.token;
  }

  async login(): Promise<string> {
    if (this.sellerToken) {
      this.token = this.sellerToken;
      logger.info("Using SELLER_TOKEN bypass — skipping login POST");
      return this.token;
    }

    const url = `${this.apiBase}/auth/login`;
    logger.info({ url }, "Authenticating with Shiprocket");

    try {
      const response = await axios.post<AuthResponse | Record<string, unknown>>(
        url,
        { email: this.email, password: this.password }
      );

      const data = (response.data ?? {}) as {
        token?: string;
        is_mfa_enabled?: boolean;
        user_id?: number;
        is_subuser?: boolean;
        data?: string;
      };

      if (data.is_mfa_enabled && typeof data.user_id === "number") {
        this.pendingMfaUserId = data.user_id;
        logger.info(
          { userId: data.user_id },
          "MFA required — call verifyOtp(otp) to complete login"
        );
        throw new MfaRequiredError(
          data.user_id,
          Boolean(data.is_subuser),
          data.data ?? "OTP has been generated"
        );
      }

      if (!data.token) {
        throw new Error("Authentication failed: no token received");
      }

      this.token = data.token;
      logger.info("Authentication successful");
      return this.token;
    } catch (error) {
      if (error instanceof MfaRequiredError) throw error;
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

  async verifyOtp(otp: string): Promise<string> {
    if (this.sellerToken) {
      throw new Error("verifyOtp() is not available in SELLER_TOKEN mode");
    }
    if (this.pendingMfaUserId === null) {
      throw new Error(
        "No pending MFA challenge — call login() first to trigger OTP"
      );
    }
    if (!otp || otp.length === 0) {
      throw new Error("OTP is required");
    }

    const url = `${this.apiBase}/auth/login/verifyOtp`;
    const userId = this.pendingMfaUserId;
    logger.info({ url, userId }, "Verifying Shiprocket OTP");

    try {
      const response = await axios.post<AuthResponse>(url, {
        user_id: userId,
        otp,
      });
      if (!response.data?.token) {
        throw new Error("OTP verification failed: no token received");
      }
      this.token = response.data.token;
      this.pendingMfaUserId = null;
      logger.info("OTP verification successful");
      return this.token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(
          { status: error.response?.status, data: error.response?.data },
          "OTP verification failed"
        );
        throw new Error(
          `OTP verification failed: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }
}

export async function authenticate(
  credentials: AuthCredentials
): Promise<string> {
  return new ShiprocketAuth({
    email: credentials.email,
    password: credentials.password,
  }).login();
}
