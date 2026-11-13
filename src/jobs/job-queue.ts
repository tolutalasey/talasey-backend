import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { KEY_VALUE_STORE, type KeyValueStore } from '../store/key-value-store.js';

export interface Job<T = unknown> {
  name: string;
  payload: T;
  attempt: number;
}

export type JobHandler<T = unknown> = (payload: T) => Promise<void>;

const QUEUE = 'jobs:queue';
const FAILED = 'jobs:failed';
const MAX_ATTEMPTS = 3;

// Work that happens after a request has answered, such as booking a delivery day once an order is
// placed. Jobs sit in the store's list, so with Redis any instance of the API can run them.
@Injectable()
export class JobQueue implements OnApplicationShutdown {
  private readonly handlers = new Map<string, JobHandler>();
  private readonly logger = new Logger(JobQueue.name);
  private timer: NodeJS.Timeout | null = null;
  private draining: Promise<number> | null = null;

  constructor(@Inject(KEY_VALUE_STORE) private readonly store: KeyValueStore) {}

  handle<T>(name: string, handler: JobHandler<T>) {
    this.handlers.set(name, handler as JobHandler);
  }

  async enqueue<T>(name: string, payload: T) {
    await this.store.push(QUEUE, JSON.stringify({ name, payload, attempt: 1 } satisfies Job<T>));
  }

  start(intervalMs = 500) {
    this.timer ??= setInterval(() => void this.drain(), intervalMs);
  }

  // Runs every job waiting now and returns how many ran. Tests call it directly.
  drain(): Promise<number> {
    this.draining ??= this.runWaiting().finally(() => {
      this.draining = null;
    });
    return this.draining;
  }

  async failed(): Promise<Job[]> {
    const jobs: Job[] = [];
    for (let raw = await this.store.pop(FAILED); raw; raw = await this.store.pop(FAILED)) {
      jobs.push(JSON.parse(raw) as Job);
    }
    for (const job of jobs) await this.store.push(FAILED, JSON.stringify(job));
    return jobs;
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.draining;
  }

  private async runWaiting(): Promise<number> {
    let ran = 0;
    for (let raw = await this.store.pop(QUEUE); raw; raw = await this.store.pop(QUEUE)) {
      await this.run(JSON.parse(raw) as Job);
      ran += 1;
    }
    return ran;
  }

  private async run(job: Job) {
    const handler = this.handlers.get(job.name);
    try {
      if (!handler) throw new Error(`No handler for job ${job.name}`);
      await handler(job.payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (job.attempt < MAX_ATTEMPTS) {
        await this.store.push(QUEUE, JSON.stringify({ ...job, attempt: job.attempt + 1 }));
        return;
      }
      this.logger.error(`Job ${job.name} failed ${job.attempt} times: ${message}`);
      await this.store.push(FAILED, JSON.stringify({ ...job, error: message }));
    }
  }
}
