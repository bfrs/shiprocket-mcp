import "dotenv/config";

export const API_DOMAINS = {
  SHIPROCKET: process.env.API_BASE_SHIPROCKET ?? "https://apiv2.shiprocket.in",
  SERVICEABILITY:
    process.env.API_BASE_SERVICEABILITY ??
    "https://serviceability.shiprocket.in",
  SR_DASHBOARD:
    process.env.API_BASE_SR_DASHBOARD ?? "https://sr-dashboard.shiprocket.in",
  SR_REPORT:
    process.env.API_BASE_SR_REPORT ?? "https://sr-report.shiprocket.in",
};
