import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

(async () => {
  require("@/transports/stdio.js");
  process.env.MCP_TRANSPORT = "STDIO";
})();
