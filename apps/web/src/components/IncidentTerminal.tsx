"use client";

import React, { useEffect, useRef, useState } from "react";
import { Terminal, Shield, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "REMEDIATED";
  type?: string;
  source: string;
  message: string;
  incidentId?: string;
  actionId?: string;
  auditHash?: string;
}

interface IncidentTerminalProps {
  logs: LogEntry[];
  isStreaming: boolean;
  onApproveAction?: (actionId: string, decision: "APPROVED" | "REJECTED") => Promise<void>;
}

export function IncidentTerminal({ logs, isStreaming, onApproveAction }: IncidentTerminalProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [submittingActionId, setSubmittingActionId] = useState<string | null>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleDecision = async (actionId: string, decision: "APPROVED" | "REJECTED") => {
    if (!onApproveAction) return;
    try {
      setSubmittingActionId(actionId);
      await onApproveAction(actionId, decision);
    } finally {
      setSubmittingActionId(null);
    }
  };

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-[#0B1120] p-4 font-mono shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            OpsSentinel Telemetry & ReAct Reasoning Feed
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isStreaming ? "bg-emerald-400 animate-ping" : "bg-amber-400"
            }`}
          />
          <span className="text-[11px] text-slate-400">
            {isStreaming ? "LIVE STREAMING" : "STANDBY"}
          </span>
        </div>
      </div>

      <div className="mt-3 max-h-[420px] min-h-[240px] overflow-y-auto space-y-2 pr-2 text-xs">
        {logs.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-slate-500">
            <Shield className="h-8 w-8 text-slate-600 mb-2" />
            <p>No active incidents detected. Ingestion pipeline standing by.</p>
          </div>
        ) : (
          logs.map((log) => {
            let levelBadge = "bg-slate-800 text-slate-300 border-slate-700";
            if (log.level === "WARN") {
              levelBadge = "bg-amber-950/70 text-amber-300 border-amber-800/80";
            } else if (log.level === "ERROR") {
              levelBadge = "bg-rose-950/70 text-rose-300 border-rose-800/80";
            } else if (log.level === "REMEDIATED") {
              levelBadge = "bg-emerald-950/70 text-emerald-300 border-emerald-800/80";
            }

            const isAwaitingApproval = log.type === "AWAITING_APPROVAL" && log.actionId;

            return (
              <div
                key={log.id}
                className="flex flex-col gap-1.5 rounded border border-slate-900/60 bg-slate-950/50 p-2.5 hover:bg-slate-900/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500 font-mono text-[10px]">[{log.timestamp}]</span>
                  <span
                    className={`rounded border px-1.5 py-0.2 text-[9px] font-bold tracking-wide uppercase ${levelBadge}`}
                  >
                    {log.level}
                  </span>
                  <span className="font-semibold text-cyan-300/90 text-xs">{log.source}</span>
                </div>

                <div className="text-slate-300 text-xs leading-relaxed pl-1">{log.message}</div>

                {isAwaitingApproval && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                      <AlertTriangle className="h-4 w-4 animate-bounce" />
                      <span>Security Policy: Action paused for human authorization</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecision(log.actionId!, "APPROVED")}
                        disabled={submittingActionId === log.actionId}
                        className="flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-950"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>{submittingActionId === log.actionId ? "Committing..." : "Approve Fix"}</span>
                      </button>

                      <button
                        onClick={() => handleDecision(log.actionId!, "REJECTED")}
                        disabled={submittingActionId === log.actionId}
                        className="flex items-center gap-1 rounded bg-rose-700 hover:bg-rose-600 px-3 py-1 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-rose-950"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                )}

                {log.auditHash && (
                  <div className="mt-1 text-[10px] text-slate-500 font-mono pl-1">
                    SHA256: <span className="text-slate-400">{log.auditHash}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
