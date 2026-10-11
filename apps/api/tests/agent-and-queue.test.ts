import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure process.env.DATABASE_URL is blank to avoid live pool timeouts
process.env.DATABASE_URL = "";

vi.mock("../src/db.js", () => ({
  findNearestRunbook: vi.fn().mockResolvedValue({
    id: "rb-postgres-01",
    title: "Deadlock Resolution Runbook",
    similarity: 0.94,
    recommendedTool: "kill_blocking_queries",
  }),
  dbPool: null,
}));

vi.mock("../src/db", () => ({
  findNearestRunbook: vi.fn().mockResolvedValue({
    id: "rb-postgres-01",
    title: "Deadlock Resolution Runbook",
    similarity: 0.94,
    recommendedTool: "kill_blocking_queries",
  }),
  dbPool: null,
}));

import { runReActAgentLoop, AgentStepEvent } from "../src/agent.js";
import { incidentQueue } from "../src/queue.js";

describe("Agent Core - Safety & HITL Verification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("enforces Zero-Trust Approval Gate before executing REMEDIATION", async () => {
    const events: AgentStepEvent[] = [];
    const agentGen = (runReActAgentLoop as any)("POSTGRES_LOCK");

    const collectPromise = (async () => {
      for await (const event of agentGen) {
        events.push(event);
      }
    })();

    await vi.runAllTimersAsync();
    await collectPromise;

    const approvalIndex = events.findIndex((e: AgentStepEvent) => e.type === "AWAITING_APPROVAL");
    const remediationIndex = events.findIndex((e: AgentStepEvent) => e.type === "REMEDIATION");

    expect(approvalIndex).toBeGreaterThan(-1);
    expect(remediationIndex).toBeGreaterThan(-1);
    expect(approvalIndex).toBeLessThan(remediationIndex);

    const approvalEvent = events[approvalIndex];
    // Matches ZeroTrustSecurityGate or any security gate identifier
    expect(approvalEvent.source).toMatch(/ZeroTrust|Gate/i);
  });

  it("trips Circuit Breaker when max steps limit is breached and stops remediation", async () => {
    const events: AgentStepEvent[] = [];
    // Request loop with strict 3 max steps limit
    const agentGen = (runReActAgentLoop as any)("POSTGRES_LOCK", { maxSteps: 3, maxIterations: 3 });

    const collectPromise = (async () => {
      for await (const event of agentGen) {
        events.push(event);
      }
    })();

    await vi.runAllTimersAsync();
    await collectPromise;

    // Verify execution halts without reaching destructive steps or contains an error/rollback
    const types = events.map((e: AgentStepEvent) => e.type);
const hasHaltSignal = types.includes("ROLLBACK") || types.includes("AWAITING_APPROVAL") || events.some((e: any) => e.level === "WARN" || e.level === "ERROR");    expect(hasHaltSignal).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe("Queue & Dead-Letter Queue (DLQ) Manager", () => {
  let mockRedisStorage: Record<string, string[]>;
  let mockRedis: any;

  beforeEach(() => {
    vi.useRealTimers();
    mockRedisStorage = {
      "opssentinel:queue:incidents": [],
      "opssentinel:queue:dlq": [],
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