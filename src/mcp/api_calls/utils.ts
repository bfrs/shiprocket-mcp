import { AxiosError } from "axios";

export const handleAxiosAPIErrorLogging = (
  error: Error
): string | undefined => {
  if (error instanceof AxiosError) {
    console.error(
      `SR API ERROR:\n REQUEST: ${JSON.stringify(
        error.request?._header
      )}\n RESPONSE: ${JSON.stringify(error.response?.data)}}`
    );

    if (error.response?.status === 401) {
      return "TOKEN_EXPIRED";
    } else if (error.response?.data) {
      return JSON.stringify(error.response.data);
    }
  }

  throw error;
};
