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
