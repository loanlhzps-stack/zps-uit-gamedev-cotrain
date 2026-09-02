"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { SubmissionStatusBadge } from "@/components/assignments/status-badges";
import { SUBMISSION_ASSET_TYPES, SUBMISSION_ASSET_TYPE_LABELS, type SubmissionStatus } from "@/lib/constants/statuses";
import { saveSubmissionDraft, submitOfficialSubmission } from "@/lib/actions/assignments";

export interface SubmissionVersionView {
  id: string;
  versionNumber: number;
  note: string | null;
  createdAt: string;
  createdByName: string;
  assets: { assetType: string; url: string | null }[];
}

export function SubmissionPanel({
  assignmentId,
  ownerLabel,
  submission,
  versions,
}: {
  assignmentId: string;
  ownerLabel: string;
  submission: { id: string; status: SubmissionStatus } | null;
  versions: SubmissionVersionView[];
}) {
  const router = useRouter();
  const [savePending, setSavePending] = React.useState(false);
  const [submitPending, setSubmitPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const canEdit = !submission || submission.status !== "locked";

  // Section 20 — unsaved-change protection: warn before losing a
  // note/links the student typed but hasn't saved as a draft yet.
  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavePending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await saveSubmissionDraft(assignmentId, formData);
    setSavePending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    setDirty(false);
    router.refresh();
  }

  async function handleSubmitOfficial() {
    if (!submission) return;
    setSubmitPending(true);
    setError(null);
    const result = await submitOfficialSubmission(assignmentId, submission.id);
    setSubmitPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Bài nộp — {ownerLabel}</CardTitle>
          {submission ? <SubmissionStatusBadge status={submission.status} /> : <SubmissionStatusBadge status="draft" />}
        </div>
        <CardDescription>
          Mỗi lần lưu tạo một phiên bản mới, giữ lại toàn bộ lịch sử. Nộp chính thức sẽ khoá bài lại.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {versions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-text-primary">Lịch sử version</h3>
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[12.5px] font-semibold text-text-primary">Version {v.versionNumber}</span>
                    <span className="text-[11px] text-text-secondary">
                      {v.createdByName} · {new Date(v.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  {v.note && <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-text-secondary">{v.note}</p>}
                  {v.assets.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {v.assets.map((a, i) => (
                        <a
                          key={i}
                          href={a.url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-orange-3 hover:underline"
                        >
                          {SUBMISSION_ASSET_TYPE_LABELS[a.assetType as keyof typeof SUBMISSION_ASSET_TYPE_LABELS] ?? a.assetType}
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {canEdit ? (
          <form ref={formRef} onSubmit={handleSave} onChange={() => setDirty(true)} className="space-y-3 border-t border-border pt-4">
            <h3 className="text-[13px] font-bold text-text-primary">
              {submission?.status === "needs_revision" ? "Nộp bản chỉnh sửa" : "Thêm minh chứng"}
            </h3>
            <div>
              <label htmlFor="note" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Ghi chú
              </label>
              <textarea
                id="note"
                name="note"
                rows={2}
                placeholder="Mô tả ngắn về bản nộp này…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {SUBMISSION_ASSET_TYPES.map((type) => (
                <div key={type}>
                  <label htmlFor={type} className="mb-1 block text-[12px] font-semibold text-text-primary">
                    {SUBMISSION_ASSET_TYPE_LABELS[type]}
                  </label>
                  <input
                    id={type}
                    name={type}
                    type="url"
                    placeholder="https://…"
                    className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
                  />
                </div>
              ))}
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="submit" size="sm" variant="secondary" disabled={savePending || submitPending}>
                {savePending ? "Đang lưu…" : "Lưu nháp"}
              </Button>
              {submission && (
                <Button type="button" size="sm" onClick={handleSubmitOfficial} disabled={savePending || submitPending}>
                  {submitPending ? "Đang nộp…" : "Nộp chính thức"}
                </Button>
              )}
            </div>
            {!submission && (
              <p className="text-[12px] text-text-secondary">Lưu nháp trước, sau đó mới nộp chính thức được.</p>
            )}
          </form>
        ) : (
          <p className="border-t border-border pt-4 text-[13px] text-text-secondary">
            Bài đã khoá — chờ review. Nếu cần sửa, chờ được chuyển sang &quot;Cần chỉnh sửa lại&quot;.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
