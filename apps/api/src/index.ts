import express, { Request, Response } from "express";
import cors from "cors";
import { runReActAgentLoop, ScenarioType } from "./agent.js";
import { incidentQueue } from "./queue.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "OpsSentinel API Gateway",
    queueStats: incidentQueue.getQueueStats(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/incidents/stream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const scenario = (req.query.scenario as ScenarioType) || "POSTGRES_LOCK";

  const targetService =
    scenario === "POSTGRES_LOCK"
      ? "orders-db"
      : scenario === "REDIS_OOM"
      ? "session-cache"
      : "payments-ingress";

  const enqueuedJob = incidentQueue.addJob({
    incidentType: scenario,
    severity: "SEV-1",
    payload: {
      service: targetService,
      endpoint: "/api/v1/workload",
      latencyMs: 12400,
      errorRate: 0.88,
    },
  });

  const queueEvent = {
    id: `log-${Date.now()}-queue`,
    timestamp: new Date().toISOString().split("T")[1]?.slice(0, 8) || "00:00:00",
    level: "WARN",
    source: "[QUEUE] BullMQ Orchestrator",
    message: `Job ${enqueuedJob.id} registered into high-priority lane. Scenario: ${scenario}. Pending: ${incidentQueue.getQueueStats().pendingJobs}. Worker spawned.`,
  };
  res.write(`data: ${JSON.stringify(queueEvent)}\n\n`);

  await new Promise((r) => setTimeout(r, 600));

  let isAborted = false;
  req.on("close", () => {
    isAborted = true;
  });

  try {
    const agentGenerator = runReActAgentLoop(scenario);

    for await (const event of agentGenerator) {
      if (isAborted) break;

      let level: "INFO" | "WARN" | "ERROR" | "REMEDIATED" = "INFO";
      if (event.type === "REMEDIATION") level = "REMEDIATED";
      if (event.type === "ACTION" || event.type === "AWAITING_APPROVAL") level = "WARN";

      const eventData = {
        id: `log-${Date.now()}-${event.step}-${event.type}`,
        timestamp: new Date().toISOString().split("T")[1]?.slice(0, 8) || "00:00:00",
        level,
        source: `[${event.type}] ${event.source}`,
        message: event.message,
        auditHash: event.auditHash,
        actionDetails: event.actionDetails,
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