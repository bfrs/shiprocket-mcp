import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerServiceabilityTools } from "./serviceability";
import { registerOrderTools } from "./orders";
import { registerShippingTools } from "./shipping";
import { registerSettingsTools } from "./settings";
import { registerNdrTools } from "./ndr";
import { registerReturnTools } from "./returns";
import { registerManifestTools, registerInvoiceTools } from "./manifest";

export function initializeTools(server: McpServer): void {
  registerServiceabilityTools(server);
  registerOrderTools(server);
  registerShippingTools(server);
  registerSettingsTools(server);
  registerNdrTools(server);
  registerReturnTools(server);
  registerManifestTools(server);
  registerInvoiceTools(server);
}
