const args = process.argv.slice(2);
const transportArg = args.find((arg) => arg.startsWith("--transport="));
const transportArgVal = transportArg?.split("=")[1];

(async () => {
  if (transportArg && transportArgVal === "sse") {
    process.env.MCP_TRANSPORT = "STREAMABLE_HTTP";
    require("@/transports/streamable-http");
  } else {
    process.env.MCP_TRANSPORT = "STDIO";
    require("@/transports/stdio.js");
  }
})();
