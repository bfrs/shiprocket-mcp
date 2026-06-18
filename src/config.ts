export const API_DOMAINS = {
  SHIPROCKET: process.env.API_BASE_SHIPROCKET ?? "https://apiv2.shiprocket.in",
  SERVICEABILITY:
    process.env.API_BASE_SERVICEABILITY ??
    "https://serviceability.shiprocket.in",
};

export const SR_API_BASE =
  process.env.SR_API_BASE ?? `${API_DOMAINS.SHIPROCKET}/v1/external`;
