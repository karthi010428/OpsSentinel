import { Redis } from '@upstash/redis';

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
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "DLQ";
  attempts?: number;
  maxRetries?: number;
  errorReason?: string;
}

const isRedisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

export const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    })
  : null;

const QUEUE_ACTIVE_KEY = 'opssentinel:queue:active';
const QUEUE_DLQ_KEY = 'opssentinel:queue:dlq';

class IncidentQueueEngine {
  private queue: IncidentJob[] = [];
  private dlq: IncidentJob[] = [];
  private isProcessing = false;

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

    if (redis) {
      await redis.lpush(QUEUE_ACTIVE_KEY, JSON.stringify(job));
    } else {
      this.queue.push(job);
    }

    return job;
  }

  public async getQueueStats() {
    if (redis) {
      const activeCount = (await redis.llen(QUEUE_ACTIVE_KEY)) || 0;
      const dlqCount = (await redis.llen(QUEUE_DLQ_KEY)) || 0;
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
    if (redis) {
      const raw = await redis.lrange<unknown>(QUEUE_DLQ_KEY, 0, 19);
      if (!raw || !Array.isArray(raw)) return [];
      return raw.map((item: unknown): IncidentJob => {
        if (typeof item === 'string') {
          return JSON.parse(item) as IncidentJob;
        }
        return item as IncidentJob;
      });
    }
    return [...this.dlq];
  }

  public async retryDLQJob(jobId: string): Promise<IncidentJob | null> {
    if (redis) {
      const dlqJobs = await this.getDLQ();
      const job = dlqJobs.find((j) => j.id === jobId);
      if (!job) return null;

      await redis.lrem(QUEUE_DLQ_KEY, 1, JSON.stringify(job));
      job.status = "QUEUED";
      job.attempts = 0;
      delete job.errorReason;
      await redis.lpush(QUEUE_ACTIVE_KEY, JSON.stringify(job));
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

    if (redis) {
      await redis.lpush(QUEUE_DLQ_KEY, JSON.stringify(dlqJob));
    } else {
      this.dlq.unshift(dlqJob);
    }

    return dlqJob;
  }
  public async processNext(workerFn: (job: IncidentJob) => Promise<void>) {
    if (this.isProcessing) return;

    let nextJob: IncidentJob | undefined;

    if (redis) {
      const raw = await redis.rpop<unknown>(QUEUE_ACTIVE_KEY);
      if (!raw) return;
      nextJob = typeof raw === 'string' ? (JSON.parse(raw) as IncidentJob) : (raw as IncidentJob);
    } else {
      nextJob = this.queue.find((j) => j.status === "QUEUED");
      if (!nextJob) return;
    }

    this.isProcessing = true;
    nextJob.status = "PROCESSING";

    try {
      await workerFn(nextJob);
      nextJob.status = "COMPLETED";
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Execution timeout or unhandled exception";
      nextJob.attempts = (nextJob.attempts || 0) + 1;
      nextJob.errorReason = errorMsg;

      if (nextJob.attempts >= (nextJob.maxRetries || 2)) {
        nextJob.status = "DLQ";
        if (redis) {
          await redis.lpush(QUEUE_DLQ_KEY, JSON.stringify(nextJob));
        } else {
          this.dlq.push(nextJob);
        }
      } else {
        nextJob.status = "QUEUED";
        if (redis) {
          await redis.rpush(QUEUE_ACTIVE_KEY, JSON.stringify(nextJob));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const incidentQueue = new IncidentQueueEngine();