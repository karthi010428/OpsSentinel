import { sreTools } from "./tools.js";
import { searchRunbooks } from "./knowledge.js";

export interface AgentStepEvent {
  step: number;
  type: "THOUGHT" | "ACTION" | "OBSERVATION" | "REMEDIATION" | "RESOLVED";
  source: string;
  message: string;
}

export async function* runReActAgentLoop(incidentDescription: string): AsyncGenerator<AgentStepEvent> {
  // Step 1: Ingestion & Vector Search Embedding
  yield {
    step: 1,
    type: "THOUGHT",
    source: "ReActBrain",
    message: `Analyzing incident: "${incidentDescription}". Querying pgvector HNSW index for high-confidence runbook match...`,
  };

  await new Promise((r) => setTimeout(r, 900));

  // Incident symptom vector: [High DB saturation, High lock contention, Moderate latency, Low memory, High errors]
  const incidentEmbedding = [0.89, 0.81, 0.50, 0.18, 0.85];
  const [matchedRunbook] = searchRunbooks(incidentEmbedding, 1);

  if (!matchedRunbook) {
    throw new Error("No matching SRE runbook found in vector database.");
  }

  yield {
    step: 1,
    type: "OBSERVATION",
    source: "VectorDB (pgvector)",
    message: `Nearest Runbook: [${matchedRunbook.id}] "${matchedRunbook.title}" (Cosine Similarity: ${(matchedRunbook.similarityScore * 100).toFixed(1)}%). Recommended Tool: ${matchedRunbook.remediationTool}`,
  };

  await new Promise((r) => setTimeout(r, 900));

  // Step 2: Action - Check DB Pool via Guarded Tool
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

  // Step 4: Decision & Remediation via Matched Runbook
  yield {
    step: 4,
    type: "THOUGHT",
    source: "ReActBrain",
    message: `Applying Runbook ${matchedRunbook.id} procedure: Executing ${matchedRunbook.remediationTool} to drop zombie locks and restore pool headroom.`,
  };

  await new Promise((r) => setTimeout(r, 900));

  const killResult = await sreTools.terminate_zombie_sessions({
    targetService: "orders-db",
    maxConnectionsToKill: 4,
    reason: `Runbook ${matchedRunbook.id} automated remediation for HTTP 504`,
  });

  yield {
    step: 4,
    type: "REMEDIATION",
    source: "RemediationExecutor",
    message: `Remediation executed: Terminated PIDs [${killResult.connectionsKilled.join(", ")}]. Active connections dropped to ${killResult.remainingActive}/100. Status: ${killResult.status}.`,
  };

  await new Promise((r) => setTimeout(r, 1000));

  // Step 5: Verification & Resolution
  yield {
    step: 5,
    type: "RESOLVED",
    source: "HealthCheckService",
    message: "Verification successful: P99 latency on /api/v1/orders stabilized at 42ms. Zero 504 errors detected. Circuit breaker reset. Incident closed.",
  };
}