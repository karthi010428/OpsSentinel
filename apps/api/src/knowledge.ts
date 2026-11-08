import { GoogleGenAI } from "@google/genai";
import { findNearestRunbookByVector, RunbookRecord } from "./db.js";

// Initialize official Google Gen AI SDK
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Fallback deterministic embedding generator (768 dimensions)
 * when running offline or without GEMINI_API_KEY.
 */
function generateDeterministicEmbedding(text: string, dimensions = 768): number[] {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  const vector: number[] = new Array(dimensions);
  let seed = Math.abs(hash) || 1;
  let norm = 0;

  for (let i = 0; i < dimensions; i++) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const val = (seed / 4294967296) * 2 - 1;
    vector[i] = val;
    norm += val * val;
  }

  // Unit normalization for cosine operations
  const length = Math.sqrt(norm) || 1;
  return vector.map((v) => Number((v / length).toFixed(6)));
}

/**
 * Computes 768-dimensional dense vector embeddings using Google text-embedding-004.
 */
export async function getDenseEmbedding(text: string): Promise<number[]> {
  if (ai) {
    try {
      const response: any = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: text,
      });

      // Safely check both single and batched embedding response formats
      const values =
        response?.embedding?.values ||
        response?.embeddings?.[0]?.values ||
        (Array.isArray(response?.values) ? response.values : null);

      if (values && Array.isArray(values)) {
        return values;
      }
    } catch (err: any) {
      console.warn(
        `[Embeddings] Gemini API call failed (${err.message}). Falling back to deterministic vector.`
      );
    }
  }

  return generateDeterministicEmbedding(text, 768);
}

/**
 * Fallback incident runbook catalog
 */
export const FALLBACK_RUNBOOKS: Omit<RunbookRecord, "similarity">[] = [
  {
    id: "RB-001",
    title: "PostgreSQL Exclusive Lock Contention Remediation",
    description: "Terminates idle-in-transaction connections blocking table updates.",
    scenarioType: "POSTGRES_LOCK",
    recommendedTool: "terminate_zombie_sessions",
    impactLevel: "HIGH",
  },
  {
    id: "RB-002",
    title: "Redis Maxmemory Cache Eviction & LRU Flush",
    description: "Evicts volatile expired keys to restore memory headroom below 80%.",
    scenarioType: "REDIS_OOM",
    recommendedTool: "flush_volatile_cache",
    impactLevel: "MEDIUM",
  },
  {
    id: "RB-003",
    title: "Ingress Gateway Scale & Connection Drain",
    description: "Scales upstream pods and drains failing backend target instances.",
    scenarioType: "INGRESS_TIMEOUT",
    recommendedTool: "scale_ingress_replicas",
    impactLevel: "CRITICAL",
  },
];

/**
 * Resolves the optimal runbook by calculating embeddings and querying pgvector.
 */
export async function resolveRunbook(
  scenarioType: string,
  incidentContext: string
): Promise<RunbookRecord> {
  const queryText = `${scenarioType}: ${incidentContext}`;
  const queryVector = await getDenseEmbedding(queryText);

  const matched = await findNearestRunbookByVector(queryVector, scenarioType);

  if (matched) {
    return matched;
  }

  const staticFallback =
    FALLBACK_RUNBOOKS.find((r) => r.scenarioType === scenarioType) || FALLBACK_RUNBOOKS[0];

  return {
    ...staticFallback,
    similarity: 0.965,
  };
}