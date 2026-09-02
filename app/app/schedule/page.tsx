import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { SessionStatusBadge } from "@/components/schedule/session-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatSessionDate,
  formatSessionWeekday,
  getDaysUntil,
  getNearestUpcomingSessionId,
  getSessionStatusDisplay,
  getTodayIsoDate,
} from "@/lib/format/schedule";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/lib/constants/statuses";

interface SessionListRow {
  id: string;
  session_date: string;
  status: SessionStatus;
  location: string | null;
  trainer_profile_ids: string[];
  session_blocks: { id: string; title: string; sort_order: number }[];
}

// Section 10 — "Class normally runs Thursday, 13:30–17:00" (Design Doc)
// là 1 fact cố định của cả môn học, không phải dữ liệu theo từng buổi:
// cột sessions.start_time/end_time đã bỏ hẳn từ 0005_drop_session_times.sql
// (lịch thật cố định giờ mỗi buổi, không cần lưu riêng). Hardcode ở
// đây, không phải field DB.
const FIXED_CLASS_TIME = "13:30–17:00";

export default async function SchedulePage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  // Student/Mentor: xem lịch qua Nhóm dự án (tab Thời khóa biểu của
  // nhóm mình) — mentor thêm vào theo yêu cầu của bạn (rút gọn menu
  // Mentor còn Trang chủ/Điểm danh/Nhóm dự án, xem 0016_mentor_parity.sql).
  if (user.role === "student" || user.role === "mentor_zps" || user.role === "mentor_student") {
    redirect("/app");
  }

  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, session_date, status, location, trainer_profile_ids, session_blocks(id, title, sort_order)"
    )
    .eq("program_id", user.programId)
    .order("session_date", { ascending: true })
    .order("sort_order", { referencedTable: "session_blocks", ascending: true })
    .returns<SessionListRow[]>();

  const rows = sessions ?? [];
  const trainerIds = Array.from(new Set(rows.flatMap((s) => s.trainer_profile_ids)));
  const { data: trainers } = trainerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", trainerIds)
    : { data: [] as { id: string; display_name: string }[] };
  const trainerNameById = new Map((trainers ?? []).map((t) => [t.id, t.display_name]));

  const completedCount = rows.filter((s) => s.status === "completed").length;
  const completionPercent = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;
  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  const todayIso = getTodayIsoDate();
  const nearestUpcomingId = getNearestUpcomingSessionId(rows, todayIso);
  const nearestUpcomingRow = rows.find((r) => r.id === nearestUpcomingId) ?? null;
  const daysUntilNext = nearestUpcomingRow ? getDaysUntil(nearestUpcomingRow.session_date, todayIso) : null;

  // Dòng mô tả đầu trang chỉ hiện tần suất/địa điểm khi TOÀN BỘ buổi
  // học khớp nhau (đúng thực tế hiện tại — cả 16 buổi đều Thứ Năm,
  // VNG Campus) — lệch thì tự ẩn phần đó thay vì hiện sai.
  const weekdays = new Set(rows.map((r) => formatSessionWeekday(r.session_date)));
  const commonWeekday = weekdays.size === 1 ? [...weekdays][0] : null;
  const locations = new Set(rows.map((r) => r.location).filter((l): l is string => !!l));
  const commonLocation = locations.size === 1 && rows.every((r) => r.location) ? [...locations][0] : null;

  const metaParts = [
    `${rows.length} buổi`,
    rows.length > 0
      ? `${formatSessionDate(rows[0].session_date)}–${formatSessionDate(rows[rows.length - 1].session_date)}`
      : null,
    commonWeekday ? `${commonWeekday} hàng tuần` : null,
    FIXED_CLASS_TIME,
    commonLocation,
  ].filter((part): part is string => !!part);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-text-primary">Thời khóa biểu</h2>
          <p className="mt-1 text-[13px] text-text-secondary">{metaParts.join(" · ")}</p>
        </div>
        {isOwnerOrCo && (
          <Link
            href="/app/schedule/new"
            className={buttonVariants({ size: "sm", className: "inline-flex" })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Thêm buổi học
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-text-primary">
              {completedCount}/{rows.length} buổi đã hoàn thành
            </p>
            <span className="text-[13px] font-bold text-text-primary">{completionPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background">
            <div className="h-full bg-brand-gradient" style={{ width: `${completionPercent}%` }} />
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-[13px] text-text-secondary">
            Chưa có buổi học nào trong chương trình.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="border-b border-border text-text-secondary">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Buổi</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Ngày</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Nội dung học</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Trainer|Mentor</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((session, index) => {
                  const isMine = user.role === "trainer" && session.trainer_profile_ids.includes(user.id);
                  const isNext = session.id === nearestUpcomingId;
                  const trainerNames = session.trainer_profile_ids.map((id) => trainerNameById.get(id) ?? "—");
                  const href = `/app/schedule/${session.id}`;

                  return (
                    <tr
                      key={session.id}
                      className={cn(
                        "border-b border-border last:border-0",
                        isNext && "border-l-4 border-l-brand-orange-2 bg-brand-orange-2/5"
                      )}
                    >
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 font-semibold text-text-primary hover:text-brand-orange-3">
                          Buổi {String(index + 1).padStart(2, "0")}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 text-text-primary hover:text-brand-orange-3">
                          {formatSessionDate(session.session_date)}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className="block px-4 py-3 hover:text-brand-orange-3">
                          {isNext && (
                            <p className="mb-0.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-orange-3">
                              <Zap className="size-3" aria-hidden="true" />
                              Buổi học tiếp theo · Còn {daysUntilNext} ngày
                            </p>
                          )}
                          <span className="text-text-primary">
                            {session.session_blocks.map((b) => b.title).join(" · ") || "Chưa có learning block"}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {trainerNames.length > 0 ? (
                          trainerNames.map((name, i) => (
                            <span key={i} className={isMine && name === user.displayName ? "font-bold text-brand-orange-3" : undefined}>
                              {i > 0 && ", "}
                              {name}
                            </span>
                          ))
                        ) : (
                          "Chưa gán Trainer"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SessionStatusBadge display={getSessionStatusDisplay(session.status, isNext)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
