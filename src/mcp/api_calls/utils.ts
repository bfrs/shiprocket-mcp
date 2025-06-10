import { AxiosError } from "axios";

export const handleAxiosAPIErrorLogging = (
  error: Error
): string | undefined => {
  if (error instanceof AxiosError) {
    if (error.response?.status === 401) {
      return "TOKEN_EXPIRED";
    } else if (error.response?.data) {
      const responseData = JSON.stringify(error.response.data);
      console.log(
        `SR API ERROR:\n REQUEST: ${JSON.stringify(
          error.request?._header
        )}\n RESPONSE: ${responseData}}`
      );

      return responseData;
    }
  }
};
