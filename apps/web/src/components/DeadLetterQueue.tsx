"use client";

import React, { useState, useEffect } from "react";
import { AlertOctagon, RotateCw, CheckCircle2, ShieldAlert } from "lucide-react";

interface DLQJob {
  id: string;
  incidentType: string;
  severity: string;
  payload: {
    service: string;
    endpoint: string;
    latencyMs: number;
    errorRate: number;
  };
  queuedAt: number;
  status: string;
  attempts?: number;
  errorReason?: string;
}

export function DeadLetterQueue({ apiUrl }: { apiUrl: string }) {
  const [jobs, setJobs] = useState<DLQJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchDLQ = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/api/dlq`);
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
      }
    } catch {
      // Quiet fail if API temporarily sleeping or offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDLQ();
    const interval = setInterval(fetchDLQ, 10000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const handleRetry = async (jobId: string) => {
    try {
      setRetryingId(jobId);
      const res = await fetch(`${apiUrl}/api/dlq/${jobId}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      }
    } catch {
      // retry failed
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-rose-500 animate-pulse" />
          <h2 className="text-base font-semibold text-slate-100 tracking-wide">
            Distributed Dead-Letter Queue (DLQ)
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
            {jobs.length} poisoned
          </span>
        </div>
        <button
          onClick={fetchDLQ}
          disabled={loading}
          className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {jobs.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mb-2" />
            <p className="text-sm font-medium text-slate-400">Dead-Letter Queue is Clean</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Zero poison-pill jobs detected. All incident tasks dispatched cleanly via Redis.
            </p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="bg-slate-950/60 border border-rose-900/30 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span className="text-slate-200 font-semibold">{job.incidentType}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">{job.payload.service}</span>
                  <span className="text-rose-400 bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-800/40 text-[10px]">
                    Max Retries Exceeded ({job.attempts || 2}/2)
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] truncate max-w-md">
                  Reason: <span className="text-rose-300">{job.errorReason || "Worker execution threshold timeout"}</span>
                </p>
              </div>

              <button
                onClick={() => handleRetry(job.id)}
                disabled={retryingId === job.id}
                className="self-start sm:self-center px-3 py-1.5 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1.5"
              >
                <RotateCw className={`w-3 h-3 ${retryingId === job.id ? "animate-spin" : ""}`} />
                {retryingId === job.id ? "Re-queuing..." : "Re-queue to Active"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}