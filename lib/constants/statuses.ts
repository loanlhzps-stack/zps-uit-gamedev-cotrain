// Session status — section 10.3. Rút gọn từ 6 xuống 4 giá trị lưu DB
// (theo yêu cầu của bạn): bỏ hẳn "ready" (rà lại thấy không có logic
// nào phân biệt riêng, thuần thang hiển thị như 5/8 giá trị Assignment
// status cũ) và "cancelled" (bạn xác nhận bỏ hẳn khái niệm buổi bị
// huỷ — muốn huỷ thật thì xoá buổi học, CRUD đã có ở /app/schedule).
//
// "Sắp tới" và "Đang học" KHÔNG phải giá trị lưu DB — tự tính lúc
// hiển thị theo ngày (giống cách "Quá hạn" tự tính cho Assignment
// status): "Sắp tới" = buổi `draft`/`scheduled` gần nhất có ngày >=
// hôm nay (chỉ 1 buổi tại 1 thời điểm); "Đang học" = buổi
// `attendance_open` đúng ngày hôm nay (không đổi cổng chức năng điểm
// danh — buổi attendance_open không đúng ngày hôm nay vẫn hiện nhãn
// gốc "Đang điểm danh"). Xem `getSessionStatusDisplay` (lib/format/
// schedule.ts).
export const SESSION_STATUSES = ["draft", "scheduled", "attendance_open", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  draft: "Nháp",
  scheduled: "Đã lên lịch",
  attendance_open: "Đang điểm danh",
  completed: "Đã hoàn thành",
};

export const SESSION_STATUS_VARIANT: Record<
  SessionStatus,
  "neutral" | "success" | "warning" | "risk" | "info" | "brand"
> = {
  draft: "neutral",
  scheduled: "info",
  attendance_open: "warning",
  completed: "success",
};

// Attendance status — section 11.1
export const ATTENDANCE_STATUSES = [
  "present",
  "excused_absence",
  "unexcused_absence",
  "not_recorded",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Có tham gia",
  excused_absence: "Vắng có phép",
  unexcused_absence: "Vắng không lý do",
  not_recorded: "Chưa ghi nhận",
};

// Course Assignment status — section 12.1
// Rút gọn (theo yêu cầu của bạn, brainstorm lại mục 12.1) — trước đó 8
// giá trị tự do Trainer gõ tay, nhưng 5/8 (published/submitted/late/
// needs_revision) không có logic nào trong app thật sự phân biệt hay
// dùng tới — tiến độ nộp bài chính xác hơn đã có sẵn ở SubmissionStatus
// (riêng theo từng học viên/nhóm). Nay chỉ còn đúng vòng đời của BÀI
// TẬP (không phải bài NỘP): "Đang làm" ngay khi Trainer/Mentor giao,
// "Hoàn thành" khi Trainer coi như xong đợt. "Quá hạn" KHÔNG phải 1
// giá trị lưu DB — tự tính hiển thị (status="in_progress" và đã qua
// due_at) ở AssignmentStatusBadge, không cần ai tự đổi khi trễ hạn.
// "Nháp"/"Lưu trữ" bỏ hẳn — draft chưa từng thật sự ẩn bài khỏi học
// viên (chỉ bớt 2 chỗ tính toán), archived chưa cần dùng tới.
export const ASSIGNMENT_STATUSES = ["in_progress", "completed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

// Checkpoint result package status — section 14.3
export const RESULT_STATUSES = [
  "awaiting_submissions",
  "submissions_closed",
  "results_being_consolidated",
  "result_uploaded",
  "published",
  "withdrawn",
] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

// Group health — section 17 (theo yêu cầu của bạn: rút gọn còn đúng 2
// mức để không bị loãng — bỏ hẳn "At risk", mọi cảnh báo đều gộp về
// "Need attention". Chi tiết rule ở lib/attendance/health.ts.
export const GROUP_HEALTH = ["on_track", "need_attention"] as const;
export type GroupHealth = (typeof GROUP_HEALTH)[number];

export const GROUP_HEALTH_LABELS: Record<GroupHealth, string> = {
  on_track: "On track",
  need_attention: "Need attention",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  in_progress: "Đang làm",
  completed: "Hoàn thành",
};

export const ASSIGNMENT_STATUS_VARIANT: Record<AssignmentStatus, "success" | "brand"> = {
  in_progress: "brand",
  completed: "success",
};

// Submission status — section 12.3. Same deliberate simplification as
// attendance_sheets (see README "flagged deviations"): the workflow
// only ever moves the DB value between 'draft', 'locked' and
// 'needs_revision'/'completed' — 'submitted' stays a valid enum value
// but the UI never sets it (submit = lock, matching "Lock the
// submitted version").
export const SUBMISSION_STATUSES = ["draft", "submitted", "locked", "needs_revision", "completed"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Nháp",
  submitted: "Đã nộp",
  locked: "Đã nộp — chờ review",
  needs_revision: "Cần chỉnh sửa lại",
  completed: "Đã hoàn thành",
};

export const SUBMISSION_STATUS_VARIANT: Record<
  SubmissionStatus,
  "neutral" | "success" | "warning" | "risk" | "info" | "brand"
> = {
  draft: "neutral",
  submitted: "warning",
  locked: "warning",
  needs_revision: "risk",
  completed: "success",
};

// Submission evidence type — section 12.4. "file" (uploaded file) is
// deferred, same reasoning as avatar upload (README): no Supabase
// Storage bucket/signed-URL infra built yet, done once for every
// upload feature together instead of piecemeal per Phase.
export const SUBMISSION_ASSET_TYPES = ["drive_link", "github_link", "build_link", "video_link"] as const;
export type SubmissionAssetType = (typeof SUBMISSION_ASSET_TYPES)[number];

export const SUBMISSION_ASSET_TYPE_LABELS: Record<SubmissionAssetType, string> = {
  drive_link: "Google Drive",
  github_link: "GitHub",
  build_link: "Game build",
  video_link: "Video/demo",
};

// Final Project — "Tiến độ dự án"/"Build và tài liệu"/"Checklist"
// subtabs (theo yêu cầu của bạn, thay hẳn "Milestone" tự do
// (project_milestones) và "Bài nộp dự án" theo milestone+khoá
// (project_submissions) — 2 bảng/feature cũ đã bị xoá hẳn, xem
// migration 0015_project_progress_builds_checklist.sql).

// "Tiến độ dự án" — hành trình cố định 8 giai đoạn (bạn cung cấp thứ
// tự), khác hẳn "milestone" tự do cũ (1 ô nhập text bất kỳ).
export const PROJECT_MILESTONE_STAGES = [
  "idea",
  "prototype",
  "core_gameplay",
  "content_complete",
  "polish_optimization",
  "rehearsal_1217",
  "final_build",
  "expo_0121",
] as const;
export type ProjectMilestoneStage = (typeof PROJECT_MILESTONE_STAGES)[number];

export const PROJECT_MILESTONE_STAGE_LABELS: Record<ProjectMilestoneStage, string> = {
  idea: "Ý tưởng",
  prototype: "Prototype",
  core_gameplay: "Gameplay cốt lõi",
  content_complete: "Hoàn thiện nội dung",
  polish_optimization: "Polish & Optimization",
  rehearsal_1217: "Rehearsal 17/12",
  final_build: "Final Build",
  expo_0121: "Expo 21/01",
};

// Trạng thái của giai đoạn hiện tại (khác trạng thái checklist bên
// dưới — 2 thang riêng, đừng lẫn).
export const PROJECT_MILESTONE_STATUSES = ["not_started", "in_progress", "needs_feedback", "completed"] as const;
export type ProjectMilestoneStatus = (typeof PROJECT_MILESTONE_STATUSES)[number];

export const PROJECT_MILESTONE_STATUS_LABELS: Record<ProjectMilestoneStatus, string> = {
  not_started: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  needs_feedback: "Chờ feedback/hỗ trợ",
  completed: "Đã hoàn thành",
};

export const PROJECT_MILESTONE_STATUS_VARIANT: Record<
  ProjectMilestoneStatus,
  "neutral" | "success" | "warning" | "risk" | "info" | "brand"
> = {
  not_started: "neutral",
  in_progress: "brand",
  needs_feedback: "warning",
  completed: "success",
};

// "Checklist" — 4 trạng thái mỗi item (thang riêng, KHÁC
// PROJECT_MILESTONE_STATUSES ở trên).
export const PROJECT_CHECKLIST_ITEM_STATUSES = ["not_started", "in_progress", "done", "not_applicable"] as const;
export type ProjectChecklistItemStatus = (typeof PROJECT_CHECKLIST_ITEM_STATUSES)[number];

export const PROJECT_CHECKLIST_ITEM_STATUS_LABELS: Record<ProjectChecklistItemStatus, string> = {
  not_started: "Chưa thực hiện",
  in_progress: "Đang thực hiện",
  done: "Đã xong",
  not_applicable: "Không áp dụng",
};

export const PROJECT_CHECKLIST_ITEM_STATUS_VARIANT: Record<
  ProjectChecklistItemStatus,
  "neutral" | "success" | "warning" | "risk" | "info" | "brand"
> = {
  not_started: "neutral",
  in_progress: "brand",
  done: "success",
  not_applicable: "info",
};

// Danh sách checklist cố định (bạn cung cấp đủ 4 nhóm/15 mục) — định
// nghĩa ở code, KHÔNG lưu DB (giống cách ASSIGNMENT_STATUSES định
// nghĩa nhãn cố định) — DB chỉ lưu trạng thái từng mục theo
// `item_key` (bảng project_checklist_status), mục nào chưa có dòng
// thì hiểu ngầm là "not_started".
export interface ProjectChecklistItemDef {
  key: string;
  label: string;
}
export interface ProjectChecklistCategoryDef {
  key: string;
  label: string;
  items: ProjectChecklistItemDef[];
}

export const PROJECT_CHECKLIST_CATEGORIES: ProjectChecklistCategoryDef[] = [
  {
    key: "gameplay",
    label: "Gameplay & trải nghiệm",
    items: [
      { key: "gameplay_core_loop", label: "Core gameplay loop có thể chơi trọn vẹn." },
      { key: "gameplay_content_scope", label: "Các nội dung chính đã hoàn thành theo scope đã thống nhất." },
      { key: "gameplay_ui_flows", label: "UI/HUD, menu và các luồng thắng–thua–chơi lại hoạt động đầy đủ." },
      { key: "gameplay_tutorial", label: "Người chơi mới có thể hiểu cách chơi qua tutorial hoặc hướng dẫn." },
      { key: "gameplay_audio", label: "Âm thanh và hiệu ứng chính đã được tích hợp." },
    ],
  },
  {
    key: "build_tech",
    label: "Build & kỹ thuật",
    items: [
      { key: "build_installable", label: "Build mới nhất có thể cài đặt, khởi chạy và chơi trên thiết bị mục tiêu." },
      { key: "build_no_blockers", label: "Không còn blocker/critical bug ảnh hưởng đến trải nghiệm chính." },
      { key: "build_known_issues_logged", label: "Các known issues còn lại đã được ghi nhận." },
      { key: "build_docs_updated", label: "Repository, build và hướng dẫn cài đặt đã được cập nhật." },
    ],
  },
  {
    key: "docs_rights",
    label: "Tài liệu & bản quyền",
    items: [
      { key: "docs_asset_license", label: "Asset bên thứ ba đã có nguồn, credit và license phù hợp." },
      { key: "docs_cover_screenshot", label: "Cover và screenshot đại diện đã được upload." },
      { key: "docs_gameplay_video", label: "Gameplay video hoặc trailer đã được upload." },
    ],
  },
  {
    key: "expo_readiness",
    label: "Expo Readiness",
    items: [
      { key: "expo_content_flow", label: "Nội dung và flow trình bày sản phẩm đã được chuẩn bị." },
      { key: "expo_devices_checked", label: "Thiết bị demo, build chính và build dự phòng đã được kiểm tra." },
      { key: "expo_rehearsal_ready", label: "Nhóm đã rehearsal và sẵn sàng trình bày tại Expo." },
    ],
  },
];

// Checkpoint result package status — section 14.3.
export const CHECKPOINT_STATUSES = [
  "awaiting_submissions",
  "submissions_closed",
  "results_being_consolidated",
  "result_uploaded",
  "published",
  "withdrawn",
] as const;
export type CheckpointStatus = (typeof CHECKPOINT_STATUSES)[number];

// Statuses Owner/Co-owner can pick freely from a dropdown before any
// file is uploaded (section 14.2's early flow steps, purely
// informational for Owner/Co-owner — no one else ever sees these,
// since checkpoint_result_packages_select only exposes 'published'
// rows to non-Owner/Co-owner roles). 'result_uploaded' is reached only
// via uploadResultPackage, 'published' only via publishResultPackage,
// 'withdrawn' only via withdrawResultPackage — never through this
// dropdown.
export const CHECKPOINT_PLANNING_STATUSES = ["awaiting_submissions", "submissions_closed", "results_being_consolidated"] as const;

export const CHECKPOINT_STATUS_LABELS: Record<CheckpointStatus, string> = {
  awaiting_submissions: "Chờ nhóm nộp bằng chứng",
  submissions_closed: "Đã đóng nộp bằng chứng",
  results_being_consolidated: "Đang tổng hợp kết quả",
  result_uploaded: "Đã tải lên — chưa công bố",
  published: "Đã công bố",
  withdrawn: "Đã thu hồi",
};

export const CHECKPOINT_STATUS_VARIANT: Record<CheckpointStatus, "neutral" | "success" | "warning" | "risk" | "info" | "brand"> = {
  awaiting_submissions: "neutral",
  submissions_closed: "info",
  results_being_consolidated: "brand",
  result_uploaded: "warning",
  published: "success",
  withdrawn: "risk",
};

// Notification type — section 16.1.
export const NOTIFICATION_TYPES = [
  "attendance_risk",
  "missing_attendance_sheet",
  "deadline",
  "submission",
  "revision",
  "checkpoint_published",
  "group_change",
  "reminder",
  "invitation",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  attendance_risk: "Cảnh báo điểm danh",
  missing_attendance_sheet: "Thiếu attendance sheet",
  deadline: "Deadline",
  submission: "Bài nộp mới",
  revision: "Cần chỉnh sửa lại",
  checkpoint_published: "Checkpoint đã công bố",
  group_change: "Thay đổi nhóm",
  reminder: "Nhắc nhở",
  invitation: "Lời mời",
};
