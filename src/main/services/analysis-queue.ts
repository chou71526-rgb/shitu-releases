const defaultSleep = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));

export class AnalysisRequestQueue {
  private tail: Promise<void> = Promise.resolve();
  private lastStartedAt: number | null = null;

  constructor(
    private readonly minimumIntervalMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (duration: number) => Promise<void> = defaultSleep,
  ) {}

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      if (this.lastStartedAt !== null) {
        const remaining = this.minimumIntervalMs - (this.now() - this.lastStartedAt);
        if (remaining > 0) await this.sleep(remaining);
      }
      this.lastStartedAt = this.now();
      return task();
    });
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }
}
