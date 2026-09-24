import type { ProgressStage } from "@/lib/image/pipeline";
import { PROGRESS_STEPS, stepIndex } from "@/lib/tools/progress-steps";

/** Real progress from engine events; nothing is simulated. */
export function ProcessingProgress({ stage }: { stage: ProgressStage | null }) {
  const current = stepIndex(stage);
  const percent = Math.round(((current + 1) / PROGRESS_STEPS.length) * 100);
  const label = current >= 0 ? PROGRESS_STEPS[current] : "Starting";

  return (
    <div data-testid="processing" data-stage={stage ?? "starting"} className="py-2">
      <p className="font-semibold" aria-hidden="true">
        {label}…
      </p>
      <div
        role="progressbar"
        aria-label="Processing"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={label}
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface"
      >
        <div className="h-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-4 space-y-1 text-sm">
        {PROGRESS_STEPS.map((step, index) => {
          const state = index < current ? "done" : index === current ? "current" : "pending";
          return (
            <li
              key={step}
              className={state === "pending" ? "text-muted" : "font-medium"}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span aria-hidden="true" className="inline-block w-5">
                {state === "done" ? "✓" : state === "current" ? "›" : "·"}
              </span>
              {step}
              <span className="sr-only">
                {state === "done" ? " (done)" : state === "current" ? " (in progress)" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
