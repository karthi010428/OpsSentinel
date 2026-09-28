"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, ShieldAlert, Cpu, CheckCircle2, AlertTriangle } from "lucide-react";

export interface TerminalLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "REMEDIATED";
  message: string;
  source: string;
}

interface IncidentTerminalProps {
  logs: TerminalLog[];
  incidentId?: string;
  isStreaming?: boolean;
}

export function IncidentTerminal({
  logs,
  incidentId = "INC-8942-PROD",
  isStreaming = false,
}: IncidentTerminalProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getLevelBadge = (level: TerminalLog["level"]) => {
    switch (level) {
      case "ERROR":
        return <span className="text-red-400 font-bold">[ERROR]</span>;
      case "WARN":
        return <span className="text-amber-400 font-bold">[WARN]</span>;
      case "REMEDIATED":
        return <span className="text-emerald-400 font-bold">[AUTO-FIXED]</span>;
      default:
        return <span className="text-blue-400 font-bold">[INFO]</span>;
    }
  };

  return (
    <div className="w-full rounded-lg border border-gray-800 bg-[#070A11] shadow-2xl overflow-hidden font-mono text-xs md:text-sm">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0D1321] border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-200 font-semibold tracking-wider">
            OpsSentinel Active Brain Telemetry
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
            {incidentId}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {isStreaming ? (
            <span className="flex items-center space-x-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE REASONING</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-gray-600" />
              <span>STANDBY</span>
            </span>
          )}
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="p-4 h-[420px] overflow-y-auto space-y-2 selection:bg-emerald-500 selection:text-black">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-600">
            <span>Awaiting incident event triggers or telemetry streams...</span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
              <span className="text-gray-500 select-none">[{log.timestamp}]</span>
              <span className="select-none">{getLevelBadge(log.level)}</span>
              <span className="text-purple-400 font-medium select-none">[{log.source}]</span>
              <span className="text-slate-300 break-words flex-1">{log.message}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* SRE Quick Metrics Footer */}
      <div className="px-4 py-2.5 bg-[#090D17] border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Agent: ReAct Loop v1</span>
          </span>
          <span className="flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Circuit Breaker: 5-step cap</span>
          </span>
        </div>
        <span className="text-gray-500">Read-Only DB Sandbox Enforced</span>
      </div>
    </div>
  );
}