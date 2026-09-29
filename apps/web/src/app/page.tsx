"use client";

import React, { useState, useRef } from "react";
import { IncidentTerminal, TerminalLog } from "@/components/IncidentTerminal";
import { AlertOctagon, Play, Square, Activity, Database, Server, ShieldCheck, ChevronDown } from "lucide-react";

type Scenario = "POSTGRES_LOCK" | "REDIS_OOM" | "INGRESS_TIMEOUT";

export default function IncidentDashboard() {
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("POSTGRES_LOCK");
  const [hitlPrompt, setHitlPrompt] = useState<{ toolName: string; impact: string } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const triggerSimulation = () => {
    if (isStreaming) return;

    setLogs([]);
    setIsStreaming(true);
    setHitlPrompt(null);

    const eventSource = new EventSource(`http://localhost:4000/api/incidents/stream?scenario=${scenario}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsStreaming(false);
        setHitlPrompt(null);
        return;
      }

      try {
        const parsedLog = JSON.parse(event.data);
        if (parsedLog.actionDetails) {
          setHitlPrompt(parsedLog.actionDetails);
        }
        setLogs((prev) => [...prev, parsedLog]);
      } catch (err) {
        console.error("Failed to parse event", err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsStreaming(false);
    };
  };

  const clearLogs = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setLogs([]);
    setIsStreaming(false);
    setHitlPrompt(null);
  };

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-red-400">
              <AlertOctagon className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              OpsSentinel Control Plane
            </h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Autonomous SRE Platform • Multi-Vector Chaos Engine & Zero-Trust HITL Gate
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Scenario Selector Dropdown */}
          <div className="relative">
            <select
              value={scenario}
              disabled={isStreaming}
              onChange={(e) => setScenario(e.target.value as Scenario)}
              className="appearance-none bg-[#0E1526] border border-gray-700 hover:border-gray-500 rounded-md px-3 py-2 pr-8 text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              <option value="POSTGRES_LOCK">Scenario 1: Postgres Lock Contention (DB)</option>
              <option value="REDIS_OOM">Scenario 2: Redis OOM Cache Spike (Memory)</option>
              <option value="INGRESS_TIMEOUT">Scenario 3: Ingress 502 Bad Gateway (Network)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <button
            onClick={triggerSimulation}
            disabled={isStreaming}
            className="flex items-center space-x-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-semibold text-sm transition-colors shadow-lg shadow-emerald-950/40"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Simulate Incident</span>
          </button>

          <button
            onClick={clearLogs}
            className="flex items-center space-x-2 px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors border border-gray-700"
          >
            <Square className="w-4 h-4" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* HITL Live Authorization Toast/Banner */}
      {hitlPrompt && (
        <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-600/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded bg-amber-900/60 text-amber-300">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-amber-200">
                Zero-Trust HITL Approval Gate: Action Required
              </div>
              <div className="text-xs text-amber-300/80">
                Tool: <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">{hitlPrompt.toolName}</code> • Impact: {hitlPrompt.impact}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-emerald-400 font-mono font-semibold uppercase tracking-wider bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded">
              Verified Auto-Approved by SRE Policy
            </span>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[#0E1526] border border-gray-800 flex items-center space-x-4">
          <div className="p-3 rounded-md bg-blue-950/60 text-blue-400 border border-blue-900">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-400">System Status</div>
            <div className="text-sm font-semibold text-slate-200">
              {isStreaming ? (
                <span className="text-amber-400">Degraded (Sev-1 In Progress)</span>
              ) : (
                <span className="text-emerald-400">Nominal (All Systems Go)</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#0E1526] border border-gray-800 flex items-center space-x-4">
          <div className="p-3 rounded-md bg-purple-950/60 text-purple-400 border border-purple-900">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-400">Vector Knowledge Base</div>
            <div className="text-sm font-semibold text-slate-200">pgvector HNSW (Ready)</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#0E1526] border border-gray-800 flex items-center space-x-4">
          <div className="p-3 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-900">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-400">Orchestrator Queue</div>
            <div className="text-sm font-semibold text-slate-200">BullMQ (Connected)</div>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <IncidentTerminal logs={logs} isStreaming={isStreaming} />
      </div>
    </main>
  );
}