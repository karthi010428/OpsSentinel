"use client";

import React, { useState, useRef } from "react";
import { IncidentTerminal, TerminalLog } from "@/components/IncidentTerminal";
import { AlertOctagon, Play, Square, Activity, Database, Server } from "lucide-react";

export default function IncidentDashboard() {
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const triggerSimulation = () => {
    if (isStreaming) return;

    setLogs([]);
    setIsStreaming(true);

    const eventSource = new EventSource("http://localhost:4000/api/incidents/stream");
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsStreaming(false);
        return;
      }

      try {
        const parsedLog: TerminalLog = JSON.parse(event.data);
        setLogs((prev) => [...prev, parsedLog]);
      } catch (err) {
        console.error("Failed to parse log event", err);
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
  };

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-6">
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
            Autonomous Systems Reliability Engineering Agent & Live Telemetry Inspector
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={triggerSimulation}
            disabled={isStreaming}
            className="flex items-center space-x-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-semibold text-sm transition-colors shadow-lg shadow-emerald-950/40"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Simulate Sev-1 Incident</span>
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center space-x-2 px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors border border-gray-700"
          >
            <Square className="w-4 h-4" />
            <span>Clear Terminal</span>
          </button>
        </div>
      </div>

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