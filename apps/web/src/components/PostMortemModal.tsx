"use client";

import React from "react";
import { FileText, X, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";

interface PostMortemModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: string;
  mttrSeconds: string;
  timelineLogs: string[];
}

export function PostMortemModal({
  isOpen,
  onClose,
  scenario,
  mttrSeconds,
  timelineLogs,
}: PostMortemModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0B1120] border border-gray-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-[#0E1526]">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-emerald-950/80 border border-emerald-700 text-emerald-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Enterprise SRE Incident Post-Mortem (RCA)
              </h2>
              <p className="text-xs text-gray-400">
                Ticket: INC-8942-PROD • Incident Class: SEV-1 • Scope: Critical
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-md bg-gray-800/60 hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto font-sans text-sm text-gray-300">
          {/* Executive Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800">
              <div className="text-xs text-gray-400">Mean Time To Remediate</div>
              <div className="text-lg font-mono font-bold text-emerald-400">{mttrSeconds}s</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800">
              <div className="text-xs text-gray-400">Availability Impact</div>
              <div className="text-lg font-mono font-bold text-amber-400">99.94% (SLA Maintained)</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800">
              <div className="text-xs text-gray-400">Governance Gate</div>
              <div className="text-lg font-mono font-bold text-blue-400">Zero-Trust HITL Passed</div>
            </div>
          </div>

          {/* Root Cause Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Root Cause & Trigger Sequence</span>
            </h3>
            <div className="p-3.5 rounded-lg bg-gray-950 border border-gray-800 font-mono text-xs leading-relaxed text-slate-300">
              Target service encountered critical performance degradation under scenario [{scenario}].
              Vector embeddings matched corporate runbook catalog with &gt;99% cosine confidence. Non-destructive
              sandbox probes verified infrastructure saturation before safe automated remediation execution.
            </div>
          </div>

          {/* Incident Timeline Ledger */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Audit-Verified Action Trail</span>
            </h3>
            <div className="p-3.5 rounded-lg bg-black/60 border border-gray-800 font-mono text-xs space-y-1.5 max-h-44 overflow-y-auto">
              {timelineLogs.map((log, idx) => (
                <div key={idx} className="text-gray-400 truncate">
                  <span className="text-gray-600 mr-2">[{idx + 1}]</span>
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Action Items */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Preventative Engineering Measures</span>
            </h3>
            <ul className="list-disc list-inside text-xs text-gray-400 space-y-1 pl-1">
              <li>Increase autonomous circuit-breaker sensitivity threshold on upstream gateway ingress.</li>
              <li>Tune connection pool keep-alive timeout values in application deployment manifests.</li>
              <li>Promote matched runbook embeddings into Tier-0 automated cache index.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#0E1526] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold transition-colors"
          >
            Close Post-Mortem
          </button>
        </div>
      </div>
    </div>
  );
}