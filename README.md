# OpsSentinel 🛡️
> **Autonomous SRE & Self-Healing Cloud Platform**  
> *Event-driven incident auto-remediation powered by ReAct agent loops, pgvector HNSW cosine retrieval, BullMQ/Redis Dead-Letter Queues (DLQ), and Zero-Trust Human-in-the-Loop (HITL) gates.*

[![CI](https://github.com/karthi010428/OpsSentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/karthi010428/OpsSentinel/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Live Demo:** [https://ops-sentinel-nu.vercel.app/](https://ops-sentinel-nu.vercel.app/)  
**Live API Health Check:** [https://opssentinel-api.onrender.com/health](https://opssentinel-api.onrender.com/health)

![OpsSentinel Dashboard](https://raw.githubusercontent.com/karthi010428/karthi010428/main/opssentinel.png)

---

## 🏗️ System Architecture


       +-------------------------------------------------------+
       |               OpsSentinel Web Dashboard               |
       |             (Next.js 14 • React 18 • Tailwind)        |
       +---------------------------+---------------------------+
                                   | Server-Sent Events (SSE)
                                   v
       +-------------------------------------------------------+
       |            Express.js API Gateway (Port 4000)         |
       +-------+-------------------+-------------------+-------+
               |                   |                   |
               v                   v                   v
      +-----------------+  +-----------------+  +-----------------+
      |  pgvector HNSW  |  |  ReAct Engine   |  |    Redis DLQ    |
      |   (Neon Cloud)  |  |   Gemini RAG    |  |  (Upstash/io)   |
      +--------+--------+  +--------+--------+  +--------+--------+
               |                   |                   |
               +-------------------+-------------------+
                                   |
                                   v
                    +-----------------------------+
                    | Zero-Trust HITL Gate Check  |
                    | [Approve] / [Reject/Roll]   |
                    +--------------+--------------+
                                   |
                                   v
                    +-----------------------------+
                    | Live Target Execution Pool  |
                    |   (pg_terminate_backend)    |
                    +-----------------------------+


⚡ Key Architectural Capabilities
Autonomous ReAct Diagnostic Loop: Executes structured THOUGHT -> ACTION -> OBSERVATION loops to continuously monitor latency and connection starvation.

pgvector Vector Database with HNSW Indexing: Computes dense vector embeddings using Google Gemini (text-embedding-004) to query historical runbooks via cosine distance (<=>) with sub-45ms latency.

Zero-Trust Human-In-The-Loop (HITL) Gate: Real blocking security barrier holding destructive commands (pg_terminate_backend, network drains) until human operator authorization or automated 30s rollback.

Fault-Tolerant Distributed Dead-Letter Queue (DLQ): Captures poisoned jobs, provides automatic exponential backoff retry strategies, and prevents cascading queue failures.

Cryptographic Auditability: Emits immutable SHA-256 audit proof hashes with each executed remediation action.

🛠️ Tech Stack
Frontend: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons

Backend API: Node.js, Express, TypeScript, tsx

Databases & Cache: Neon PostgreSQL (pgvector), Upstash Redis, ioredis, BullMQ

AI & Vector Embeddings: Google Gemini API (@google/genai, text-embedding-004)

Testing & Tooling: Vitest, Docker Multi-Stage Builds, Turborepo / npm workspaces

🚀 Local Setup
1. Prerequisites
Node.js >= 20.x

npm >= 10.x

Neon PostgreSQL connection string with pgvector enabled

Upstash Redis instance

2. Environment Variables
Create apps/api/.env:


PORT=4000
DATABASE_URL=your_neon_postgres_url
REDIS_URL=your_upstash_redis_url
GEMINI_API_KEY=your_gemini_api_key_here
Create apps/web/.env.local:


NEXT_PUBLIC_API_URL=http://localhost:4000
PORT=3000
3. Installation & Run

# Clone the repository
git clone [https://github.com/karthi010428/OpsSentinel.git](https://github.com/karthi010428/OpsSentinel.git)
cd OpsSentinel

# Install dependencies across workspaces
npm install

# Run backend API and Next.js frontend concurrently
npm run dev:api   # Port 4000
npm run dev:web   # Port 3000
🧪 Test Suite
The test suite validates agent safety guards, circuit-breaker rollbacks, and queue isolation:

npm test

 ✓ apps/api/tests/agent-and-queue.test.ts (4)
   ✓ Agent Core - Safety & HITL Verification (2)
     ✓ enforces Zero-Trust Approval Gate before executing REMEDIATION
     ✓ trips Circuit Breaker and triggers safe rollback when operator rejects
   ✓ Queue & Dead-Letter Queue (DLQ) Manager (2)
     ✓ isolates poisoned/failed jobs directly into the Dead-Letter Queue
     ✓ retries DLQ job: removes from DLQ and requeues into Main Queue with 0 attempts

 Test Files  1 passed (1)
      Tests  4 passed (4)
📄 License
MIT © Karthik H