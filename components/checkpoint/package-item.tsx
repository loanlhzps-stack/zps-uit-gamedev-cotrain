"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CHECKPOINT_PLANNING_STATUSES,
  CHECKPOINT_STATUS_LABELS,
  CHECKPOINT_STATUS_VARIANT,
  type CheckpointStatus,
} from "@/lib/constants/statuses";
import {
  setCheckpointStage,
  updateCheckpointMeta,
  uploadResultPackage,
  publishResultPackage,
  withdrawResultPackage,
} from "@/lib/actions/checkpoint";
import type { CheckpointPackage } from "@/lib/checkpoint/queries";

const PLANNING_SET = new Set<string>(CHECKPOINT_PLANNING_STATUSES);

export function PackageItem({ programId, pkg }: { programId: string; pkg: CheckpointPackage }) {
  const router = useRouter();
  const isPlanning = PLANNING_SET.has(pkg.status);
  const [error, setError] = React.useState<string | null>(null);
  const [stagePending, setStagePending] = React.useState(false);
  const [publishPending, setPublishPending] = React.useState(false);
  const [withdrawPending, setWithdrawPending] = React.useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false);

  async function handleStageChange(status: CheckpointStatus) {
    setStagePending(true);
    setError(null);
    const result = await setCheckpointStage(pkg.id, programId, status);
    setStagePending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handlePublish() {
    setPublishPending(true);
    setError(null);
    const result = await publishResultPackage(pkg.id, programId);
    setPublishPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleWithdraw() {
    if (!confirmWithdraw) {
      setConfirmWithdraw(true);
      return;
    }
    setWithdrawPending(true);
    setError(null);
    const result = await withdrawResultPackage(pkg.id, programId);
    setWithdrawPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-bold text-text-primary">{pkg.versionLabel}</span>
        <div className="flex items-center gap-2">
          {isPlanning ? (
            <select
              value={pkg.status}
              disabled={stagePending}
              onChange={(e) => handleStageChange(e.target.value as CheckpointStatus)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-[11.5px] text-text-primary outline-none focus:border-brand-orange-2"
            >
              {CHECKPOINT_PLANNING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CHECKPOINT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          ) : (
            <Badge variant={CHECKPOINT_STATUS_VARIANT[pkg.status]}>{CHECKPOINT_STATUS_LABELS[pkg.status]}</Badge>
          )}
        </div>
      </div>

      {pkg.uploadedAt && (
        <p className="mt-1 text-[11px] text-text-secondary">
          Tải lên bởi {pkg.uploadedByName ?? "—"} · {new Date(pkg.uploadedAt).toLocaleString("vi-VN")}
        </p>
      )}
      {pkg.publishedAt && (
        <p className="mt-0.5 text-[11px] text-text-secondary">
          Công bố bởi {pkg.publishedByName ?? "—"} · {new Date(pkg.publishedAt).toLocaleString("vi-VN")}
        </p>
      )}
      {pkg.withdrawnAt && (
        <p className="mt-0.5 text-[11px] text-text-secondary">Đã thu hồi · {new Date(pkg.withdrawnAt).toLocaleString("vi-VN")}</p>
      )}

      {pkg.status === "withdrawn" ? (
        <p className="mt-2 text-[12.5px] text-text-secondary">
          Package đã thu hồi — dữ liệu vẫn được giữ lại làm lịch sử, tạo package mới để công bố phiên bản tiếp theo.
        </p>
      ) : (
        <PackageFieldsForm key={`${pkg.id}-${pkg.updatedAt}`} programId={programId} pkg={pkg} onError={setError} />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {pkg.status === "result_uploaded" && (
          <Button type="button" size="sm" onClick={handlePublish} disabled={publishPending}>
            {publishPending ? "Đang công bố…" : "Công bố kết quả"}
          </Button>
        )}
        {pkg.status === "published" && (
          <Button type="button" size="sm" variant={confirmWithdraw ? "destructive" : "secondary"} onClick={handleWithdraw} disabled={withdrawPending}>
            {withdrawPending ? "Đang thu hồi…" : confirmWithdraw ? "Xác nhận thu hồi?" : "Thu hồi công bố"}
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-[11.5px] font-medium text-risk">{error}</p>}
    </div>
  );
}

function PackageFieldsForm({
  programId,
  pkg,
  onError,
}: {
  programId: string;
  pkg: CheckpointPackage;
  onError: (error: string | null) => void;
}) {
  const router = useRouter();
  const isPlanning = PLANNING_SET.has(pkg.status);
  const [savePending, setSavePending] = React.useState(false);
  const [uploadPending, setUploadPending] = React.useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavePending(true);
    onError(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateCheckpointMeta(pkg.id, programId, formData);
    setSavePending(false);
    if (result.error) onError(result.error);
    else router.refresh();
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadPending(true);
    onError(null);
    const formData = new FormData(e.currentTarget);
    const result = await uploadResultPackage(pkg.id, programId, formData);
    setUploadPending(false);
    if (result.error) onError(result.error);
    else router.refresh();
  }

  return (
    <form onSubmit={isPlanning ? handleUpload : handleSave} className="mt-3 space-y-2.5 border-t border-border pt-3">
      <div>
        <label htmlFor={`versionLabel-${pkg.id}`} className="mb-1 block text-[11.5px] font-semibold text-text-primary">
          Version label
        </label>
        <input
          id={`versionLabel-${pkg.id}`}
          name="versionLabel"
          required
          defaultValue={pkg.versionLabel}
          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
        />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Field id={`excel-${pkg.id}`} name="excelFileUrl" label="Link file Excel" type="url" defaultValue={pkg.excelFileUrl ?? ""} />
        <Field id={`pdf-${pkg.id}`} name="pdfFileUrl" label="Link file PDF" type="url" defaultValue={pkg.pdfFileUrl ?? ""} />
        <Field id={`drive-${pkg.id}`} name="driveUrl" label="Google Drive" type="url" defaultValue={pkg.driveUrl ?? ""} />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field
          id={`meet-${pkg.id}`}
          name="groupsMeetingExpectations"
          label="Số nhóm đạt kỳ vọng"
          type="number"
          defaultValue={pkg.groupsMeetingExpectations?.toString() ?? ""}
        />
        <Field
          id={`improve-${pkg.id}`}
          name="groupsNeedingImprovement"
          label="Số nhóm cần cải thiện"
          type="number"
          defaultValue={pkg.groupsNeedingImprovement?.toString() ?? ""}
        />
      </div>
      <TextArea id={`highlights-${pkg.id}`} name="highlights" label="Điểm nổi bật" defaultValue={pkg.highlights ?? ""} />
      <TextArea id={`preExpo-${pkg.id}`} name="preExpoActions" label="Việc cần làm trước Expo" defaultValue={pkg.preExpoActions ?? ""} />
      <TextArea id={`notes-${pkg.id}`} name="notes" label="Ghi chú" defaultValue={pkg.notes ?? ""} />

      <Button type="submit" size="sm" variant="secondary" disabled={savePending || uploadPending}>
        {isPlanning
          ? uploadPending
            ? "Đang tải lên…"
            : "Tải lên kết quả"
          : savePending
            ? "Đang lưu…"
            : "Lưu thay đổi"}
      </Button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
  type = "text",
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11.5px] font-semibold text-text-primary">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[12px] text-text-primary outline-none focus:border-brand-orange-2"
      />
    </div>
  );
}

function TextArea({ id, name, label, defaultValue }: { id: string; name: string; label: string; defaultValue: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11.5px] font-semibold text-text-primary">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={2}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-brand-orange-2"
      />
    </div>
  );
}
