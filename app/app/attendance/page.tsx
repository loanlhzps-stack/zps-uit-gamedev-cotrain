import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { SheetStatusBadge } from "@/components/attendance/sheet-status-badge";
import {
  getAttendanceOverviewRows,
  getMentorGroupIds,
  type AttendanceOverviewRow,
} from "@/lib/attendance/queries";
import { formatSessionDate, formatSessionWeekday } from "@/lib/format/schedule";

export default async function AttendancePage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  // Student: xem % tham gia ở Trang chủ, xem bảng điểm danh nhóm qua
  // Nhóm dự án (tab Điểm danh của nhóm mình). Trainer: không còn quyền
  // xem Điểm danh nữa (theo yêu cầu của bạn, xem 0017_trainer_view_scope.sql).
  // Sponsor (President): cũng bỏ hẳn — số liệu attendance trung bình
  // toàn chương trình vẫn xem được ở Trang chủ như trước, chỉ bỏ tab
  // riêng (theo yêu cầu của bạn).
  if (user.role === "student" || user.role === "trainer" || user.role === "sponsor") {
    redirect("/app");
  }

  if (user.role === "owner" || user.role === "co_owner") {
    const rows = await getAttendanceOverviewRows(user.programId);
    return <OverviewSection rows={rows} />;
  }

  // mentor_zps / mentor_student — chỉ còn 2 role tới được đây.
  const [allRows, groupIds] = await Promise.all([
    getAttendanceOverviewRows(user.programId),
    getMentorGroupIds(user.id),
  ]);
  const rows = allRows.filter((r) => groupIds.includes(r.groupId));
  return <MentorSection rows={rows} />;
}

function OverviewSection({ rows }: { rows: AttendanceOverviewRow[] }) {
  const needsAttention = rows.filter((r) => r.sheetStatus === "missing" || r.sheetStatus === "open").length;

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <p className="text-[13px] text-text-secondary">
          {`${needsAttention} sheet cần chú ý (chưa mở hoặc chưa nộp) trên tổng ${rows.length}.`}
        </p>
      )}
      <AttendanceTable rows={rows} emptyLabel="Chưa có dữ liệu điểm danh." />
    </div>
  );
}

function MentorSection({ rows }: { rows: AttendanceOverviewRow[] }) {
  const pending = rows.filter((r) => r.sheetStatus !== "locked" && r.sheetStatus !== "submitted");
  const done = rows.filter((r) => r.sheetStatus === "locked" || r.sheetStatus === "submitted");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cần điểm danh</CardTitle>
          <CardDescription>
            Bấm vào buổi học để tick điểm danh cho nhóm của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceTable rows={pending} emptyLabel="Không có buổi nào đang chờ điểm danh." hideGroupColumn />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceTable rows={done} emptyLabel="Chưa có sheet nào đã nộp." hideGroupColumn />
        </CardContent>
      </Card>
    </div>
  );
}


function AttendanceTable({
  rows,
  emptyLabel,
  hideGroupColumn,
}: {
  rows: AttendanceOverviewRow[];
  emptyLabel: string;
  hideGroupColumn?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-text-secondary">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-border text-text-secondary">
          <tr>
            <th className="py-2 pr-3 font-semibold">Buổi học</th>
            {!hideGroupColumn && <th className="py-2 pr-3 font-semibold">Nhóm</th>}
            <th className="py-2 font-semibold">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.sessionId}:${r.groupId}`} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-3">
                <Link
                  href={`/app/attendance/${r.sessionId}/${r.groupId}`}
                  className="font-semibold text-brand-orange-3 hover:underline"
                >
                  {formatSessionWeekday(r.sessionDate)}, {formatSessionDate(r.sessionDate)}
                </Link>
              </td>
              {!hideGroupColumn && (
                <td className="py-2.5 pr-3">
                  <Link href={`/app/groups/${r.groupId}?tab=attendance`} className="text-text-primary hover:text-brand-orange-3 hover:underline">
                    {r.groupName}
                  </Link>
                </td>
              )}
              <td className="py-2.5">
                <SheetStatusBadge status={r.sheetStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
