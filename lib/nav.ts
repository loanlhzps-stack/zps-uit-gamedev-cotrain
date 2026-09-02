import type { Role } from "@/lib/constants/roles";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  BookOpenCheck,
  Users2,
  UserCog,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[]; // section 6.2 — role-aware navigation
}

const ALL_ROLES: Role[] = [
  "owner",
  "co_owner",
  "sponsor",
  "trainer",
  "mentor_zps",
  "mentor_student",
  "student",
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Trang chủ", icon: LayoutDashboard, roles: ALL_ROLES },
  {
    href: "/app/schedule",
    label: "Thời khóa biểu",
    icon: CalendarDays,
    roles: ["owner", "co_owner", "sponsor", "trainer"], // mentor/student: xem qua Nhóm dự án (theo yêu cầu của bạn, mentor giờ giống student ở khoản này)
  },
  {
    href: "/app/attendance",
    label: "Điểm danh",
    icon: ClipboardCheck,
    roles: ["owner", "co_owner", "mentor_zps", "mentor_student"], // student: xem qua Nhóm dự án + % ở Trang chủ; trainer/sponsor(President): không có quyền xem điểm danh (theo yêu cầu của bạn)
  },
  {
    href: "/app/assignments",
    label: "Bài tập",
    icon: BookOpenCheck,
    roles: ["owner", "co_owner", "trainer"], // mentor/student: xem qua Nhóm dự án (theo yêu cầu của bạn)
  },
  {
    href: "/app/groups",
    label: "Nhóm dự án",
    icon: Users2,
    roles: ["owner", "co_owner", "sponsor", "mentor_zps", "mentor_student", "student"], // sponsor: read-only, still visible (section 6.2); trainer: không xem Nhóm dự án (theo yêu cầu của bạn)
  },
  {
    href: "/app/people",
    label: "Quản lý thành viên",
    icon: UserCog,
    roles: ["owner"], // theo yêu cầu của bạn — bỏ hẳn khỏi Co-owner (trước đó Co-owner có chế độ chỉ xem)
  },
  // "Báo cáo" đã bỏ hẳn (theo yêu cầu của bạn) — nội dung (Hoàn thành
  // bài tập %, Audit log) đã chuyển hết về Trang chủ Owner/Co-owner,
  // phần còn lại (Tiến độ đào tạo, Attendance sheet còn thiếu, Sức khoẻ
  // 8 nhóm) vốn đã có sẵn ở Trang chủ từ trước. /app/reports giờ chỉ
  // còn là route redirect thẳng về Trang chủ, không hiện trên sidebar
  // của bất kỳ role nào nữa.
  { href: "/app/settings", label: "Cài đặt", icon: Settings, roles: ["owner", "co_owner"] },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
