import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export const dbPool = connectionString
  ? new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

if (dbPool) {
  dbPool.on("connect", () => {
    console.log("[PostgreSQL] Connected to Neon pgvector cluster with SSL.");
  });

  dbPool.on("error", (err) => {
    console.error("[PostgreSQL] Unexpected pool client connection error:", err.message);
  });
} else {
  console.warn("[PostgreSQL] DATABASE_URL missing. Operating in in-memory heuristic mode.");
}

export interface RunbookRecord {
  id: string;
  title: string;
  description: string;
  scenarioType: string;
  recommendedTool: string;
  impactLevel: string;
  similarity: number;
}

/**
 * Searches for the nearest matching runbook using dynamic cosine distance (<=>).
 * Accepts real 768-dimensional or arbitrary float vectors.
 */
export async function findNearestRunbookByVector(
  embeddingVector: number[],
  scenarioType?: string
): Promise<RunbookRecord | null> {
  if (!dbPool) return null;

  const vectorStr = `[${embeddingVector.join(",")}]`;

  // Dynamic parameterized query utilizing HNSW vector index
  const query = scenarioType
    ? `
      SELECT 
        id,
        title,
        description,
        scenario_type AS "scenarioType",
        recommended_tool AS "recommendedTool",
        impact_level AS "impactLevel",
        (1 - (embedding <=> $1::vector)) AS similarity
      FROM incident_runbooks
      WHERE scenario_type = $2
      ORDER BY embedding <=> $1::vector ASC
      LIMIT 1;
    `
    : `
      SELECT 
        id,
        title,
        description,
        scenario_type AS "scenarioType",
        recommended_tool AS "recommendedTool",
        impact_level AS "impactLevel",
        (1 - (embedding <=> $1::vector)) AS similarity
      FROM incident_runbooks
      ORDER BY embedding <=> $1::vector ASC
      LIMIT 1;
    `;

  const params = scenarioType ? [vectorStr, scenarioType] : [vectorStr];

  try {
    const result = await dbPool.query(query, params);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error: any) {
    console.error("[PostgreSQL] pgvector similarity search failed:", error.message);
    return null;
  }
}