import { Redis } from "@upstash/redis";

export interface IncidentJob {
  id: string;
  incidentType: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  payload: {
    service: string;
    endpoint: string;
    latencyMs: number;
    errorRate: number;
  };
  queuedAt: number;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "DLQ" | "POISONED";
  attempts?: number;
  maxRetries?: number;
  errorReason?: string;
}

const isRedisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const defaultRedis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    })
  : null;

export const QUEUE_ACTIVE_KEY = "opssentinel:queue:active";
export const QUEUE_DLQ_KEY = "opssentinel:queue:dlq";

export class IncidentQueueEngine {
  public redis: any;
  private queue: IncidentJob[] = [];
  private dlq: IncidentJob[] = [];
  private isProcessing = false;

  constructor(redisClient: any = defaultRedis) {
    this.redis = redisClient;
  }

  public async addJob(
    jobData: Omit<IncidentJob, "id" | "queuedAt" | "status">
  ): Promise<IncidentJob> {
    const job: IncidentJob = {
      id: `job-queue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...jobData,
      queuedAt: Date.now(),
      status: "QUEUED",
      attempts: 0,
      maxRetries: 2,
    };

    if (this.redis) {
      await this.redis.lpush(QUEUE_ACTIVE_KEY, JSON.stringify(job));
    } else {
      this.queue.push(job);
    }

    return job;
  }

  public async getQueueStats() {
    if (this.redis) {
      const activeCount = (await this.redis.llen(QUEUE_ACTIVE_KEY)) || 0;
      const dlqCount = (await this.redis.llen(QUEUE_DLQ_KEY)) || 0;
      return {
        pendingJobs: activeCount,
        activeJobs: this.isProcessing ? 1 : 0,
        completedJobs: 0,
        dlqJobs: dlqCount,
        totalLength: activeCount + dlqCount,
      };
    }

    return {
      pendingJobs: this.queue.filter((j) => j.status === "QUEUED").length,
      activeJobs: this.queue.filter((j) => j.status === "PROCESSING").length,
      completedJobs: this.queue.filter((j) => j.status === "COMPLETED").length,
      dlqJobs: this.dlq.length,
      totalLength: this.queue.length + this.dlq.length,
    };
  }

  public async getDLQ(): Promise<IncidentJob[]> {
    if (this.redis) {
      const raw = await this.redis.lrange(QUEUE_DLQ_KEY, 0, 19);
      if (!raw || !Array.isArray(raw)) return [];
      return raw.map((item: unknown): IncidentJob => {
        if (typeof item === "string") {
          return JSON.parse(item) as IncidentJob;
        }
        return item as IncidentJob;
      });
    }
    return [...this.dlq];
  }

  public async retryDLQJob(jobId: string): Promise<IncidentJob | null> {
    if (this.redis) {
      const dlqJobs = await this.getDLQ();
      const job = dlqJobs.find((j) => j.id === jobId);
      if (!job) return null;

      await this.redis.lrem(QUEUE_DLQ_KEY, 1, typeof job === "string" ? job : JSON.stringify(job));
      job.status = "QUEUED";
      job.attempts = 0;
      delete job.errorReason;
      await this.redis.lpush(QUEUE_ACTIVE_KEY, JSON.stringify(job));
      return job;
    }

    const idx = this.dlq.findIndex((j) => j.id === jobId);
    if (idx === -1) return null;

    const [job] = this.dlq.splice(idx, 1);
    job.status = "QUEUED";
    job.attempts = 0;
    delete job.errorReason;
    this.queue.push(job);
    return job;
  }

  public async failJob(jobId: string, reason = "Execution threshold failed"): Promise<IncidentJob | null> {
    const dlqJob: IncidentJob = {
      id: jobId,
      incidentType: "POISON_PILL_TEST",
      severity: "SEV-1",
      payload: {
        service: "billing-gateway",
        endpoint: "/checkout",
        latencyMs: 99999,
        errorRate: 1.0,
      },
      queuedAt: Date.now(),
      status: "DLQ",
      attempts: 2,
      maxRetries: 2,
      errorReason: reason,
    };

    if (this.redis) {
      await this.redis.lpush(QUEUE_DLQ_KEY, JSON.stringify(dlqJob));
    } else {
      this.dlq.unshift(dlqJob);
    }

    return dlqJob;
  }
}

export const incidentQueue = new IncidentQueueEngine();