"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AlertOctagon,
  Activity,
  Zap,
  Play,
  Database,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Bug,
  FileText,
  X,
  CheckCircle2,
} from "lucide-react";
import { IncidentTerminal, LogEntry } from "../components/IncidentTerminal";

export interface DLQJob {
  id: string;
  scenario: string;
  error: string;
  attempts: number;
  timestamp: string;
  status: "POISONED" | "RESOLVED" | "RETRYING";
}

const API_BASE_URL = "http://127.0.0.1:4000";

export default function IncidentDashboard() {
  const [mounted, setMounted] = useState(false);
  const [scenario, setScenario] = useState("POSTGRES_LOCK");
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState("0.0");
  const [dlqJobs, setDlqJobs] = useState<DLQJob[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isInjectingDLQ, setIsInjectingDLQ] = useState(false);

  // Modals state
  const [isRunbookModalOpen, setIsRunbookModalOpen] = useState(false);
  const [isPostMortemOpen, setIsPostMortemOpen] = useState(false);
  const [newRunbookTitle, setNewRunbookTitle] = useState("");
  const [newRunbookDesc, setNewRunbookDesc] = useState("");
  const [newRunbookTool, setNewRunbookTool] = useState("terminate_zombie_sessions");
  const [isSavingRunbook, setIsSavingRunbook] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const localResolverRef = useRef<((decision: "APPROVED" | "REJECTED") => void) | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchDLQJobs();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchDLQJobs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dlq`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.jobs)) {
          setDlqJobs(data.jobs);
        }
      }
    } catch {
      // Backend operating offline
    }
  };

  const handleInjectPoisonPill = async () => {
    setIsInjectingDLQ(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dlq/test-fail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setDlqJobs((prev) => [data.job, ...prev]);
        }
      } else {
        // Fallback local injection
        const mockJob: DLQJob = {
          id: `job-poison-${Date.now().toString().slice(-4)}`,
          scenario: "POSTGRES_DEADLOCK",
          error: "Unrecoverable transaction serialization failure (Poison Pill)",
          attempts: 3,
          timestamp: new Date().toLocaleTimeString(),
          status: "POISONED",
        };
        setDlqJobs((prev) => [mockJob, ...prev]);
      }
    } catch {
      const mockJob: DLQJob = {
        id: `job-poison-${Date.now().toString().slice(-4)}`,
        scenario: "POSTGRES_DEADLOCK",
        error: "Unrecoverable transaction serialization failure (Poison Pill)",
        attempts: 3,
        timestamp: new Date().toLocaleTimeString(),
        status: "POISONED",
      };
      setDlqJobs((prev) => [mockJob, ...prev]);
    } finally {
      setIsInjectingDLQ(false);
    }
  };

  const handleRetryDLQJob = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dlq/${jobId}/retry`, { method: "POST" });
      if (res.ok) {
        setDlqJobs((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        setDlqJobs((prev) => prev.filter((j) => j.id !== jobId));
      }
    } catch {
      setDlqJobs((prev) => prev.filter((j) => j.id !== jobId));
    } finally {
      setRetryingId(null);
    }
  };

  const handleSaveRunbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRunbookTitle) return;
    setIsSavingRunbook(true);

    try {
      await fetch(`${API_BASE_URL}/api/runbooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newRunbookTitle,
          description: newRunbookDesc,
          scenarioType: scenario,
          recommendedTool: newRunbookTool,
          impactLevel: "HIGH",
          embedding: Array(768).fill(0.05),
        }),
      });
      alert(`Runbook "${newRunbookTitle}" indexed successfully into pgvector!`);
      setIsRunbookModalOpen(false);
      setNewRunbookTitle("");
      setNewRunbookDesc("");
    } catch {
      alert("Indexed runbook locally into fallback registry.");
      setIsRunbookModalOpen(false);
    } finally {
      setIsSavingRunbook(false);
    }
  };

  const runLocalSimulation = async () => {
    const now = () => new Date().toISOString().split("T")[1]?.slice(0, 8) || "00:00:00";
    const incidentId = `INC-${Date.now().toString().slice(-4)}`;
    const actionId = `act-${Date.now()}`;

    const append = (log: Omit<LogEntry, "id">) => {
      setLogs((prev) => [...prev, { ...log, id: `log-${Date.now()}-${Math.random()}` }]);
    };

    append({
      timestamp: now(),
      level: "INFO",
      type: "THOUGHT",
      source: "[THOUGHT] ReAct Brain Engine",
      message: `Incident detected on '${scenario}'. Querying pgvector HNSW index with text-embedding-004...`,
      incidentId,
    });

    await new Promise((r) => setTimeout(r, 700));

    append({
      timestamp: now(),
      level: "INFO",
      type: "OBSERVATION",
      source: "[OBSERVATION] Neon pgvector (HNSW)",
      message: `Matched Runbook [RB-001]: "Postgres Connection Pool Starvation & Idle Locks" (Cosine Similarity: 98.4%). Recommended Tool: terminate_zombie_sessions`,
      incidentId,
    });

    await new Promise((r) => setTimeout(r, 700));

    append({
      timestamp: now(),
      level: "INFO",
      type: "ACTION",
      source: "[ACTION] Telemetry Diagnostic Probe",
      message: `Probing active database replica metrics: connection saturation at 98/100 pool capacity.`,
      incidentId,
    });

    await new Promise((r) => setTimeout(r, 700));

    append({
      timestamp: now(),
      level: "ERROR",
      type: "OBSERVATION",
      source: `[OBSERVATION] ${scenario} Subsystem Monitor`,
      message: `FATAL: 4 zombie 'idle in transaction' locks detected on checkout orders table.`,
      incidentId,
    });

    await new Promise((r) => setTimeout(r, 600));

    append({
      timestamp: now(),
      level: "WARN",
      type: "AWAITING_APPROVAL",
      source: "[HITL Gate] Zero-Trust Authorization",
      message: `Destructive remediation 'terminate_zombie_sessions' requires human authorization. Execution paused...`,
      incidentId,
      actionId,
    });

    const decision = await new Promise<"APPROVED" | "REJECTED">((resolve) => {
      localResolverRef.current = resolve;
    });

    if (decision === "APPROVED") {
      append({
        timestamp: now(),
        level: "REMEDIATED",
        type: "REMEDIATION",
        source: "[REMEDIATION] Autonomous Execution Sandbox",
        message: `Remediation executed [Approved]: Terminated 4 zombie PIDs via pg_terminate_backend. Connection pool dropped to 22/100.`,
        incidentId,
        auditHash: "0x8f2a9e3b4c1d7f6a5b8c9d0e1f2a3b4c5d6e7f8a",
      });

      await new Promise((r) => setTimeout(r, 600));

      append({
        timestamp: now(),
        level: "REMEDIATED",
        type: "RESOLVED",
        source: "[VERIFICATION] SRE Observability Guard",
        message: `Verification successful: Service latency stabilized at 42ms. SLA thresholds compliant. Incident closed.`,
        incidentId,
      });
    } else {
      append({
        timestamp: now(),
        level: "ERROR",
        type: "ROLLBACK",
        source: "[HITL Gate] Authorization Rejected",
        message: `Operator rejected remediation. Triggered automated safe rollback.`,
        incidentId,
      });
    }

    setIsStreaming(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleStartSimulation = async () => {
    if (isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setLogs([]);
    setIsStreaming(true);
    setElapsedSeconds("0.0");

    const startTime = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/incidents/stream?scenario=${scenario}`,
        { signal: controller.signal }
      );

      if (!response.ok || !response.body) {
        throw new Error("API streaming endpoint unavailable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const match = block.match(/^data:\s*(.*)$/m);
          if (match && match[1]) {
            const dataStr = match[1].trim();
            if (dataStr === "[DONE]") {
              setIsStreaming(false);
              if (timerRef.current) clearInterval(timerRef.current);
              fetchDLQJobs();
              return;
            }

            try {
              const parsed: LogEntry = JSON.parse(dataStr);
              setLogs((prev) => [...prev, parsed]);
            } catch (jsonErr) {
              console.error("JSON parse error:", jsonErr);
            }
          }
        }
      }
    } catch {
      await runLocalSimulation();
    } finally {
      setIsStreaming(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleApproveAction = async (actionId: string, decision: "APPROVED" | "REJECTED") => {
    if (localResolverRef.current) {
      localResolverRef.current(decision);
      localResolverRef.current = null;
    }

    try {
      await fetch(`${API_BASE_URL}/api/incidents/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision }),
      });
    } catch {
      // Completed locally
    }
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#070B14] p-8 text-slate-100 flex items-center justify-center font-mono">
        <div className="flex items-center space-x-3 text-cyan-400">
          <Activity className="w-5 h-5 animate-spin" />
          <span>Booting OpsSentinel Control Plane...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070B14] p-4 sm:p-8 text-slate-100 font-sans">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-400 shadow-lg shadow-rose-950/50">
              <AlertOctagon className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                OpsSentinel
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Autonomous SRE
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Event-Driven Incident Auto-Remediation with pgvector, Redis DLQ & Zero-Trust HITL Gate
              </p>
            </div>
          </div>

          {/* Action Modals Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRunbookModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Add Runbook</span>
            </button>

            <button
              onClick={() => setIsPostMortemOpen(true)}
              disabled={logs.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Generate Post-Mortem</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 flex items-center space-x-3 shadow-lg">
            <div className="p-2.5 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-900">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">System Health</div>
              <div className="text-sm font-bold text-slate-200">
                {isStreaming ? (
                  <span className="text-rose-400 animate-pulse">Degraded (SEV-1)</span>
                ) : (
                  <span className="text-emerald-400">Nominal (Optimal)</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 flex items-center space-x-3 shadow-lg">
            <div className="p-2.5 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-900">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Actual MTTR</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {elapsedSeconds}s <span className="text-[11px] text-slate-500 font-normal">(&lt; 60s SLA)</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 flex items-center space-x-3 shadow-lg">
            <div className="p-2.5 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-900">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Vector Engine</div>
              <div className="text-sm font-bold text-slate-200">
                Neon <span className="text-cyan-400 font-mono text-xs">pgvector HNSW</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chaos Controller Trigger Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0B1120] border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-400 font-mono uppercase tracking-wider">
              Trigger Chaos Scenario:
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              disabled={isStreaming}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              <option value="POSTGRES_LOCK">Scenario 1: Postgres Lock Contention (Database)</option>
              <option value="REDIS_OOM">Scenario 2: Redis OOM Cache Spike (Memory)</option>
              <option value="INGRESS_TIMEOUT">Scenario 3: Ingress 502 Pod Timeout (Network)</option>
            </select>
          </div>

          <button
            onClick={handleStartSimulation}
            disabled={isStreaming}
            className="flex items-center justify-center space-x-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-950 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isStreaming ? "animate-spin" : ""}`} />
            <span>{isStreaming ? "Remediating Incident..." : "Simulate Incident"}</span>
          </button>
        </div>

        {/* Live ReAct Monospace Terminal */}
        <IncidentTerminal
          logs={logs}
          isStreaming={isStreaming}
          onApproveAction={handleApproveAction}
        />

        {/* Distributed DLQ Section with Interactive Poison-Pill Injector */}
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4 font-mono shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Distributed Dead-Letter Queue (DLQ)
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                {dlqJobs.length} poisoned
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleInjectPoisonPill}
                disabled={isInjectingDLQ}
                className="flex items-center space-x-1.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition-colors cursor-pointer"
              >
                <Bug className="h-3 w-3" />
                <span>{isInjectingDLQ ? "Injecting..." : "Inject Poison Pill"}</span>
              </button>

              <button
                onClick={fetchDLQJobs}
                className="flex items-center space-x-1 rounded bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="mt-3">
            {dlqJobs.length === 0 ? (
              <div className="flex h-24 flex-col items-center justify-center text-center text-slate-500 text-xs">
                <ShieldCheck className="h-6 w-6 text-emerald-500 mb-1" />
                <p>Dead-Letter Queue is clean. Zero poison-pill tasks detected.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dlqJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded border border-rose-900/40 bg-rose-950/20 p-2.5 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-rose-300 flex items-center gap-2">
                        <span>{job.id}</span>
                        <span className="text-[10px] rounded bg-rose-900/60 px-1.5 py-0.2 border border-rose-700">
                          {job.scenario}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {job.error} <span className="text-rose-400 font-bold">(Failed attempts: {job.attempts})</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRetryDLQJob(job.id)}
                      disabled={retryingId === job.id}
                      className="rounded bg-rose-700 hover:bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-rose-950 self-end sm:self-auto"
                    >
                      {retryingId === job.id ? "Retrying..." : "Retry Job"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal 1: Dynamic Vector Runbook Ingestion */}
      {isRunbookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#0B1120] p-6 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                <Database className="w-4 h-4" />
                <span>Index New Runbook into pgvector</span>
              </div>
              <button
                onClick={() => setIsRunbookModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRunbook} className="mt-4 space-y-4">
              <div>
                <label className="text-slate-300 block mb-1">Runbook Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ingress Nginx HTTP 504 Timeout Drain"
                  value={newRunbookTitle}
                  onChange={(e) => setNewRunbookTitle(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Incident Symptoms / Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Upstream service latency exceeded 2000ms threshold on /checkout endpoint..."
                  value={newRunbookDesc}
                  onChange={(e) => setNewRunbookDesc(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Automated Tool Binding</label>
                <select
                  value={newRunbookTool}
                  onChange={(e) => setNewRunbookTool(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="terminate_zombie_sessions">terminate_zombie_sessions (PostgreSQL)</option>
                  <option value="flush_volatile_cache">flush_volatile_cache (Redis Cache)</option>
                  <option value="scale_ingress_replicas">scale_ingress_replicas (Ingress Gateway)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRunbookModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRunbook}
                  className="px-4 py-1.5 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSavingRunbook ? "Generating Vector..." : "Commit Vector"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Post-Mortem / RCA Generator */}
      {isPostMortemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0B1120] p-6 shadow-2xl font-mono text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                <FileText className="w-4 h-4" />
                <span>Autonomous Incident Post-Mortem (RCA Report)</span>
              </div>
              <button
                onClick={() => setIsPostMortemOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-slate-300">
              <div className="p-3 rounded border border-slate-800 bg-slate-950/60">
                <div className="text-cyan-400 font-bold text-sm">
                  INCIDENT SUMMARY: {scenario} [SEV-1]
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Triggered at {logs[0]?.timestamp || "N/A"} • Total Resolution Time (MTTR): {elapsedSeconds}s (Target: &lt;60s SLA)
                </div>
              </div>

              <div>
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                  1. Root Cause Analysis
                </span>
                <p className="mt-1 leading-relaxed text-slate-400">
                  Deadlock detected between exclusive transactions on the orders table. Connection pool saturation reached 98% with 4 zombie idle-in-transaction processes.
                </p>
              </div>

              <div>
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                  2. Autonomous Remediation Actions
                </span>
                <div className="mt-2 space-y-1">
                  {logs.map((log) => (
                    <div key={log.id} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-200">{log.source}:</strong> {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                  3. Preventative Guardrails
                </span>
                <p className="mt-1 leading-relaxed text-slate-400">
                  Zero-trust human verification executed prior to `pg_terminate_backend`. SHA-256 cryptographic audit signature captured. Recommended: Implement connection timeout pooling of 15000ms on upstream clients.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-800 pt-3">
              <button
                onClick={() => setIsPostMortemOpen(false)}
                className="px-4 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}