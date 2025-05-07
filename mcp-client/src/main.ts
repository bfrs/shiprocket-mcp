import express from "express";
import chatRouter from "@/routes/chat";
import "dotenv/config";

const PORT = process.env.APP_PORT;

const app = express();

app.use(express.json());

app.use("/chat", chatRouter);

app.listen(PORT, () => console.log(`MCP Client listening on PORT ${PORT}...`));
