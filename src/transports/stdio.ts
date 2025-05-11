import { connectionsBySessionId, globalSessionId } from "@/mcp/connections";
import { mcpServer } from "@/mcp/index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";

const transport = new StdioServerTransport();

(async () => {
  try {
    const sellerEmail = process.env.SELLER_EMAIL;
    const sellerPassword = process.env.SELLER_PASSWORD;

    if (!sellerEmail || !sellerPassword) {
      throw new Error("Seller email and password is required in ENV");
    }

    const srApiDomain = "https://apiv2.shiprocket.in";
    const url = `${srApiDomain}/v1/auth/login`;
    const data = (
      await axios.post(url, { email: sellerEmail, password: sellerPassword })
    ).data;

    const sellerToken = data.token as string;

    connectionsBySessionId[globalSessionId] = { transport, sellerToken };
    await mcpServer.connect(transport);
  } catch (err) {
    if (err instanceof axios.AxiosError) {
      console.error({
        success: false,
        error: err.response?.data,
      });
    } else if (err instanceof Error) {
      console.error({
        success: false,
        error: err.message,
      });
    }

    process.exit(1);
  }
})();
