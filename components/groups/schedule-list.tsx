import Link from "next/link";
import { ExternalLink, Zap } from "lucide-react";
import { SessionStatusBadge } from "@/components/schedule/session-status-badge";
import { Card } from "@/components/ui/card";
import {
  formatSessionDate,
  formatSessionWeekday,
  getDaysUntil,
  getNearestUpcomingSessionId,
  getSessionStatusDisplay,
  getTodayIsoDate,
} from "@/lib/format/schedule";
import { cn } from "@/lib/utils";
import type { GroupScheduleRow } from "@/lib/groups/queries";

/**
 * "Thời khóa biểu" tab — read-only, program-wide schedule annotated for
 * this group. Editing a session stays on /app/schedule (reuse-not-
 * rebuild, see lib/groups/queries.ts header).
 *
 * Giao diện đồng bộ với /app/schedule (bảng Buổi/Ngày/Nội dung học/
 * Trainer + progress + legend + highlight buổi học tiếp theo) — chỉ
 * bỏ phần chỉ thuộc trang chính (tiêu đề trang, nút "+ Thêm buổi
 * học"), vì tab này đã nằm sẵn trong Card của Group Workspace.
 */
export function ScheduleList({ rows }: { rows: GroupScheduleRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-text-secondary">Chương trình chưa có buổi học nào.</p>;
  }

  const todayIso = getTodayIsoDate();
  const nearestUpcomingId = getNearestUpcomingSessionId(
    rows.map((r) => ({ id: r.sessionId, status: r.status, session_date: r.sessionDate })),
    todayIso
  );
  const nearestUpcomingRow = rows.find((r) => r.sessionId === nearestUpcomingId) ?? null;
  const daysUntilNext = nearestUpcomingRow ? getDaysUntil(nearestUpcomingRow.sessionDate, todayIso) : null;
  const completedCount = rows.filter((r) => r.status === "completed").length;
  const completionPercent = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-text-primary">
          {completedCount}/{rows.length} buổi đã hoàn thành
        </p>
        <span className="text-[13px] font-bold text-text-primary">{completionPercent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-background">
        <div className="h-full bg-brand-gradient" style={{ width: `${completionPercent}%` }} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
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
              {rows.map((s, index) => {
                const isNext = s.sessionId === nearestUpcomingId;
                const href = `/app/schedule/${s.sessionId}`;

                return (
                  <tr
                    key={s.sessionId}
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
                        {formatSessionWeekday(s.sessionDate)}, {formatSessionDate(s.sessionDate)}
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
                          {s.blocks.join(" · ") || "Chưa có learning block"}
                        </span>
                        {s.relatedAssignmentTitles.length > 0 && (
                          <span className="mt-0.5 block text-[11.5px] text-text-secondary">
                            Bài tập liên quan: {s.relatedAssignmentTitles.join(", ")}
                          </span>
                        )}
                      </Link>
                      {s.surveyUrl && (
                        <a
                          href={s.surveyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="-mt-1 mb-2 flex items-center gap-1 px-4 text-[12px] font-semibold text-brand-orange-3 hover:underline"
                        >
                          Thực hiện khảo sát buổi học
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {s.trainerNames.length > 0 ? s.trainerNames.join(", ") : "Chưa gán Trainer"}
                    </td>
                    <td className="px-4 py-3">
                      <SessionStatusBadge display={getSessionStatusDisplay(s.status, isNext)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
