import { z } from "zod";

// 1. Tool Input Schema Validation
export const CheckDbPoolSchema = z.object({
  targetService: z.string().min(1),
  readOnly: z.literal(true),
});

export const TerminateZombiesSchema = z.object({
  targetService: z.string().min(1),
  maxConnectionsToKill: z.number().int().positive().max(10),
  reason: z.string().min(5),
});

export type CheckDbPoolInput = z.infer<typeof CheckDbPoolSchema>;
export type TerminateZombiesInput = z.infer<typeof TerminateZombiesSchema>;

// 2. Safe Sandboxed SRE Tool Implementations
export const sreTools = {
  check_db_pool_status: async (input: CheckDbPoolInput) => {
    // Validates inputs at runtime using Zod
    CheckDbPoolSchema.parse(input);
    return {
      service: input.targetService,
      totalConnections: 100,
      activeConnections: 98,
      idleInTransaction: 4,
      healthStatus: "CRITICAL_SATURATION",
      topBlockingQueries: [
        "SELECT * FROM orders FOR UPDATE -- idle in transaction (pid: 4091)",
        "SELECT * FROM orders FOR UPDATE -- idle in transaction (pid: 4092)",
      ],
    };
  },

  terminate_zombie_sessions: async (input: TerminateZombiesInput) => {
    TerminateZombiesSchema.parse(input);
    return {
      service: input.targetService,
      terminatedCount: 4,
      connectionsKilled: [4091, 4092, 4095, 4098],
      remainingActive: 22,
      status: "POOL_HEALTH_RESTORED",
    };
  },
};