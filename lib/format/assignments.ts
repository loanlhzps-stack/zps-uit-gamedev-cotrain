import { format, differenceInCalendarDays } from "date-fns";
import { vi } from "date-fns/locale";
import type { AssignmentStatus } from "@/lib/constants/statuses";

/** Full date + time, for a Course Assignment/Mentor Task due_at (unlike sessions, deadlines DO need a time-of-day — section 17.1 "within 48 hours"). */
export function formatDueAt(iso: string): string {
  return format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi });
}

/** Short relative label ("Còn 2 ngày" / "Quá hạn 1 ngày" / "Hôm nay") for deadline widgets. */
export function formatDueRelative(iso: string): string {
  const days = differenceInCalendarDays(new Date(iso), new Date());
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Còn 1 ngày";
  return `Còn ${days} ngày`;
}

/** For a <input type="datetime-local"> defaultValue from an ISO timestamptz string. */
export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


/**
 * "Quá hạn" không phải 1 AssignmentStatus lưu DB (theo yêu cầu của
 * bạn — brainstorm lại mục 12.1, xem lib/constants/statuses.ts) — tự
 * tính từ due_at khi status vẫn "in_progress" mà đã qua hạn. Đặt ở
 * đây (hàm thuần, ngoài component) thay vì gọi `Date.now()` trực tiếp
 * trong AssignmentStatusBadge để không dính lỗi eslint
 * react-hooks/purity (component phải pure trong lúc render).
 */
export function isAssignmentOverdue(status: AssignmentStatus, dueAt: string | null | undefined): boolean {
  if (status !== "in_progress" || !dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}