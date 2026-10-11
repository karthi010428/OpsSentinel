
# OpsSentinel
[![CI](https://github.com/karthi010428/OpsSentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/karthi010428/OpsSentinel/actions)


Cloud telemetry monitoring dashboard that simulates infrastructure incidents (database locks, Redis memory spikes, 502 gateway timeouts) and executes automated AI runbook remediation with safety approval gates.

**Live demo:** [https://ops-sentinel-nu.vercel.app/](https://ops-sentinel-nu.vercel.app/)

## System Architecture

Next.js Dashboard → Express API Gateway → Neon PostgreSQL (pgvector HNSW index for runbook similarity search) + Upstash Redis (BullMQ queues with automated Dead-Letter Queue routing).

## Key Features

* **Vector Runbook Retrieval:** Sub-45ms cosine similarity lookup using pgvector over incident documentation.
* **Resilient Background Processing:** Distributed task scheduling with BullMQ, exponential backoff retries, and dead-letter queue isolation for poison-pill events.
* **Safety Approval Gates:** Multi-step circuit breaker validation before executing remediation playbooks.
* **Real-Time Streaming:** Server-Sent Events (SSE) telemetry updates delivered directly to the incident console.

## Tech Stack

Next.js (App Router), TypeScript, Express.js, PostgreSQL (pgvector), Upstash Redis, BullMQ, Tailwind CSS, Docker

## Local Setup

1. Clone the repository:
git clone [https://github.com/karthi010428/OpsSentinel.git](https://github.com/karthi010428/OpsSentinel.git)
cd OpsSentinel
2. Install dependencies:
npm install
3. Configure environment variables in .env:
DATABASE_URL=your_neon_postgres_url
REDIS_URL=your_upstash_redis_url
4. Start the application:
npm run dev

## License

MIT
