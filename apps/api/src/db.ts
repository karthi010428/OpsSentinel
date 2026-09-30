import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export const dbPool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    })
  : null;

export interface RunbookSearchResult {
  id: string;
  title: string;
  description: string;
  scenarioType: string;
  recommendedTool: string;
  impactLevel: string;
  similarity: number;
}

// Map scenarios to normalized 3D embedding vectors
const SCENARIO_EMBEDDINGS: Record<string, string> = {
  POSTGRES_LOCK: '[0.98, 0.12, 0.05]',
  REDIS_OOM: '[0.15, 0.96, 0.18]',
  INGRESS_TIMEOUT: '[0.08, 0.19, 0.97]',
};

/**
 * Executes a cosine distance query using pgvector HNSW index:
 * (1 - (embedding <=> target_vector)) converts distance to similarity (0 to 1).
 */
export async function findNearestRunbook(
  scenarioType: string
): Promise<RunbookSearchResult | null> {
  if (!dbPool) {
    return null;
  }

  const queryVector = SCENARIO_EMBEDDINGS[scenarioType] || '[0.5, 0.5, 0.5]';

  const query = `
    SELECT 
      id,
      title,
      description,
      scenario_type AS "scenarioType",
      recommended_tool AS "recommendedTool",
      impact_level AS "impactLevel",
      ROUND((1 - (embedding <=> $1::vector))::numeric, 4) AS similarity
    FROM incident_runbooks
    ORDER BY embedding <=> $1::vector ASC
    LIMIT 1;
  `;

  try {
    const { rows } = await dbPool.query(query, [queryVector]);
    if (!rows.length) return null;

    const row = rows[0];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      scenarioType: row.scenarioType,
      recommendedTool: row.recommendedTool,
      impactLevel: row.impactLevel,
      similarity: Number(row.similarity),
    };
  } catch (error) {
    console.error('[pgvector] Query failed, falling back to heuristic:', error);
    return null;
  }
}