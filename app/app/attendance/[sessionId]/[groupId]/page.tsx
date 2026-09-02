import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { getGroupAttendanceAccess } from "@/lib/attendance/access";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AttendanceSheetEditor, type AttendanceRecordInput } from "@/components/attendance/attendance-sheet-editor";
import { formatSessionDate, formatSessionWeekday } from "@/lib/format/schedule";
import { OpenSheetButton } from "@/components/attendance/open-sheet-button";
import type { AttendanceStatus } from "@/lib/constants/statuses";

interface SheetRow {
  id: string;
  status: "open" | "submitted" | "locked" | "reopened";
  submitted_by: string | null;
  submitted_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  reopened_reason: string | null;
}

export default async function AttendanceSheetPage({
  params,
}: {
  params: Promise<{ sessionId: string; groupId: string }>;
}) {
  const { sessionId, groupId } = await params;
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }

  const access = await getGroupAttendanceAccess(groupId);
  if (!access.ok) {
    notFound();
  }
  const { supabase, isOwnerOrCo, canOperate, canSeeNotes, programId } = access;

  const [{ data: session }, { data: group }] = await Promise.all([
    supabase.from("sessions").select("id, session_date, status, program_id").eq("id", sessionId).maybeSingle(),
    supabase.from("groups").select("id, name, program_id").eq("id", groupId).maybeSingle(),
  ]);

  if (!session || !group || session.program_id !== programId || group.program_id !== programId) {
    notFound();
  }

  // No further app-level view gate beyond program membership above —
  // attendance_sheets_select/attendance_records_select (0002_rls.sql)
  // already scope reads to Owner/Co-owner, Trainer, group members and
  // assigned Mentors. A viewer RLS excludes (e.g. Sponsor) simply gets
  // an empty sheet/records result below, which reads as "no data" —
  // Sponsor's own aggregate view lives on /app/attendance instead.
  const { data: sheet } = await supabase
    .from("attendance_sheets")
    .select("id, status, submitted_by, submitted_at, reopened_by, reopened_at, reopened_reason")
    .eq("session_id", sessionId)
    .eq("group_id", groupId)
    .maybeSingle<SheetRow>();

  let submittedByName: string | null = null;
  let reopenedByName: string | null = null;
  if (sheet?.submitted_by) {
    const { data } = await supabase.from("profiles").select("display_name").eq("id", sheet.submitted_by).maybeSingle();
    submittedByName = data?.display_name ?? null;
  }
  if (sheet?.reopened_by) {
    const { data } = await supabase.from("profiles").select("display_name").eq("id", sheet.reopened_by).maybeSingle();
    reopenedByName = data?.display_name ?? null;
  }

  let records: AttendanceRecordInput[] = [];
  if (sheet) {
    const selectCols = canSeeNotes
      ? "id, profile_id, status, note, profiles ( display_name )"
      : "id, profile_id, status, profiles ( display_name )";
    const { data: recordRows } = await supabase
      .from("attendance_records")
      .select(selectCols)
      .eq("attendance_sheet_id", sheet.id)
      .returns<
        {
          id: string;
          profile_id: string;
          status: AttendanceStatus;
          note?: string | null;
          profiles: { display_name: string } | null;
        }[]
      >();
    records = (recordRows ?? [])
      .map((r) => ({
        id: r.id,
        profileId: r.profile_id,
        displayName: r.profiles?.display_name ?? "—",
        status: r.status,
        note: canSeeNotes ? (r.note ?? null) : null,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
  }

  return (
    <div className="space-y-5">
      <Link
        href="/app/attendance"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Attendance
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{group.name}</CardTitle>
          <CardDescription>
            {formatSessionWeekday(session.session_date)}, {formatSessionDate(session.session_date)}
          </CardDescription>
        </CardHeader>
        {!sheet && (
          <CardContent>
            {session.status !== "attendance_open" && session.status !== "completed" ? (
              <p className="text-[13px] text-text-secondary">
                Buổi học chưa mở điểm danh — Owner/Co-owner cần chuyển trạng thái buổi học sang &quot;Đang điểm
                danh&quot; hoặc &quot;Đã hoàn thành&quot; trước (xem trang chi tiết buổi học).
              </p>
            ) : isOwnerOrCo || canOperate ? (
              <div className="space-y-2">
                <p className="text-[13px] text-text-secondary">Chưa có attendance sheet cho nhóm này.</p>
                <OpenSheetButton sessionId={sessionId} groupId={groupId} />
              </div>
            ) : (
              <p className="text-[13px] text-text-secondary">Chưa có attendance sheet cho nhóm này.</p>
            )}
          </CardContent>
        )}
      </Card>

      {sheet && (
        <AttendanceSheetEditor
          sessionId={sessionId}
          groupId={groupId}
          sheetId={sheet.id}
          status={sheet.status}
          canOperate={canOperate}
          isOwnerOrCo={isOwnerOrCo}
          canSeeNotes={canSeeNotes}
          submittedByName={submittedByName}
          submittedAt={sheet.submitted_at}
          reopenedByName={reopenedByName}
          reopenedAt={sheet.reopened_at}
          reopenedReason={sheet.reopened_reason}
          records={records}
        />
      )}
    </div>
  );
}
