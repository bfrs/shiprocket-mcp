const args = process.argv.slice(2);
const transportArg = args.find((arg) => arg.startsWith("--transport="));
const transportArgVal = transportArg?.split("=")[1];

(async () => {
  if (transportArg && transportArgVal === "sse") {
    require("@/transports/sse.js");
    process.env.MCP_TRANSPORT = "SSE";
  } else {
    require("@/transports/stdio.js");
    process.env.MCP_TRANSPORT = "STDIO";
  }
})();
