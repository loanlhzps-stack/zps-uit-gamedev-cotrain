"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  type AttendanceStatus,
} from "@/lib/constants/statuses";
import { saveAttendanceRecords, submitAndLockAttendanceSheet, reopenAttendanceSheet } from "@/lib/actions/attendance";
import { SheetStatusBadge } from "@/components/attendance/sheet-status-badge";

const STATUS_BADGE_VARIANT: Record<AttendanceStatus, "neutral" | "success" | "warning" | "risk"> = {
  present: "success",
  excused_absence: "warning",
  unexcused_absence: "risk",
  not_recorded: "neutral",
};

export interface AttendanceRecordInput {
  id: string;
  profileId: string;
  displayName: string;
  status: AttendanceStatus;
  note: string | null;
}

export function AttendanceSheetEditor({
  sessionId,
  groupId,
  sheetId,
  status,
  canOperate,
  isOwnerOrCo,
  canSeeNotes,
  submittedByName,
  submittedAt,
  reopenedByName,
  reopenedAt,
  reopenedReason,
  records,
}: {
  sessionId: string;
  groupId: string;
  sheetId: string;
  status: "open" | "submitted" | "locked" | "reopened";
  canOperate: boolean;
  isOwnerOrCo: boolean;
  canSeeNotes: boolean;
  submittedByName: string | null;
  submittedAt: string | null;
  reopenedByName: string | null;
  reopenedAt: string | null;
  reopenedReason: string | null;
  records: AttendanceRecordInput[];
}) {
  const canEdit = (isOwnerOrCo || canOperate) && status !== "locked";
  const [rows, setRows] = React.useState(records);
  const [savePending, setSavePending] = React.useState(false);
  const [submitPending, setSubmitPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  // Section 20 — unsaved-change protection: a Mentor ticking 20
  // students' status could easily lose it all on an accidental
  // tab close/reload before "Lưu nháp".
  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function updateRow(id: string, patch: Partial<AttendanceRecordInput>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
    setDirty(true);
  }

  async function handleSave() {
    setSavePending(true);
    setError(null);
    setSaved(false);
    const result = await saveAttendanceRecords(
      sessionId,
      groupId,
      sheetId,
      rows.map((r) => ({ recordId: r.id, status: r.status, note: r.note ?? "" }))
    );
    setSavePending(false);
    if (result.error) setError(result.error);
    else {
      setSaved(true);
      setDirty(false);
    }
  }

  async function handleSubmit() {
    setSubmitPending(true);
    setError(null);
    // Save whatever's on screen first so nothing is lost on lock.
    const saveResult = await saveAttendanceRecords(
      sessionId,
      groupId,
      sheetId,
      rows.map((r) => ({ recordId: r.id, status: r.status, note: r.note ?? "" }))
    );
    if (saveResult.error) {
      setSubmitPending(false);
      setError(saveResult.error);
      return;
    }
    const result = await submitAndLockAttendanceSheet(sessionId, groupId, sheetId);
    setSubmitPending(false);
    if (result.error) setError(result.error);
    else setDirty(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Điểm danh nhóm</CardTitle>
          <SheetStatusBadge status={status} />
        </div>
        {status === "locked" && submittedByName && (
          <CardDescription>
            Đã nộp bởi {submittedByName}
            {submittedAt && ` · ${new Date(submittedAt).toLocaleString("vi-VN")}`}
          </CardDescription>
        )}
        {status === "reopened" && reopenedByName && (
          <CardDescription>
            Mở lại bởi {reopenedByName}
            {reopenedAt && ` · ${new Date(reopenedAt).toLocaleString("vi-VN")}`} — lý do: {reopenedReason}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border text-text-secondary">
              <tr>
                <th className="py-2 pr-3 font-semibold">Sinh viên</th>
                <th className="py-2 pr-3 font-semibold">Trạng thái</th>
                {canSeeNotes && <th className="py-2 font-semibold">Ghi chú (nội bộ)</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-text-primary">{r.displayName}</td>
                  <td className="py-2.5 pr-3">
                    {canEdit ? (
                      <select
                        value={r.status}
                        onChange={(e) => updateRow(r.id, { status: e.target.value as AttendanceStatus })}
                        className="h-9 rounded-lg border border-border bg-background px-2 text-[12px] text-text-primary outline-none focus:border-brand-orange-2"
                      >
                        {ATTENDANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ATTENDANCE_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant={STATUS_BADGE_VARIANT[r.status]}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
                    )}
                  </td>
                  {canSeeNotes && (
                    <td className="py-2.5">
                      {canEdit ? (
                        <input
                          value={r.note ?? ""}
                          onChange={(e) => updateRow(r.id, { note: e.target.value })}
                          placeholder="Vắng có phép vì…"
                          className="h-9 w-full min-w-[10rem] rounded-lg border border-border bg-background px-2 text-[12px] text-text-primary outline-none focus:border-brand-orange-2"
                        />
                      ) : (
                        <span className="text-text-secondary">{r.note || "—"}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canSeeNotes ? 3 : 2} className="py-6 text-center text-text-secondary">
                    Nhóm chưa có thành viên nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
            {error}
          </p>
        )}
        {saved && !savePending && (
          <p role="status" className="text-[12px] font-medium text-success">
            Đã lưu.
          </p>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button size="sm" variant="secondary" onClick={handleSave} disabled={savePending || submitPending}>
              {savePending ? "Đang lưu…" : "Lưu nháp"}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={savePending || submitPending}>
              {submitPending ? "Đang nộp…" : "Nộp & khoá điểm danh"}
            </Button>
          </div>
        )}

        {isOwnerOrCo && status === "locked" && (
          <ReopenSection sessionId={sessionId} groupId={groupId} sheetId={sheetId} />
        )}
      </CardContent>
    </Card>
  );
}

function ReopenSection({ sessionId, groupId, sheetId }: { sessionId: string; groupId: string; sheetId: string }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleReopen() {
    if (!open) {
      setOpen(true);
      return;
    }
    setPending(true);
    setError(null);
    const result = await reopenAttendanceSheet(sessionId, groupId, sheetId, reason);
    setPending(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="border-t border-border pt-4">
      <h3 className="mb-1 text-[13px] font-bold text-text-primary">Mở lại điểm danh</h3>
      <p className="mb-2 text-[12px] text-text-secondary">
        Cần lý do — được ghi lại vào audit log.
      </p>
      {open && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Vì sao cần mở lại sheet này?"
          className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
        />
      )}
      <Button type="button" size="sm" variant="destructive" onClick={handleReopen} disabled={pending}>
        {pending ? "Đang mở lại…" : open ? "Xác nhận mở lại" : "Mở lại điểm danh"}
      </Button>
      {error && <p className="mt-1.5 text-[11px] font-medium text-risk">{error}</p>}
    </div>
  );
}
