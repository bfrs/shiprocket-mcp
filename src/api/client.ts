import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { API_DOMAINS } from "@/config";
import { logger } from "@/logger";
import {
  ShiprocketAuth,
  authenticate,
  type AuthCredentials,
} from "./auth";

export interface ShiprocketClientOptions {
  credentials?: AuthCredentials;
  auth?: ShiprocketAuth;
}

export class ShiprocketClient {
  private axiosInstance: AxiosInstance;
  private auth: ShiprocketAuth;
  private token: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private refreshAttempts = 0;
  private readonly maxRefreshAttempts = 2;
  private readonly refreshCooldownMs = 5 * 60 * 1000;
  private lastRefreshAttemptTime = 0;

  constructor(options: ShiprocketClientOptions) {
    if (options.auth) {
      this.auth = options.auth;
    } else if (options.credentials) {
      this.auth = new ShiprocketAuth({
        email: options.credentials.email,
        password: options.credentials.password,
      });
    } else {
      throw new Error("ShiprocketClient requires either auth or credentials");
    }

    this.axiosInstance = axios.create({
      baseURL: API_DOMAINS.SHIPROCKET,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  private setupRequestInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  private setupResponseInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        if (!originalRequest) {
          return Promise.reject(error);
        }

        if (this.auth.isSellerTokenMode()) {
          return Promise.reject(error);
        }

        if (
          error.response?.status === 401 &&
          !originalRequest._retry
        ) {
          const now = Date.now();
          if (now - this.lastRefreshAttemptTime > this.refreshCooldownMs) {
            this.refreshAttempts = 0;
          }

          if (this.refreshAttempts < this.maxRefreshAttempts) {
            originalRequest._retry = true;

            try {
              const newToken = await this.refreshToken();
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.axiosInstance(originalRequest);
            } catch (refreshError) {
              logger.error(
                refreshError,
                "Token refresh failed, request cannot be retried"
              );
              return Promise.reject(refreshError);
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<string> {
    if (this.auth.isSellerTokenMode()) {
      throw new Error("Token refresh is disabled in SELLER_TOKEN mode");
    }

    if (this.refreshPromise) {
      logger.info("Token refresh already in progress, waiting...");
      return this.refreshPromise;
    }

    this.refreshAttempts++;
    this.lastRefreshAttemptTime = Date.now();
    logger.info(
      { attempt: this.refreshAttempts },
      "Refreshing Shiprocket token"
    );

    this.refreshPromise = this.auth
      .login()
      .then((token) => {
        this.token = token;
        this.refreshAttempts = 0;
        logger.info("Token refreshed successfully");
        return token;
      })
      .catch((error) => {
        logger.error(error, "Token refresh failed");
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async initialize(): Promise<void> {
    if (!this.token) {
      this.token = await this.auth.login();
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isSellerTokenMode(): boolean {
    return this.auth.isSellerTokenMode();
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }
}

export function createShiprocketClient(
  credentials: AuthCredentials
): ShiprocketClient {
  return new ShiprocketClient({ credentials });
}

export { authenticate };
