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
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
}

// In-Memory FIFO Queue Engine (BullMQ Core Pattern)
class IncidentQueueEngine {
  private queue: IncidentJob[] = [];
  private isProcessing = false;

  public addJob(jobData: Omit<IncidentJob, "id" | "queuedAt" | "status">): IncidentJob {
    const job: IncidentJob = {
      id: `job-queue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...jobData,
      queuedAt: Date.now(),
      status: "QUEUED",
    };
    this.queue.push(job);
    return job;
  }

  public getQueueStats() {
    return {
      pendingJobs: this.queue.filter((j) => j.status === "QUEUED").length,
      activeJobs: this.queue.filter((j) => j.status === "PROCESSING").length,
      completedJobs: this.queue.filter((j) => j.status === "COMPLETED").length,
      totalLength: this.queue.length,
    };
  }

  public async processNext(workerFn: (job: IncidentJob) => Promise<void>) {
    if (this.isProcessing) return;
    const nextJob = this.queue.find((j) => j.status === "QUEUED");
    if (!nextJob) return;

    this.isProcessing = true;
    nextJob.status = "PROCESSING";

    try {
      await workerFn(nextJob);
      nextJob.status = "COMPLETED";
    } catch {
      nextJob.status = "FAILED";
    } finally {
      this.isProcessing = false;
    }
  }
}

export const incidentQueue = new IncidentQueueEngine();