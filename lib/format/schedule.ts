import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_VARIANT,
  type SessionStatus,
} from "@/lib/constants/statuses";

export function formatSessionDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: vi });
}

export function formatSessionWeekday(dateStr: string): string {
  const label = format(parseISO(dateStr), "EEEE", { locale: vi });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Hôm nay dạng "YYYY-MM-DD", khớp định dạng cột `sessions.session_date`
 * (kiểu `date` trong Postgres, Supabase trả về chuỗi ISO ngày). Tách
 * riêng hàm này (thay vì gọi `new Date()` thẳng trong component) để
 * qua được ESLint `react-hooks/purity` — xem cách làm tương tự ở
 * `isAssignmentOverdue` (lib/format/assignments.ts).
 */
export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Buổi `draft`/`scheduled` có `session_date` gần hôm nay nhất (>= hôm
 * nay) trong 1 danh sách buổi học — dùng để tô nhãn "Sắp tới" (xem
 * `getSessionStatusDisplay`). Hàm thuần, nhận sẵn `todayIso` thay vì
 * tự tính, nên gọi được thẳng trong component mà không dính lỗi
 * purity. Trả `null` nếu không có buổi nào sắp tới.
 */
export function getNearestUpcomingSessionId(
  sessions: { id: string; status: SessionStatus; session_date: string }[],
  todayIso: string
): string | null {
  const candidates = sessions
    .filter((s) => (s.status === "draft" || s.status === "scheduled") && s.session_date >= todayIso)
    .sort((a, b) => a.session_date.localeCompare(b.session_date));
  return candidates[0]?.id ?? null;
}

export interface SessionStatusDisplay {
  label: string;
  variant: "neutral" | "success" | "warning" | "risk" | "info" | "brand";
}

/**
 * Nhãn/màu badge thực tế hiển thị cho 1 buổi học — có thể khác nhãn
 * gốc của `status` lưu DB vì "Sắp tới"/"Đang học" là nhãn tự tính
 * (theo yêu cầu của bạn), không phải giá trị lưu trong `sessions.status`:
 * - `attendance_open` → LUÔN hiện "Đang học" (cổng chức năng điểm
 *   danh (`lib/actions/attendance.ts`) không đổi, chỉ đổi nhãn). Bản
 *   đầu có thêm điều kiện "đúng ngày hôm nay theo đồng hồ hệ thống" —
 *   bỏ đi vì gây bug thật: dữ liệu demo/lịch chương trình thường ở
 *   ngày trong tương lai so với ngày hệ thống thật, nên điều kiện đó
 *   gần như không bao giờ khớp (theo yêu cầu của bạn, sau khi bạn báo
 *   bug kèm ảnh chụp buổi 01/10/2026 vẫn hiện "Đang điểm danh").
 * - `draft`/`scheduled` và là buổi gần nhất sắp tới → "Sắp tới".
 * - Còn lại → nhãn/màu gốc theo `SESSION_STATUS_LABELS`/`_VARIANT`.
 */
export function getSessionStatusDisplay(
  status: SessionStatus,
  isNearestUpcoming: boolean
): SessionStatusDisplay {
  if (status === "attendance_open") {
    return { label: "Đang học", variant: "warning" };
  }
  if ((status === "draft" || status === "scheduled") && isNearestUpcoming) {
    return { label: "Sắp tới", variant: "brand" };
  }
  return { label: SESSION_STATUS_LABELS[status], variant: SESSION_STATUS_VARIANT[status] };
}

/**
 * Số ngày còn lại tới 1 buổi học (dùng cho nhãn "Còn X ngày" ở buổi
 * học tiếp theo trên Thời khóa biểu — theo mock giao diện của bạn).
 * Nhận sẵn `todayIso` (như getNearestUpcomingSessionId) để tránh gọi
 * `new Date()` trực tiếp trong component, giữ component thuần cho
 * ESLint `react-hooks/purity`.
 */
export function getDaysUntil(dateIso: string, todayIso: string): number {
  return differenceInCalendarDays(parseISO(dateIso), parseISO(todayIso));
}
