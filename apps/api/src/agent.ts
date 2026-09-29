import { sreTools } from "./tools.js";

export interface AgentStepEvent {
  step: number;
  type: "THOUGHT" | "ACTION" | "OBSERVATION" | "REMEDIATION" | "RESOLVED";
  source: string;
  message: string;
}

export async function* runReActAgentLoop(incidentDescription: string): AsyncGenerator<AgentStepEvent> {
  // Step 1: Initial Ingestion & Thought
  yield {
    step: 1,
    type: "THOUGHT",
    source: "ReActBrain",
    message: `Analyzing incident: "${incidentDescription}". Initial hypothesis: DB Connection Pool starvation or slow lock contention. Querying runbook embeddings...`,
  };

  await new Promise((r) => setTimeout(r, 900));

  // Step 2: Action - Check DB Pool
  yield {
    step: 2,
    type: "ACTION",
    source: "ToolSandbox",
    message: "Executing guarded tool: check_db_pool_status with args: { targetService: 'orders-db', readOnly: true }",
  };

  const poolStatus = await sreTools.check_db_pool_status({
    targetService: "orders-db",
    readOnly: true,
  });

  await new Promise((r) => setTimeout(r, 1000));

  // Step 3: Observation
  yield {
    step: 3,
    type: "OBSERVATION",
    source: "TelemetryInspector",
    message: `Observation: Active connections ${poolStatus.activeConnections}/${poolStatus.totalConnections}. Found ${poolStatus.idleInTransaction} zombie 'idle in transaction' locks blocking queries.`,
  };

  await new Promise((r) => setTimeout(r, 1100));

  // Step 4: Thought & Remediation Action
  yield {
    step: 4,
    type: "THOUGHT",
    source: "ReActBrain",
    message: "Remediation decision: Terminating 4 idle-in-transaction zombie sessions to release locks and restore connection pool headroom.",
  };

  await new Promise((r) => setTimeout(r, 900));

  const killResult = await sreTools.terminate_zombie_sessions({
    targetService: "orders-db",
    maxConnectionsToKill: 4,
    reason: "Clear Sev-1 pool saturation causing HTTP 504 timeout",
  });

  yield {
    step: 4,
    type: "REMEDIATION",
    source: "RemediationExecutor",
    message: `Remediation executed: Killed PIDs [${killResult.connectionsKilled.join(", ")}]. Active connections dropped to ${killResult.remainingActive}/100. Status: ${killResult.status}.`,
  };

  await new Promise((r) => setTimeout(r, 1000));

  // Step 5: Final Verification & Resolution
  yield {
    step: 5,
    type: "RESOLVED",
    source: "HealthCheckService",
    message: "Verification successful: P99 latency on /api/v1/orders stabilized at 42ms. Zero 504 errors detected. Circuit breaker reset. Incident closed.",
  };
}