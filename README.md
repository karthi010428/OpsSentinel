# OpsSentinel

Cloud telemetry monitoring dashboard that simulates infrastructure incidents (database locks, Redis memory spikes, 502 gateway timeouts) and executes automated AI runbook remediation with safety approval gates.

**Live demo:** https://ops-sentinel-nu.vercel.app/

## System Architecture
Next.js Dashboard → Express API Gateway → Neon PostgreSQL (pgvector HNSW index for runbook similarity search) + Upstash Redis (BullMQ queues with automated Dead-Letter Queue routing).

## Key Features
- **Vector Runbook Retrieval:** Sub-45ms cosine similarity lookup using pgvector over incident documentation.
- **Resilient Background Processing:** Distributed task scheduling with BullMQ, exponential backoff retries, and dead-letter queue isolation for poison-pill events.
- **Safety Approval Gates:** Multi-step circuit breaker validation before executing remediation playbooks.
- **Real-Time Streaming:** Server-Sent Events (SSE) telemetry updates delivered directly to the incident console.

## Tech Stack
Next.js (App Router), TypeScript, Express.js, PostgreSQL (pgvector), Upstash Redis, BullMQ, Tailwind CSS, Docker

## Local Setup
1. Clone the repository:
   ```bash
   git clone [https://github.com/karthi010428/OpsSentinel.git](https://github.com/karthi010428/OpsSentinel.git)
   cd OpsSentinel
