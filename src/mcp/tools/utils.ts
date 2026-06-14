import { AxiosError } from "axios";
import { logger } from "@/logger";

export interface ToolResponse {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function createToolSuccess(data: unknown): ToolResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
  };
}

export function createToolError(
  error: unknown,
  fallbackMessage: string
): ToolResponse {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message || error.message;
    logger.error({ message }, "Axios error in tool");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            message: fallbackMessage,
          }),
        },
      ],
      isError: true,
    };
  } else if (error instanceof Error) {
    logger.error(error.stack, "Error in tool");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            message: fallbackMessage,
          }),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: false,
          message: fallbackMessage,
        }),
      },
    ],
    isError: true,
  };
}

export async function withToolErrorHandling<T>(
  fn: () => Promise<T>,
  fallbackMessage: string
): Promise<ToolResponse> {
  try {
    const result = await fn();
    return createToolSuccess(result);
  } catch (error) {
    return createToolError(error, fallbackMessage);
  }
}
