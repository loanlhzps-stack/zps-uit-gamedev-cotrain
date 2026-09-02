import Link from "next/link";
import { ATTENDANCE_STATUS_LABELS, type AttendanceStatus } from "@/lib/constants/statuses";
import { formatSessionDate } from "@/lib/format/schedule";
import type { GroupAttendanceMatrix as GroupAttendanceMatrixData } from "@/lib/groups/queries";

const CELL_LABEL: Record<AttendanceStatus, string> = {
  present: "C",
  excused_absence: "VP",
  unexcused_absence: "VK",
  not_recorded: "–",
};

const CELL_CLASS: Record<AttendanceStatus, string> = {
  present: "bg-success/10 text-success",
  excused_absence: "bg-warning/10 text-warning",
  unexcused_absence: "bg-risk/10 text-risk",
  not_recorded: "bg-background text-text-secondary",
};

/**
 * "Attendance" tab — read-only member × session matrix. Actual fill-
 * in/submit/reopen stays on /app/attendance/[sessionId]/[groupId]
 * (linked per-session below) rather than being duplicated here.
 */
export function AttendanceMatrix({ data, groupId }: { data: GroupAttendanceMatrixData; groupId: string }) {
  if (data.sessions.length === 0) {
    return <p className="text-[13px] text-text-secondary">Chưa có buổi học nào mở điểm danh.</p>;
  }
  if (data.members.length === 0) {
    return <p className="text-[13px] text-text-secondary">Nhóm chưa có thành viên nào.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-secondary">
            <th className="sticky left-0 bg-surface py-2 pr-3 font-semibold">Thành viên</th>
            {data.sessions.map((s) => (
              <th key={s.id} className="px-1.5 py-2 text-center font-semibold">
                <Link href={`/app/attendance/${s.id}/${groupId}`} className="hover:underline">
                  {formatSessionDate(s.sessionDate)}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.members.map((m) => (
            <tr key={m.profileId} className="border-b border-border last:border-0">
              <td className="sticky left-0 bg-surface py-2 pr-3 font-semibold text-text-primary">{m.displayName}</td>
              {data.sessions.map((s) => {
                const status = data.cellStatus[`${s.id}:${m.profileId}`] ?? "not_recorded";
                return (
                  <td key={s.id} className="px-1.5 py-2 text-center">
                    <span
                      title={ATTENDANCE_STATUS_LABELS[status]}
                      className={`inline-flex size-6 items-center justify-center rounded-md text-[10.5px] font-bold ${CELL_CLASS[status]}`}
                    >
                      {CELL_LABEL[status]}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-text-secondary">
        C = Có tham gia · VP = Vắng có phép · VK = Vắng không lý do · Bấm vào ngày để mở sheet điểm danh.
      </p>
    </div>
  );
}
