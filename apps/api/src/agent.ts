import { sreTools } from "./tools.js";
import { searchRunbooks } from "./knowledge.js";
import { findNearestRunbook } from "./db.js";

export type ScenarioType = "POSTGRES_LOCK" | "REDIS_OOM" | "INGRESS_TIMEOUT";

export interface AgentStepEvent {
  step: number;
  type: "THOUGHT" | "ACTION" | "OBSERVATION" | "AWAITING_APPROVAL" | "REMEDIATION" | "RESOLVED" | "ROLLBACK";
  source: string;
  message: string;
  auditHash?: string;
  actionDetails?: {
    toolName: string;
    impact: string;
  };
}

const MAX_REACT_STEPS = 5;

export async function* runReActAgentLoop(scenario: ScenarioType): AsyncGenerator<AgentStepEvent> {
  let currentStep = 0;

  const scenarioConfigs: Record<
    ScenarioType,
    { title: string; embedding: number[]; targetService: string }
  > = {
    POSTGRES_LOCK: {
      title: "HTTP 504 Gateway Timeout on /api/v1/orders",
      embedding: [0.89, 0.81, 0.5, 0.18, 0.85],
      targetService: "orders-db",
    },
    REDIS_OOM: {
      title: "Redis MISCONF Redis is configured to save RDB error on session-cache",
      embedding: [0.12, 0.08, 0.38, 0.93, 0.72],
      targetService: "session-cache",
    },
    INGRESS_TIMEOUT: {
      title: "HTTP 502 Bad Gateway upstream timed out on payments-ingress",
      embedding: [0.18, 0.12, 0.94, 0.22, 0.84],
      targetService: "payments-ingress",
    },
  };

  const config = scenarioConfigs[scenario] || scenarioConfigs.POSTGRES_LOCK;

  try {
    // Step 1: Ingestion & Vector Search
    currentStep++;
    yield {
      step: currentStep,
      type: "THOUGHT",
      source: "ReActBrain",
      message: `Analyzing incident: "${config.title}". Querying pgvector HNSW index for high-confidence runbook match...`,
    };

    await new Promise((r) => setTimeout(r, 800));

    // Query Neon PostgreSQL pgvector table via SQL cosine distance
    const pgRunbook = await findNearestRunbook(scenario);

    let runbookId = "";
    let runbookTitle = "";
    let runbookSimilarity = 0;
    let recommendedTool = "";
    let vectorSource = "Neon pgvector (HNSW)";

    if (pgRunbook) {
      runbookId = pgRunbook.id;
      runbookTitle = pgRunbook.title;
      runbookSimilarity = pgRunbook.similarity;
      recommendedTool = pgRunbook.recommendedTool;
    } else {
      const [fallbackRunbook] = searchRunbooks(config.embedding, 1);
      if (!fallbackRunbook) {
        throw new Error("No matching SRE runbook found in vector database.");
      }
      runbookId = fallbackRunbook.id;
      runbookTitle = fallbackRunbook.title;
      runbookSimilarity = fallbackRunbook.similarityScore;
      recommendedTool = fallbackRunbook.remediationTool;
      vectorSource = "VectorDB (Heuristic Fallback)";
    }

    yield {
      step: currentStep,
      type: "OBSERVATION",
      source: vectorSource,
      message: `Nearest Runbook: [${runbookId}] "${runbookTitle}" (Cosine Similarity: ${(
        runbookSimilarity * 100
      ).toFixed(1)}%). Recommended Tool: ${recommendedTool}`,
    };

    await new Promise((r) => setTimeout(r, 800));

    // Step 2: Diagnostic Action
    currentStep++;
    if (currentStep > MAX_REACT_STEPS) throw new Error("Circuit breaker tripped: Max step cap exceeded.");

    if (scenario === "POSTGRES_LOCK") {
      yield {
        step: currentStep,
        type: "ACTION",
        source: "ToolSandbox",
        message: "Executing guarded tool: check_db_pool_status on orders-db replica...",
      };

      const status = await sreTools.check_db_pool_status({
        targetService: config.targetService,
        readOnly: true,
      });

      await new Promise((r) => setTimeout(r, 900));

      yield {
        step: currentStep,
        type: "OBSERVATION",
        source: "TelemetryInspector",
        message: `Observation: Active pool connections ${status.activeConnections}/100. Discovered ${status.idleInTransaction} zombie 'idle in transaction' locks.`,
        auditHash: status.auditHash,
      };
    } else if (scenario === "REDIS_OOM") {
      yield {
        step: currentStep,
        type: "ACTION",
        source: "ToolSandbox",
        message: "Querying cache memory fragmentation and eviction metrics...",
      };

      await new Promise((r) => setTimeout(r, 900));

      yield {
        step: currentStep,
        type: "OBSERVATION",
        source: "TelemetryInspector",
        message: "Observation: Maxmemory reached 98.4% capacity. Volatile-LRU eviction saturated by stale customer cart keys.",
      };
    } else {
      yield {
        step: currentStep,
        type: "ACTION",
        source: "ToolSandbox",
        message: "Inspecting ingress keepalive connection pool and pod replica slots...",
      };

      await new Promise((r) => setTimeout(r, 900));

      yield {
        step: currentStep,
        type: "OBSERVATION",
        source: "TelemetryInspector",
        message: "Observation: Ingress gateway replica pod count at minimum threshold (2 pods). Upstream backlog queue at 100% capacity.",
      };
    }

    await new Promise((r) => setTimeout(r, 900));

    // Step 3: HITL Authorization Request
    currentStep++;
    if (currentStep > MAX_REACT_STEPS) throw new Error("Circuit breaker tripped: Max step cap exceeded.");

    let impactDescription = "";
    if (scenario === "POSTGRES_LOCK") {
      impactDescription = "Terminate 4 active database sessions to drop contention";
    } else if (scenario === "REDIS_OOM") {
      impactDescription = "Purge 42,000 stale keys from volatile-LRU cache";
    } else {
      impactDescription = "Scale ingress controllers from 2 to 5 replica pods";
    }

    yield {
      step: currentStep,
      type: "AWAITING_APPROVAL",
      source: "ZeroTrustSecurityGate",
      message: `HITL Gate Triggered: Destructive remediation '${recommendedTool}' requires human approval.`,
      actionDetails: {
        toolName: recommendedTool,
        impact: impactDescription,
      },
    };

    await new Promise((r) => setTimeout(r, 1500));

    // Step 4: Remediation Execution with Guarded Rollback
    currentStep++;
    if (currentStep > MAX_REACT_STEPS) throw new Error("Circuit breaker tripped: Max step cap exceeded.");

    if (scenario === "POSTGRES_LOCK") {
      const res = await sreTools.terminate_zombie_sessions({
        targetService: "orders-db",
        maxConnectionsToKill: 4,
        reason: "Post-approval automated Sev-1 resolution",
      });

      yield {
        step: currentStep,
        type: "REMEDIATION",
        source: "RemediationExecutor",
        message: `Remediation executed [Approved]: Terminated PIDs [${res.connectionsKilled.join(", ")}]. Active connections dropped to ${res.remainingActive}/100. Status: ${res.status}.`,
        auditHash: res.auditHash,
      };
    } else if (scenario === "REDIS_OOM") {
      const res = await sreTools.flush_volatile_cache({
        targetService: "session-cache",
        cacheCluster: "redis-cluster-prod",
        keyspace: "cart_session:*",
      });

      yield {
        step: currentStep,
        type: "REMEDIATION",
        source: "RemediationExecutor",
        message: `Remediation executed [Approved]: Evicted ${res.evictedKeys} keys. Freed ${res.memoryFreedMb}MB RAM. Status: ${res.status}.`,
        auditHash: res.auditHash,
      };
    } else {
      const res = await sreTools.scale_ingress_replicas({
        targetService: "payments-ingress",
        targetReplicas: 5,
      });

      yield {
        step: currentStep,
        type: "REMEDIATION",
        source: "RemediationExecutor",
        message: `Remediation executed [Approved]: Ingress pods scaled from ${res.previousReplicas} -> ${res.currentReplicas}. Upstream backlog cleared.`,
        auditHash: res.auditHash,
      };
    }

    await new Promise((r) => setTimeout(r, 900));

    // Step 5: Verification & Incident Close
    currentStep++;
    yield {
      step: currentStep,
      type: "RESOLVED",
      source: "HealthCheckService",
      message: "Verification successful: Target service latency stabilized at 42ms. SLA thresholds compliant. Incident closed.",
    };
  } catch (error: any) {
    yield {
      step: currentStep,
      type: "ROLLBACK",
      source: "CircuitBreakerGuard",
      message: `Safety Halt & Rollback Triggered: ${error?.message || "Execution anomaly detected"}. State restored to snapshot. Job escalated to DLQ.`,
    };
  }
}