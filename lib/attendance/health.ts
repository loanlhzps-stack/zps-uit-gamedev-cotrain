// Section 17.1 — group health rules.
//
// Bản rút gọn theo yêu cầu của bạn (brainstorm lại, sau khi có Bài tập
// nhóm/dự án cuối khoá làm dữ liệu thật): CHỈ còn 2 mức "On track" /
// "Need attention" (bỏ hẳn "At risk" để không bị loãng — mọi cảnh báo
// dù nặng nhẹ đều gộp về 1 mức duy nhất). "Need attention" khi có ít
// nhất 1 trong 3 điều kiện:
//   1. Có Bài tập nhóm (Course Assignment, submission_mode="group")
//      đã trễ hạn nộp hơn 1 ngày mà nhóm chưa nộp.
//   2. Có thành viên đã vắng ≥3 buổi (MAX_ALLOWED_ABSENCES — đúng
//      ngưỡng "gần/đã tới hạn" của rule 80% mục 11.3, gộp luôn các
//      mức cũ "gần ngưỡng"/"đã vượt ngưỡng" trước đây tách thành
//      need_attention/at_risk riêng biệt — nay chỉ 1 tín hiệu).
//   3. Có buổi học đã qua mà Mentor chưa nộp attendance sheet.
// Rule "vắng 2 buổi liên tiếp" của bản trước đã bị thay bằng ngưỡng
// tổng số buổi vắng ≥3 ở trên (đơn giản hơn, dễ giải thích hơn).
//
// Rules chưa áp dụng (flagged ở README, không nằm trong 3 điều kiện
// trên): milestone dự án cuối khoá bị trễ, deadline trong 48h chưa có
// bản nháp, revision deadline sắp tới — có thể bổ sung sau nếu cần.

export type GroupHealth = "on_track" | "need_attention";

export type DefiniteAttendanceStatus = "present" | "excused_absence" | "unexcused_absence";

export interface MemberAttendanceTimeline {
  profileId: string;
  displayName: string;
  /** Chronological, only recorded (non-`not_recorded`) statuses. */
  statuses: DefiniteAttendanceStatus[];
}

// Section 11.3 — 16 required days, 80% (13/16) minimum → at most 3
// absences allowed before the 4th makes a student ineligible. Cũng
// chính là ngưỡng dùng cho tín hiệu "Need attention" ở trên (≥3).
export const MAX_ALLOWED_ABSENCES = 3;

export interface GroupHealthCounts {
  overdueGroupAssignmentCount: number;
  attentionMemberCount: number;
  attentionMemberNames?: string[];
  missingSheetsCount: number;
}

export interface GroupHealthResult {
  health: GroupHealth;
  reasons: string[];
}

/**
 * Pure rule evaluation, shared by both data sources: the Owner/
 * Co-owner/Trainer/Mentor/Student path (deriveGroupHealthFromMembers,
 * below — có raw attendance_records + assignments access, có thể nêu
 * tên) và Sponsor path (lib/attendance/queries.ts's
 * getGroupsWithHealthAggregate, backed by 2 RPC SECURITY DEFINER —
 * program_group_health_signals + program_group_overdue_assignments —
 * chỉ trả về số đếm, không có danh tính học viên, theo mục 4.3
 * "aggregate ... not private absence reasons").
 */
export function computeGroupHealth(counts: GroupHealthCounts): GroupHealthResult {
  const reasons: string[] = [];
  let health: GroupHealth = "on_track";

  if (counts.overdueGroupAssignmentCount > 0) {
    health = "need_attention";
    reasons.push(`${counts.overdueGroupAssignmentCount} Bài tập nhóm đã trễ hạn nộp hơn 1 ngày.`);
  }
  if (counts.attentionMemberCount > 0) {
    health = "need_attention";
    const who = counts.attentionMemberNames?.join(", ") ?? `${counts.attentionMemberCount} sinh viên`;
    reasons.push(`${who} đã vắng ≥${MAX_ALLOWED_ABSENCES} buổi.`);
  }
  if (counts.missingSheetsCount > 0) {
    health = "need_attention";
    reasons.push(`${counts.missingSheetsCount} buổi học đã qua chưa nộp attendance sheet.`);
  }
  if (reasons.length === 0) {
    reasons.push("Không có cảnh báo nào.");
  }

  return { health, reasons };
}

function countAbsences(statuses: DefiniteAttendanceStatus[]): number {
  return statuses.filter((s) => s !== "present").length;
}

export function deriveGroupHealthFromMembers(
  members: MemberAttendanceTimeline[],
  missingSheetsCount: number,
  overdueGroupAssignmentCount: number
): GroupHealthResult {
  const attentionMembers = members.filter((m) => countAbsences(m.statuses) >= MAX_ALLOWED_ABSENCES);

  return computeGroupHealth({
    overdueGroupAssignmentCount,
    attentionMemberCount: attentionMembers.length,
    attentionMemberNames: attentionMembers.map((m) => m.displayName),
    missingSheetsCount,
  });
}
