import { afterEach, describe, expect, it, vi } from "vitest";
import { CCC_PHOTO } from "@/lib/presets/ccc";
import { processImage, type WorkerLike } from "./client";
import { progressFor, type ImageProcessingRequest, type WorkerResponse } from "./protocol";

/** Fake worker: records requests; tests drive responses. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  requests: ImageProcessingRequest[] = [];
  terminated = false;

  postMessage(message: ImageProcessingRequest) {
    this.requests.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(message: WorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
  get jobId() {
    return this.requests[0].jobId;
  }
}

const file = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

function start(options: Partial<Parameters<typeof processImage>[1]> = {}) {
  const worker = new FakeWorker();
  const promise = processImage(file, {
    requirements: CCC_PHOTO,
    createWorker: () => worker,
    ...options,
  });
  return { worker, promise };
}

afterEach(() => vi.useRealTimers());

describe("processImage (worker client)", () => {
  it("sends a typed request and forwards progress in order", async () => {
    const stages: string[] = [];
    const { worker, promise } = start({ onProgress: (p) => stages.push(p.stage) });
    expect(worker.requests[0]).toMatchObject({ type: "process", file, requirements: CCC_PHOTO });

    worker.emit({ type: "progress", jobId: worker.jobId, progress: progressFor("loading") });
    worker.emit({ type: "progress", jobId: worker.jobId, progress: progressFor("encoding") });
    worker.emit({
      type: "error",
      jobId: worker.jobId,
      error: { code: "decode-failed", stage: "loading", message: "x" },
    });
    await promise;
    expect(stages).toEqual(["loading", "encoding"]);
  });

  it("resolves structured errors from the worker and terminates it", async () => {
    const { worker, promise } = start();
    worker.emit({
      type: "error",
      jobId: worker.jobId,
      error: { code: "corrupt-file", stage: "loading", message: "damaged" },
    });
    await expect(promise).resolves.toEqual({
      ok: false,
      error: { code: "corrupt-file", stage: "loading", message: "damaged" },
    });
    expect(worker.terminated).toBe(true);
  });

  it("ignores messages for other jobs", async () => {
    const { worker, promise } = start();
    worker.emit({
      type: "error",
      jobId: "someone-else",
      error: { code: "decode-failed", stage: "loading", message: "x" },
    });
    worker.onerror?.({ preventDefault() {} } as ErrorEvent);
    await expect(promise).resolves.toMatchObject({ ok: false, error: { code: "worker-failed" } });
  });

  it("turns a worker crash into worker-failed instead of throwing", async () => {
    const { worker, promise } = start();
    worker.onerror?.({ preventDefault() {} } as ErrorEvent);
    await expect(promise).resolves.toMatchObject({
      ok: false,
      error: { code: "worker-failed", stage: "worker" },
    });
    expect(worker.terminated).toBe(true);
  });

  it("turns an undeliverable message into worker-failed", async () => {
    const { worker, promise } = start();
    worker.onmessageerror?.({} as MessageEvent);
    await expect(promise).resolves.toMatchObject({ ok: false, error: { code: "worker-failed" } });
  });

  it("times out", async () => {
    vi.useFakeTimers();
    const { worker, promise } = start({ timeoutMs: 1000 });
    vi.advanceTimersByTime(1001);
    await expect(promise).resolves.toMatchObject({ ok: false, error: { code: "timeout" } });
    expect(worker.terminated).toBe(true);
  });

  it("can be aborted", async () => {
    const controller = new AbortController();
    const { worker, promise } = start({ signal: controller.signal });
    controller.abort();
    await expect(promise).resolves.toMatchObject({ ok: false, error: { code: "aborted" } });
    expect(worker.terminated).toBe(true);
  });

  it("reports worker creation failure as unsupported-browser", async () => {
    const outcome = await processImage(file, {
      requirements: CCC_PHOTO,
      createWorker: () => {
        throw new Error("no workers");
      },
    });
    expect(outcome).toMatchObject({ ok: false, error: { code: "unsupported-browser" } });
  });
});
