import express, { Request, Response } from "express";
import cors from "cors";
import { incidentQueue } from "./queue.js";
import { dbPool } from "./db.js";
import { runReActAgentLoop, resolveApprovalDecision } from "./agent.js";
import * as ioredisModule from "ioredis";

const RedisClient: any =
  (ioredisModule as any).default || (ioredisModule as any).Redis || ioredisModule;

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Root Check
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "online",
    service: "OpsSentinel Autonomous SRE Core",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Health Probe
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    service: "OpsSentinel API Gateway",
    timestamp: new Date().toISOString(),
  });
});

// SSE Streaming Route with immediate chunk flushing
app.get("/api/incidents/stream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const scenario = (req.query.scenario as string) || "POSTGRES_LOCK";
  const incidentId = `INC-${Date.now().toString().slice(-4)}`;

  try {
    const agentGenerator = runReActAgentLoop(scenario, incidentId);

    for await (const event of agentGenerator) {
      const sseLog = {
        id: `log-${Date.now()}-${event.stepNumber}`,
        timestamp: new Date().toISOString().split("T")[1]?.slice(0, 8) || "00:00:00",
        level: event.level,
        type: event.type,
        source: event.source,
        message: event.message,
        incidentId: event.incidentId,
        actionId: event.actionId,
        auditHash: event.auditHash,
      };

      res.write(`data: ${JSON.stringify(sseLog)}\n\n`);

      if (event.type !== "AWAITING_APPROVAL") {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    const errorLog = {
      id: `err-${Date.now()}`,
      timestamp: new Date().toISOString().split("T")[1]?.slice(0, 8) || "00:00:00",
      level: "ERROR",
      source: "[CRITICAL] ReAct Engine Failure",
      message: error?.message || "Unexpected agent runtime exception",
      incidentId,
    };
    res.write(`data: ${JSON.stringify(errorLog)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// Human-In-The-Loop Approval Endpoint
app.post("/api/incidents/approve", async (req: Request, res: Response) => {
  const { actionId, decision } = req.body;

  if (!actionId || !decision) {
    return res.status(400).json({ success: false, error: "actionId and decision are required" });
  }

  const resolvedMemory = resolveApprovalDecision(actionId, decision);

  if (process.env.REDIS_URL) {
    try {
      const pub = new RedisClient(process.env.REDIS_URL, { connectTimeout: 5000, lazyConnect: true });
      await pub.connect();
      await pub.publish(`ops:approval:${actionId}`, decision);
      pub.disconnect();
    } catch (err: any) {
      console.warn("[Approval] Redis publish warning:", err.message);
    }
  }

  return res.json({
    success: true,
    message: `Decision '${decision}' committed for action ${actionId}`,
    resolved: resolvedMemory,
  });
});

// DLQ Routes
app.get("/api/dlq", async (_req: Request, res: Response) => {
  try {
    const dlqJobs = await incidentQueue.getDLQ();
    res.json({ success: true, count: dlqJobs.length, jobs: dlqJobs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to fetch DLQ" });
  }
});

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

app.listen(PORT, () => {
  console.log(`[OpsSentinel-API] Server running on http://localhost:${PORT}`);
});