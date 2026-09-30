"use client";

import React, { useState } from "react";

interface RunbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (runbook: any) => void;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://opssentinel-api.onrender.com";

export default function RunbookModal({ isOpen, onClose, onSuccess }: RunbookModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scenarioType, setScenarioType] = useState("POSTGRES_LOCK");
  const [recommendedTool, setRecommendedTool] = useState("terminate_zombie_sessions");
  const [impactLevel, setImpactLevel] = useState("HIGH");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    // Provide default 3D vector coordinates according to scenario domain
    const vectorMap: Record<string, number[]> = {
      POSTGRES_LOCK: [0.95, 0.15, 0.08],
      REDIS_OOM: [0.12, 0.94, 0.2],
      INGRESS_TIMEOUT: [0.09, 0.18, 0.96],
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/runbooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          scenarioType,
          recommendedTool,
          impactLevel,
          embedding: vectorMap[scenarioType] || [0.5, 0.5, 0.5],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to register runbook");
      }

      onSuccess(data.runbook);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save runbook");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Register SRE Runbook (pgvector)
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-mono uppercase tracking-wider">
              Runbook Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ingress Gateway Envoy Pool Starvation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-mono uppercase tracking-wider">
              Scenario Type
            </label>
            <select
              value={scenarioType}
              onChange={(e) => {
                setScenarioType(e.target.value);
                if (e.target.value === "POSTGRES_LOCK") {
                  setRecommendedTool("terminate_zombie_sessions");
                } else if (e.target.value === "REDIS_OOM") {
                  setRecommendedTool("flush_volatile_cache");
                } else {
                  setRecommendedTool("scale_ingress_replicas");
                }
              }}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="POSTGRES_LOCK">POSTGRES_LOCK (Database)</option>
              <option value="REDIS_OOM">REDIS_OOM (Cache / Memory)</option>
              <option value="INGRESS_TIMEOUT">INGRESS_TIMEOUT (Network)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 mb-1 font-mono uppercase tracking-wider">
                Recommended Tool
              </label>
              <input
                type="text"
                required
                value={recommendedTool}
                onChange={(e) => setRecommendedTool(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-mono uppercase tracking-wider">
                Impact Level
              </label>
              <select
                value={impactLevel}
                onChange={(e) => setImpactLevel(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-mono uppercase tracking-wider">
              Diagnostic & Remediation Description
            </label>
            <textarea
              rows={3}
              placeholder="Describe detection telemetry and remediation steps..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-950"
            >
              {isSubmitting ? "Persisting Vector..." : "Save to pgvector"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}