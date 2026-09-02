// Role codes — see Design Doc section 4.1
export const ROLES = [
  "owner",
  "co_owner",
  "sponsor",
  "trainer",
  "mentor_zps",
  "mentor_student",
  "student",
] as const;

export type Role = (typeof ROLES)[number];

// Roles tied to a specific group (section 3.2/13) — Trainer is assigned
// per-session instead (sessions.trainer_profile_ids, section 4.2), and
// Owner/Co-owner/Sponsor operate at the whole-program level, so neither
// shows a group-reassignment control in People & Access.
export const GROUP_ASSIGNABLE_ROLES = ["student", "mentor_zps", "mentor_student"] as const;

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Program Owner",
  co_owner: "Program Co-owner",
  sponsor: "President", // theo yêu cầu của bạn — đổi tên hiển thị, role code nội bộ vẫn giữ "sponsor" (không đổi DB/RLS)
  trainer: "Trainer",
  mentor_zps: "Mentor ZPS",
  mentor_student: "Mentor Sinh viên",
  student: "Sinh viên",
};

// Section 7.2 — supporting sentence on Home, by role
export const ROLE_WELCOME_SUBTITLE: Record<Role, string> = {
  owner: "Game On. Skill Up. Grow Together!",
  co_owner: "Game On. Skill Up. Grow Together!",
  sponsor: "Tổng quan tình hình đào tạo môn học.",
  trainer: "Buổi học và bài tập bạn phụ trách đang ở đây.",
  mentor_zps: "Cùng theo sát nhịp học và tiến độ của nhóm.",
  mentor_student: "Cùng theo sát nhịp học và tiến độ của nhóm.",
  student: "Game On. Skill Up. Grow Together!",
};
