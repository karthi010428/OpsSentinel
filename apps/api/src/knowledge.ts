export interface RunbookEntry {
  id: string;
  title: string;
  category: "DATABASE" | "NETWORK" | "MEMORY" | "STORAGE";
  symptoms: string[];
  embedding: number[]; // 5-dimensional normalized vector
  recommendedAction: string;
  remediationTool: string;
}

// Normalized 5D synthetic vector embeddings for local similarity search
// Dimensions: [DB_Saturation, Lock_Contention, Network_Latency, Memory_Pressure, Error_Rate]
export const runbookCorpus: RunbookEntry[] = [
  {
    id: "RB-001",
    title: "Postgres Connection Pool Starvation & Idle Locks",
    category: "DATABASE",
    symptoms: ["HTTP 504 Gateway Timeout", "pg_stat_activity contention", "Pool connections > 90%"],
    embedding: [0.92, 0.85, 0.45, 0.15, 0.88],
    recommendedAction: "Inspect active sessions and terminate idle-in-transaction zombies",
    remediationTool: "terminate_zombie_sessions",
  },
  {
    id: "RB-002",
    title: "Redis OOM Cache Eviction Failure",
    category: "MEMORY",
    symptoms: ["Redis MISCONF Redis is configured to save RDB", "Memory fragmentation > 1.8"],
    embedding: [0.10, 0.05, 0.35, 0.95, 0.70],
    recommendedAction: "Purge volatile keys and resize maxmemory ceiling",
    remediationTool: "flush_volatile_cache",
  },
  {
    id: "RB-003",
    title: "Ingress Nginx Upstream Keepalive Exhaustion",
    category: "NETWORK",
    symptoms: ["HTTP 502 Bad Gateway", "upstream timed out (110: Connection timed out)"],
    embedding: [0.20, 0.10, 0.95, 0.20, 0.82],
    recommendedAction: "Scale ingress pod replicas and reset keepalive connection slots",
    remediationTool: "scale_ingress_replicas",
  },
];

// Cosine Similarity Formula: (A . B) / (||A|| * ||B||)
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += (vecA[i] ?? 0) * (vecB[i] ?? 0);
    normA += (vecA[i] ?? 0) ** 2;
    normB += (vecB[i] ?? 0) ** 2;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Vector Search Function
export function searchRunbooks(queryEmbedding: number[], topK: number = 1) {
  const scored = runbookCorpus.map((entry) => ({
    ...entry,
    similarityScore: calculateCosineSimilarity(queryEmbedding, entry.embedding),
  }));

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, topK);
}