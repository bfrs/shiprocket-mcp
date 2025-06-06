import { AxiosError } from "axios";

export const handleAxiosAPIErrorLogging = (
  error: Error
): string | undefined => {
  if (error instanceof AxiosError) {
    console.log(
      `SR API ERROR:\n REQUEST: ${JSON.stringify(
        error.request?._header
      )}\n RESPONSE: ${JSON.stringify(error.response?.data)}`
    );
    if (error.response?.status === 401) {
      return "TOKEN_EXPIRED";
    }
  }
};
