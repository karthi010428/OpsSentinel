import express, { Request, Response } from "express";
import cors from "cors";
import { runReActAgentLoop, ScenarioType } from "./agent.js";
import { incidentQueue } from "./queue.js";
import { dbPool } from "./db.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", async (req: Request, res: Response) => {
  const stats = await incidentQueue.getQueueStats();
  res.json({
    status: "healthy",
    service: "OpsSentinel API Gateway",
    queueStats: stats,
    timestamp: new Date().toISOString(),
  });
});

// DLQ API: List poisoned jobs
app.get("/api/dlq", async (req: Request, res: Response) => {
  try {
    const dlqJobs = await incidentQueue.getDLQ();
    res.json({ success: true, count: dlqJobs.length, jobs: dlqJobs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to fetch DLQ" });
  }
});

// DLQ API: Re-queue a poisoned job
app.post("/api/dlq/:id/retry", async (req: Request, res: Response) => {
  try {
    const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const retriedJob = await incidentQueue.retryDLQJob(jobId);
    if (!retriedJob) {
      return res.status(404).json({ success: false, message: "Job not found in DLQ" });
    }
    res.json({ success: true, message: "Job requeued successfully", job: retriedJob });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to retry DLQ job" });
  }
});

// DLQ API: Test helper to push a poisoned job for UI verification
app.post("/api/dlq/test-fail", async (req: Request, res: Response) => {
  try {
    const testId = `job-test-${Date.now()}`;
    const failedJob = await incidentQueue.failJob(
      testId,
      "Simulated deadlock in transaction buffer (Poison Pill)"
    );
    res.json({ success: true, message: "Poisoned job pushed to DLQ", job: failedJob });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to inject test job" });
  }
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

  const enqueuedJob = await incidentQueue.addJob({
    incidentType: scenario,
    severity: "SEV-1",
    payload: {
      service: targetService,
      endpoint: "/api/v1/workload",
      latencyMs: 12400,
      errorRate: 0.88,
    },
  });

  const stats = await incidentQueue.getQueueStats();

  const queueEvent = {
    id: `log-${Date.now()}-queue`,
    timestamp: new Date().toISOString().split("T")[1]?.slice(0, 8) || "00:00:00",
    level: "WARN",
    source: "[QUEUE] Upstash/BullMQ Orchestrator",
    message: `Job ${enqueuedJob.id} registered into high-priority lane. Scenario: ${scenario}. Pending: ${stats.pendingJobs}. Worker spawned.`,
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

// Runbook Management API: Register a new SRE runbook with vector embeddings
app.post("/api/runbooks", async (req: Request, res: Response) => {
  try {
    const { title, description, scenarioType, recommendedTool, impactLevel, embedding } = req.body;

    if (!title || !scenarioType || !recommendedTool) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const runbookId = `RB-${Date.now().toString().slice(-4)}`;
    // Fallback 3D vector if none supplied: normalized default [0.5, 0.5, 0.5]
    const vectorStr = Array.isArray(embedding)
      ? `[${embedding.join(",")}]`
      : "[0.5, 0.5, 0.5]";

    if (dbPool) {
      const insertQuery = `
        INSERT INTO incident_runbooks (id, title, description, scenario_type, recommended_tool, impact_level, embedding)
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
        RETURNING id, title, scenario_type AS "scenarioType", recommended_tool AS "recommendedTool", impact_level AS "impactLevel";
      `;
      const result = await dbPool.query(insertQuery, [
        runbookId,
        title,
        description || "Dynamic operator runbook",
        scenarioType,
        recommendedTool,
        impactLevel || "MEDIUM",
        vectorStr,
      ]);

      return res.json({ success: true, message: "Runbook persisted to pgvector", runbook: result.rows[0] });
    }

    res.status(503).json({ success: false, error: "Database pool not connected" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to save runbook" });
  }
});

app.listen(PORT, () => {
  console.log(`[OpsSentinel-API] Server running on http://localhost:${PORT}`);
});