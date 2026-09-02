/**
 * Section 9.1 — "Current program phase and next milestone", backed by
 * the real key-dates timeline the Product Owner supplied (khai giảng /
 * đào tạo / trình bày dự án-checkpoint / tổng kết-expo). No dedicated
 * "milestones" table exists or is needed: every date here already lives
 * on programs.starts_on/ends_on plus the one session whose block is the
 * project-presentation/checkpoint day.
 *
 * Dates are kept as plain "YYYY-MM-DD" strings (as Postgres `date`
 * columns come back from supabase-js) on purpose — that format sorts
 * lexicographically exactly like chronological order, so comparisons
 * below don't need Date parsing/timezone handling at all.
 */

export type MilestoneKey = "opening" | "checkpoint" | "closing";

export interface Milestone {
  key: MilestoneKey;
  label: string;
  isoDate: string;
}

export function buildMilestones({
  startsOn,
  endsOn,
  checkpointDate,
}: {
  startsOn: string;
  endsOn: string;
  checkpointDate: string | null;
}): Milestone[] {
  const milestones: Milestone[] = [{ key: "opening", label: "Khai giảng", isoDate: startsOn }];
  if (checkpointDate) {
    milestones.push({ key: "checkpoint", label: "Trình bày dự án / Checkpoint", isoDate: checkpointDate });
  }
  milestones.push({ key: "closing", label: "Tổng kết / Expo", isoDate: endsOn });
  return milestones;
}

const PHASE_LABEL_BEFORE: Record<MilestoneKey, string> = {
  opening: "Chuẩn bị khai giảng",
  checkpoint: "Đang đào tạo",
  closing: "Chuẩn bị Tổng kết / Expo",
};

/** The next milestone that hasn't happened yet, or null once the program has ended. */
export function nextMilestone(todayIso: string, milestones: Milestone[]): Milestone | null {
  return milestones.find((m) => m.isoDate >= todayIso) ?? null;
}

/** A short label for "where we are right now" relative to the timeline. */
export function currentPhaseLabel(todayIso: string, milestones: Milestone[]): string {
  const upcoming = nextMilestone(todayIso, milestones);
  if (!upcoming) return "Đã hoàn thành chương trình";
  return PHASE_LABEL_BEFORE[upcoming.key];
}
