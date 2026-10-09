import type { ExamDefinition, ExamId } from "./types";

/**
 * Exams known to the product. Planned exams intentionally have no presets:
 * requirements are added only after they are verified against an official source.
 */
export const EXAMS: Readonly<Record<ExamId, ExamDefinition>> = {
  ccc: {
    id: "ccc",
    shortName: "CCC",
    fullName: "Course on Computer Concepts",
    conductingBody: "NIELIT",
    status: "active",
  },
  ibps: {
    id: "ibps",
    shortName: "IBPS",
    fullName: "Institute of Banking Personnel Selection",
    conductingBody: "IBPS",
    status: "active",
    // Only the CRP RRBs-XV notification is verified (src/lib/presets/ibps.ts); IBPS also runs
    // other recruitments (PO, Clerk, SO) this product doesn't claim to cover.
    scopeLabel: "IBPS CRP RRBs-XV",
  },
  ssc: {
    id: "ssc",
    shortName: "SSC",
    fullName: "Staff Selection Commission",
    conductingBody: "SSC",
    status: "planned",
  },
  railway: {
    id: "railway",
    shortName: "Railway",
    fullName: "Railway Recruitment",
    conductingBody: "RRB",
    status: "planned",
  },
  upsc: {
    id: "upsc",
    shortName: "UPSC",
    fullName: "Union Public Service Commission",
    conductingBody: "UPSC",
    status: "planned",
  },
};

export function listExams(): ExamDefinition[] {
  return Object.values(EXAMS);
}

/**
 * "{scope} · {conducting body}", e.g. "CCC · NIELIT" — or just "{scope}" when the conducting
 * body is already named inside the scope label (e.g. IBPS's "IBPS CRP RRBs-XV" already names
 * IBPS), so the byline never repeats the same organisation twice. Case-insensitive substring
 * check so this holds for any future exam without a per-exam flag.
 */
export function examByline(exam: ExamDefinition): string {
  const scope = exam.scopeLabel ?? exam.shortName;
  const body = exam.conductingBody;
  return scope.toLowerCase().includes(body.toLowerCase()) ? scope : `${scope} · ${body}`;
}

/**
 * "CCC and IBPS CRP RRBs-XV" — the active exams' verified scope, joined for a sentence. Reads
 * `scopeLabel`/`shortName` from the registry so this can't list an exam that isn't actually
 * `active`, and can't drift from the scope named in that exam's own preset `source`.
 */
export function verifiedScopeSummary(): string {
  const labels = listExams()
    .filter((exam) => exam.status === "active")
    .map((exam) => exam.scopeLabel ?? exam.shortName);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
