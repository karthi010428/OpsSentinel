# OpsSentinel

> Autonomous SRE platform featuring semantic runbook retrieval, a ReAct agent loop, zero-trust Human-in-the-Loop (HITL) safety gates, and distributed poison-pill Dead-Letter Queues (DLQ).

---

## Architecture Overview


                          +------------------------+
                          |   Next.js Dashboard    |
                          | (Control Plane & Tele) |
                          +-----------+------------+
                                      |
                           Server-Sent Events (SSE)
                           & REST API Requests
                                      v
                          +------------------------+
                          |    Express API Server  |
                          |      (Node / TS)       |
                          +-----------+------------+
                                      |
            +-------------------------+-------------------------+
            |                                                   |
            v                                                   v
+-----------------------+                           +-----------------------+
|  Neon PostgreSQL DB   |                           |     Upstash Redis     |
| (pgvector + HNSW)     |                           |   (BullMQ Task Queue) |
| - Cosine Similarity   |                           | - High-Priority Lane  |
| - Dynamic Runbooks    |                           | - Dead-Letter Queue   |
+-----------------------+                           +-----------------------+
            ^                                                   ^
            |                                                   |
            +-------------------------+-------------------------+
                                      |
                                      v
                          +------------------------+
                          |   ReAct Agent Brain    |
                          |  (AsyncGenerator Loop) |
                          | - 5-Step Cap Breaker   |
                          | - Zero-Trust HITL Gate |
                          | - Remediation Sandbox  |
                          +------------------------+

Key Capabilities

Semantic Runbook Retrieval (pgvector & HNSW)
Incident telemetry vectors queried against indexed runbooks using cosine distance (<=>).
Dynamic operator runbook registration endpoint (POST /api/runbooks) with automated vector indexing.
ReAct Reasoning Engine
Implemented via an asynchronous generator pattern (AsyncGenerator<AgentStepEvent>).
Streams granular steps (THOUGHT, ACTION, OBSERVATION, AWAITING_APPROVAL, REMEDIATION, RESOLVED, ROLLBACK) via Server-Sent Events (SSE).
Zero-Trust Safety & Circuit Breaker
Human-in-the-Loop (HITL) gate halts destructive actions (DROP, FLUSH, KILL) pending policy authorization.
5-step circuit breaker prevents infinite agent loops; halts and routes failures to snapshot rollback.
Distributed Task Queue & DLQ
High-throughput job execution backed by Redis and BullMQ.
Dead-Letter Queue isolates poison-pill tasks with manual review and retry mechanisms.


Tech StackLayerTechnologies

Frontend              Next.js (App Router), React, Tailwind CSS, Lucide Icons
BackendAPI            Node.js, Express.js, TypeScript
VectorDatabase        Neon Serverless PostgreSQL with pgvector & HNSW indexing
Task Queue & Cache    Upstash Redis, BullMQ
Deployment            Render (API Web Service), Vercel / Render Static (Web App)



API Reference
Incident Simulation Stream
Endpoint: GET /api/incidents/stream?scenario={SCENARIO}

Format: text/event-stream (SSE)

Scenarios: POSTGRES_LOCK, REDIS_OOM, INGRESS_TIMEOUT


Runbook Management
Endpoint: POST /api/runbooks

Payload:

JSON
{
  "title": "Postgres Lock Contention Handler",
  "description": "Auto-purge idle sessions holding locks on core tables",
  "scenarioType": "POSTGRES_LOCK",
  "recommendedTool": "terminate_zombie_sessions",
  "impactLevel": "HIGH",
  "embedding": [0.89, 0.81, 0.5, 0.18, 0.85]
}


Dead-Letter Queue (DLQ)
List Jobs: GET /api/dlq

Retry Job: POST /api/dlq/:id/retry

Simulate Poison Pill: POST /api/dlq/test-fail

Getting Started Locally
Prerequisites
Node.js >= 18.x

PostgreSQL with vector extension or a Neon database connection string

Redis instance (Upstash or local)


Installation
Clone the repository:

Bash
git clone [https://github.com/karthi010428/OpsSentinel.git](https://github.com/karthi010428/OpsSentinel.git)
cd OpsSentinel
Install workspace dependencies:

Bash
npm install
Configure environment variables in apps/api/.env:

Code snippet
PORT=4000
DATABASE_URL="postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require"
REDIS_URL="rediss://default:password@endpoint.upstash.io:6379"
Build all workspaces:

Bash
npm run build --workspace=@opssentinel/api
npm run build --workspace=@opssentinel/web
Start development servers:

Bash
# Start API server
npm run dev --workspace=@opssentinel/api

# In a separate terminal, start Next.js frontend
npm run dev --workspace=@opssentinel/web