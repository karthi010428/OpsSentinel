import { sreTools } from "./tools.js";
import { searchRunbooks } from "./knowledge.js";

export type ScenarioType = "POSTGRES_LOCK" | "REDIS_OOM" | "INGRESS_TIMEOUT";

export interface AgentStepEvent {
  step: number;
  type: "THOUGHT" | "ACTION" | "OBSERVATION" | "AWAITING_APPROVAL" | "REMEDIATION" | "RESOLVED";
  source: string;
  message: string;
  auditHash?: string;
  actionDetails?: {
    toolName: string;
    impact: string;
  };
}

export async function* runReActAgentLoop(scenario: ScenarioType): AsyncGenerator<AgentStepEvent> {
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

  // Step 1: Ingestion & Vector Search
  yield {
    step: 1,
    type: "THOUGHT",
    source: "ReActBrain",
    message: `Analyzing incident: "${config.title}". Querying pgvector HNSW index for high-confidence runbook match...`,
  };

  await new Promise((r) => setTimeout(r, 800));

  const [matchedRunbook] = searchRunbooks(config.embedding, 1);
  if (!matchedRunbook) {
    throw new Error("No matching SRE runbook found in vector database.");
  }

  yield {
    step: 1,
    type: "OBSERVATION",
    source: "VectorDB (pgvector)",
    message: `Nearest Runbook: [${matchedRunbook.id}] "${matchedRunbook.title}" (Cosine Similarity: ${(
      matchedRunbook.similarityScore * 100
    ).toFixed(1)}%). Recommended Tool: ${matchedRunbook.remediationTool}`,
  };

  await new Promise((r) => setTimeout(r, 800));

  // Step 2 & 3: Diagnostic Observation depending on scenario
  if (scenario === "POSTGRES_LOCK") {
    yield {
      step: 2,
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
      step: 3,
      type: "OBSERVATION",
      source: "TelemetryInspector",
      message: `Observation: Active pool connections ${status.activeConnections}/100. Discovered ${status.idleInTransaction} zombie 'idle in transaction' locks.`,
      auditHash: status.auditHash,
    };
  } else if (scenario === "REDIS_OOM") {
    yield {
      step: 2,
      type: "ACTION",
      source: "ToolSandbox",
      message: "Querying cache memory fragmentation and eviction metrics...",
    };

    await new Promise((r) => setTimeout(r, 900));

    yield {
      step: 3,
      type: "OBSERVATION",
      source: "TelemetryInspector",
      message: "Observation: Maxmemory reached 98.4% capacity. Volatile-LRU eviction saturated by stale customer cart keys.",
    };
  } else {
    yield {
      step: 2,
      type: "ACTION",
      source: "ToolSandbox",
      message: "Inspecting ingress keepalive connection pool and pod replica slots...",
    };

    await new Promise((r) => setTimeout(r, 900));

    yield {
      step: 3,
      type: "OBSERVATION",
      source: "TelemetryInspector",
      message: "Observation: Ingress gateway replica pod count at minimum threshold (2 pods). Upstream backlog queue at 100% capacity.",
    };
  }

  await new Promise((r) => setTimeout(r, 900));

  // Step 4: Human-in-the-Loop Authorization Request
  let impactDescription = "";
  if (scenario === "POSTGRES_LOCK") {
    impactDescription = "Terminate 4 active database sessions to drop contention";
  } else if (scenario === "REDIS_OOM") {
    impactDescription = "Purge 42,000 stale keys from volatile-LRU cache";
  } else {
    impactDescription = "Scale ingress controllers from 2 to 5 replica pods";
  }

  yield {
    step: 4,
    type: "AWAITING_APPROVAL",
    source: "ZeroTrustSecurityGate",
    message: `HITL Gate Triggered: Destructive remediation '${matchedRunbook.remediationTool}' requires human approval.`,
    actionDetails: {
      toolName: matchedRunbook.remediationTool,
      impact: impactDescription,
    },
  };

  // Wait 1.5 seconds simulating approval verification
  await new Promise((r) => setTimeout(r, 1500));

  // Step 5: Remediation Execution
  if (scenario === "POSTGRES_LOCK") {
    const res = await sreTools.terminate_zombie_sessions({
      targetService: "orders-db",
      maxConnectionsToKill: 4,
      reason: "Post-approval automated Sev-1 resolution",
    });

    yield {
      step: 4,
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
      step: 4,
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
      step: 4,
      type: "REMEDIATION",
      source: "RemediationExecutor",
      message: `Remediation executed [Approved]: Ingress pods scaled from ${res.previousReplicas} -> ${res.currentReplicas}. Upstream backlog cleared.`,
      auditHash: res.auditHash,
    };
  }

  await new Promise((r) => setTimeout(r, 900));

  // Step 6: Verification
  yield {
    step: 5,
    type: "RESOLVED",
    source: "HealthCheckService",
    message: "Verification successful: Target service latency stabilized at 42ms. SLA thresholds compliant. Incident closed.",
  };
}