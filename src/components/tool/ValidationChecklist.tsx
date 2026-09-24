import type { ChecklistItem, ChecklistStatus } from "@/lib/tools/result-state";

const MARKS: Record<ChecklistStatus, { symbol: string; text: string; className: string }> = {
  pass: { symbol: "✓", text: "Passed", className: "text-success" },
  warning: { symbol: "⚠", text: "Warning", className: "text-warning" },
  fail: { symbol: "✕", text: "Failed", className: "text-danger" },
};

/** Checklist of engine validation results. Status is shown by symbol and text, not colour alone. */
export function ValidationChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border" data-testid="checklist">
      {items.map((item) => {
        const mark = MARKS[item.status];
        return (
          <li
            key={item.id}
            data-check={item.id}
            data-status={item.status}
            className="flex items-start gap-3 px-4 py-3"
          >
            <span
              aria-hidden="true"
              className={`w-5 text-lg leading-6 font-bold ${mark.className}`}
            >
              {mark.symbol}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap justify-between gap-x-4">
                <span className="font-medium">
                  {item.label}
                  <span className="sr-only">: {mark.text}.</span>
                </span>
                <span className="font-semibold tabular-nums">{item.value}</span>
              </div>
              {item.status !== "pass" ? (
                <p className="text-sm text-muted">Required: {item.expected}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
