import express, { Request, Response } from "express";
import cors from "cors";
import { runReActAgentLoop } from "./agent.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "OpsSentinel API Gateway",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/incidents/stream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const initialAlert = {
    id: `log-${Date.now()}-0`,
    timestamp: new Date().toISOString().split("T")[1]?.slice(0, 8) || "00:00:00",
    level: "ERROR",
    source: "HealthCheckService",
    message: "HTTP 504 Gateway Timeout detected on /api/v1/orders. Latency: 12400ms (P99 > 2000ms SLA breach).",
  };
  res.write(`data: ${JSON.stringify(initialAlert)}\n\n`);

  let isAborted = false;
  req.on("close", () => {
    isAborted = true;
  });

  try {
    const agentGenerator = runReActAgentLoop("HTTP 504 Gateway Timeout on /api/v1/orders");

    for await (const event of agentGenerator) {
      if (isAborted) break;

      let level: "INFO" | "WARN" | "ERROR" | "REMEDIATED" = "INFO";
      if (event.type === "REMEDIATION") level = "REMEDIATED";
      if (event.type === "ACTION") level = "WARN";

      const eventData = {
        id: `log-${Date.now()}-${event.step}-${event.type}`,
        timestamp: new Date().toISOString().split("T")[1]?.slice(0, 8) || "00:00:00",
        level,
        source: `[${event.type}] ${event.source}`,
        message: event.message,
      };

      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    }

    if (!isAborted) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (error) {
    console.error("Agent execution error:", error);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[OpsSentinel-API] Server running on http://localhost:${PORT}`);
});