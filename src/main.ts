import * as path from "path";
import * as dotenv from "dotenv";

// Load .env from project root (one level up from dist/)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

(async () => {
  require("@/transports/stdio.js");
  process.env.MCP_TRANSPORT = "STDIO";
})();
