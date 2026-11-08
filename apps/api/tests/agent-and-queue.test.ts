import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "";
process.env.REDIS_URL = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

vi.mock("../src/db.js", () => ({
  findNearestRunbookByVector: vi.fn().mockResolvedValue({
    id: "RB-001",
    title: "Deadlock Resolution Runbook",
    similarity: 0.94,
    recommendedTool: "terminate_zombie_sessions",
  }),
  dbPool: null,
}));

vi.mock("../src/db", () => ({
  findNearestRunbookByVector: vi.fn().mockResolvedValue({
    id: "RB-001",
    title: "Deadlock Resolution Runbook",
    similarity: 0.94,
    recommendedTool: "terminate_zombie_sessions",
  }),
  dbPool: null,
}));

import { runReActAgentLoop, AgentStepEvent, resolveApprovalDecision } from "../src/agent.js";
import { incidentQueue, QUEUE_ACTIVE_KEY, QUEUE_DLQ_KEY } from "../src/queue.js";

describe("Agent Core - Safety & HITL Verification", () => {
  it("enforces Zero-Trust Approval Gate before executing REMEDIATION", async () => {
    const events: AgentStepEvent[] = [];
    const agentGen = runReActAgentLoop("POSTGRES_LOCK", "INC-TEST-001");

    let step = await agentGen.next();
    while (!step.done) {
      events.push(step.value);
      if (step.value.type === "AWAITING_APPROVAL") {
        break;
      }
      step = await agentGen.next();
    }

    const approvalEvent = events.find((e) => e.type === "AWAITING_APPROVAL");
    expect(approvalEvent).toBeDefined();
    expect(approvalEvent?.source).toMatch(/Zero-Trust|Gate/i);
    expect(approvalEvent?.actionId).toBeDefined();

    resolveApprovalDecision(approvalEvent!.actionId!, "APPROVED");

    step = await agentGen.next();
    while (!step.done) {
      events.push(step.value);
      step = await agentGen.next();
    }

    const approvalIndex = events.findIndex((e) => e.type === "AWAITING_APPROVAL");
    const remediationIndex = events.findIndex((e) => e.type === "REMEDIATION");

    expect(approvalIndex).toBeGreaterThan(-1);
    expect(remediationIndex).toBeGreaterThan(-1);
    expect(approvalIndex).toBeLessThan(remediationIndex);
  });

  it("trips Circuit Breaker and triggers safe rollback when operator rejects", async () => {
    const events: AgentStepEvent[] = [];
    const agentGen = runReActAgentLoop("POSTGRES_LOCK", "INC-TEST-002");

    let step = await agentGen.next();
    while (!step.done) {
      events.push(step.value);
      if (step.value.type === "AWAITING_APPROVAL") {
        break;
      }
      step = await agentGen.next();
    }

    const approvalEvent = events.find((e) => e.type === "AWAITING_APPROVAL");
    expect(approvalEvent).toBeDefined();

    resolveApprovalDecision(approvalEvent!.actionId!, "REJECTED");

    step = await agentGen.next();
    while (!step.done) {
      events.push(step.value);
      step = await agentGen.next();
    }

    const rollbackEvent = events.find((e) => e.type === "ROLLBACK");
    expect(rollbackEvent).toBeDefined();
    expect(rollbackEvent?.level).toBe("ERROR");
  });
});

describe("Queue & Dead-Letter Queue (DLQ) Manager", () => {
  let mockRedisStorage: Record<string, string[]>;
  let mockRedis: any;

  beforeEach(() => {
    mockRedisStorage = {
      [QUEUE_ACTIVE_KEY]: [],
      [QUEUE_DLQ_KEY]: [],
    };

    mockRedis = {
      lpush: vi.fn(async (key: string, val: string) => {
        if (!mockRedisStorage[key]) mockRedisStorage[key] = [];
        mockRedisStorage[key].unshift(val);
        return mockRedisStorage[key].length;
      }),
      lrange: vi.fn(async (key: string, start: number, stop: number) => {
        const arr = mockRedisStorage[key] || [];
        if (stop === -1) return arr.slice(start);
        return arr.slice(start, stop + 1);
      }),
      lrem: vi.fn(async (key: string, _count: number, val: string) => {
        if (!mockRedisStorage[key]) return 0;
        const idx = mockRedisStorage[key].indexOf(val);
        if (idx !== -1) {
          mockRedisStorage[key].splice(idx, 1);
          return 1;
        }
        return 0;
      }),
      llen: vi.fn(async (key: string) => (mockRedisStorage[key] || []).length),
    };

    (incidentQueue as any).redis = mockRedis;
  });

  it("isolates poisoned/failed jobs directly into the Dead-Letter Queue", async () => {
    const failed = await incidentQueue.failJob("job-sample-123", "Database timeout exceeded");

    expect(failed).not.toBeNull();
    expect(["POISONED", "DLQ"]).toContain(failed?.status);
    expect(failed?.attempts).toBeGreaterThanOrEqual(2);
    expect(failed?.errorReason).toBe("Database timeout exceeded");

    const dlq = await incidentQueue.getDLQ();
    expect(dlq).toHaveLength(1);
    expect(dlq[0].id).toBe("job-sample-123");
  });

  it("retries DLQ job: removes from DLQ and requeues into Main Queue with 0 attempts", async () => {
    await incidentQueue.failJob("job-retry-999", "OOM Exception");

    const retried = await incidentQueue.retryDLQJob("job-retry-999");

    expect(retried).not.toBeNull();
    expect(retried?.status).toBe("QUEUED");
    expect(retried?.attempts).toBe(0);

    const dlq = await incidentQueue.getDLQ();
    expect(dlq.find((j: any) => j.id === "job-retry-999")).toBeUndefined();
  });
});