import { API_DOMAINS } from "@/config";
import { connectionsBySessionId, globalSessionId } from "@/mcp/connections";
import { mcpServer } from "@/mcp/index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";

const transport = new StdioServerTransport();

(async () => {
  try {
    console.error("[DEBUG] Starting stdio transport...");

    const sellerEmail = process.env.SELLER_EMAIL;
    const sellerPassword = process.env.SELLER_PASSWORD;

    console.error(`[DEBUG] SELLER_EMAIL: ${sellerEmail ? "set" : "NOT SET"}`);
    console.error(`[DEBUG] SELLER_PASSWORD: ${sellerPassword ? "set" : "NOT SET"}`);

    if (!sellerEmail || !sellerPassword) {
      throw new Error("Seller email and password is required in ENV");
    }

    console.error("[DEBUG] Authenticating with Shiprocket...");
    const url = `${API_DOMAINS.SHIPROCKET}/v1/external/auth/login`;
    const data = (
      await axios.post(url, { email: sellerEmail, password: sellerPassword })
    ).data;

    const sellerToken = data.token as string;
    console.error("[DEBUG] Authentication successful, connecting MCP server...");

    connectionsBySessionId[globalSessionId] = { transport, sellerToken };
    await mcpServer.connect(transport);
    console.error("[DEBUG] MCP server connected!");
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
