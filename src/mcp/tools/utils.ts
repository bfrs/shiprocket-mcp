import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

export const toolWrapper = (
  apiCallFunction: (args: any, srToken: string) => Promise<string>
) => {
  return async (
    args: any,
    context: RequestHandlerExtra<ServerRequest, ServerNotification>
  ) => ({
    content: [
      {
        type: "text" as const,
        text: await apiCallFunction(
          args,
          context._meta?.seller_token as string
        ),
      },
    ],
  });
};
