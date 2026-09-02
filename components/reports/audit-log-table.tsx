import type { AuditLogEntry } from "@/lib/audit/queries";

const ACTION_LABELS: Record<string, string> = {
  attendance_reopen: "Mở lại attendance sheet",
  assignment_review_override: "Owner/Co-owner review thay Trainer",
  project_submission_reopen: "Mở lại bài nộp Final Project",
  checkpoint_publish: "Công bố kết quả Checkpoint",
  checkpoint_withdraw: "Thu hồi kết quả Checkpoint",
};

/**
 * Permission matrix "View audit log" (Owner/Co-owner only, mục 4.2) —
 * every row already written by Phase 6-9 (attendance reopen, assignment
 * review override, project submission reopen, checkpoint publish/
 * withdraw). Unrecognized `action` values fall back to the raw string
 * so a future action type still renders instead of disappearing.
 */
export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-text-secondary">Chưa có audit log nào.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-secondary">
            <th className="py-2 pr-3 font-semibold">Thời gian</th>
            <th className="py-2 pr-3 font-semibold">Người thực hiện</th>
            <th className="py-2 pr-3 font-semibold">Hành động</th>
            <th className="py-2 font-semibold">Lý do</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-3 text-text-secondary">{new Date(e.createdAt).toLocaleString("vi-VN")}</td>
              <td className="py-2.5 pr-3 font-semibold text-text-primary">{e.actorName ?? "—"}</td>
              <td className="py-2.5 pr-3 text-text-secondary">{ACTION_LABELS[e.action] ?? e.action}</td>
              <td className="py-2.5 text-text-secondary">{e.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
