# OpsSentinel Control Plane
[![OpsSentinel CI](https://github.com/karthi010428/OpsSentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/karthi010428/OpsSentinel/actions)

> **Autonomous Systems Reliability Engineering (SRE) Agent & Live Telemetry Inspector**  
> An enterprise-grade, zero-trust autonomous incident remediation engine that detects Sev-1 outages, matches runbooks via high-dimensional vector search, and safely executes self-healing runbooks within strict Human-in-the-Loop (HITL) governance bounds.

---

## Architecture Overview
                                  +------------------------------------+
                                  |     Next.js 15 / React 19 UI       |
                                  | (SSE Stream, SVG Sparkline, HITL)  |
                                  +-----------------+------------------+
                                                    ^
                                                    | EventSource (SSE)
                                                    v
                                  +-----------------+------------------+
                                  |    Express API Control Plane       |
                                  +-----------------+------------------+
                                                    |
                +-----------------------------------+-----------------------------------+
                |                                   |                                   |
                v                                   v                                   v
+-----------------------+           +-----------------------+           +-----------------------+
|  BullMQ FIFO Queue    |           |   ReAct Agent Brain   |           |  pgvector RAG Engine  |
| Priority Lane Manager |           | (Generator Loop v1)   |           | Cosine Distance Index |
+-----------------------+           +-----------+-----------+           +-----------------------+
|
v
+-----------+-----------+
|   Zero-Trust Sandbox  |
| Zod Schema + SHA-256  |
+-----------+-----------+
|
+-------------------+-------------------+
|                                       |
v                                       v
[Non-Destructive Probes]                [Remediation Actuators]
- DB Replica Pool Status                - Kill Zombie Sessions
- Cache Memory Check                    - Purge Volatile Keys
- Ingress Slot Check                    - Scale Gateway Pods


---

## Core Capabilities

- **Multi-Vector Chaos Engine:** Simulates real-world infrastructure failures across three core domains:
  - **Database:** Postgres lock contention and connection pool exhaustion (HTTP 504).
  - **Memory:** Redis OOM volatile-LRU cache saturation.
  - **Network:** Ingress Nginx upstream keepalive exhaustion (HTTP 502).
- **Autonomous ReAct Agent Loop:** Implemented using TypeScript generator functions (`async function*`) to stream thought processes, tool invocations, and observations in real time without blocking.
- **Runbook Vector Matching (RAG):** Uses cosine similarity against pre-computed infrastructure runbook embeddings to deterministically identify remediation procedures with >99% confidence.
- **Zero-Trust Human-in-the-Loop (HITL) Gate:** Enforces read-only safety by default. Destructive mutations (e.g., terminating sessions, flushing memory) pause at an authorization gate before execution.
- **Cryptographic Audit Ledger:** Computes SHA-256 checksums over tool payloads and arguments for compliance and tamper-proof incident logs.
- **Real-Time Observability & RCA Generator:** 
  - Dynamic SVG P99 latency sparkline showing recovery from 12,400ms down to 42ms.
  - Active MTTR (Mean Time to Remediate) stopwatch ticker (~6.4s).
  - One-click Post-Mortem / RCA generator compiling timelines, root causes, and preventative measures.

---

## Tech Stack

- **Monorepo:** npm Workspaces, TypeScript (Strict ESM)
- **Frontend (`apps/web`):** Next.js 15, React 19, Tailwind CSS, Lucide Icons
- **Backend API (`apps/api`):** Node.js, Express, TypeScript, Server-Sent Events (SSE)
- **Validation & Security:** Zod runtime validation, Node crypto SHA-256
- **Architecture Patterns:** ReAct (Reasoning + Acting), Vector RAG, FIFO Queue Orchestration

---

## Quick Start (100% Free & Local)

### 1. Install Dependencies
```bash
npm install
2. Start Both Web and API Services
Bash
# Terminal 1: Backend API (Port 4000)
npm run dev --workspace=@opssentinel/api

# Terminal 2: Web Dashboard (Port 3000)
npm run dev --workspace=@opssentinel/web
3. Open Control Plane
Visit http://localhost:3000 in your browser, pick a failure scenario, and click "Simulate Incident".


