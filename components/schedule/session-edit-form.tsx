"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SESSION_STATUSES, SESSION_STATUS_LABELS, type SessionStatus } from "@/lib/constants/statuses";
import {
  updateSessionMeta,
  updateSessionBlockMaterials,
  addSessionBlock,
  deleteSessionBlock,
  assignTrainers,
  deleteSession,
} from "@/lib/actions/schedule";

interface BlockInput {
  id: string;
  title: string;
  materials_url: string | null;
}

export function SessionEditForm({
  sessionId,
  programId,
  isOwnerOrCo,
  status,
  sessionDate,
  location,
  surveyUrl,
  internalNotes,
  postSessionReflection,
  blocks,
  allTrainers,
  assignedTrainerIds,
}: {
  sessionId: string;
  programId: string;
  isOwnerOrCo: boolean;
  status: SessionStatus;
  sessionDate: string;
  location: string | null;
  surveyUrl: string | null;
  internalNotes: string | null;
  postSessionReflection: string | null;
  blocks: BlockInput[];
  allTrainers: { id: string; display_name: string }[];
  assignedTrainerIds: string[];
}) {
  const [metaPending, setMetaPending] = React.useState(false);
  const [metaError, setMetaError] = React.useState<string | null>(null);
  const [metaSaved, setMetaSaved] = React.useState(false);

  async function handleMetaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMetaPending(true);
    setMetaError(null);
    setMetaSaved(false);
    const formData = new FormData(e.currentTarget);
    const result = await updateSessionMeta(sessionId, formData);
    setMetaPending(false);
    if (result.error) setMetaError(result.error);
    else setMetaSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chỉnh sửa buổi học</CardTitle>
        <CardDescription>
          {isOwnerOrCo
            ? "Owner/Co-owner chỉnh sửa toàn bộ thông tin buổi học."
            : "Trainer chỉ chỉnh được thông tin giảng dạy của buổi học mình phụ trách (ghi chú, tài liệu)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleMetaSubmit} className="space-y-3">
          {isOwnerOrCo && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="sessionDate" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                  Ngày học
                </label>
                <input
                  id="sessionDate"
                  name="sessionDate"
                  type="date"
                  defaultValue={sessionDate}
                  required
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
                />
              </div>
              <div>
                <label htmlFor="status" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                  Trạng thái
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={status}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
                >
                  {SESSION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SESSION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="location" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                  Địa điểm
                </label>
                <input
                  id="location"
                  name="location"
                  defaultValue={location ?? ""}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="surveyUrl" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                  Link khảo sát (Google Form)
                </label>
                <input
                  id="surveyUrl"
                  name="surveyUrl"
                  type="url"
                  defaultValue={surveyUrl ?? ""}
                  placeholder="https://forms.gle/…"
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="internalNotes" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Ghi chú nội bộ
            </label>
            <textarea
              id="internalNotes"
              name="internalNotes"
              defaultValue={internalNotes ?? ""}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
            />
          </div>
          <div>
            <label
              htmlFor="postSessionReflection"
              className="mb-1.5 block text-[13px] font-semibold text-text-primary"
            >
              Đúc kết sau buổi học
            </label>
            <textarea
              id="postSessionReflection"
              name="postSessionReflection"
              defaultValue={postSessionReflection ?? ""}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
            />
          </div>

          {metaError && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {metaError}
            </p>
          )}
          {metaSaved && !metaPending && (
            <p role="status" className="text-[12px] font-medium text-success">
              Đã lưu.
            </p>
          )}

          <Button type="submit" size="sm" disabled={metaPending}>
            {metaPending ? "Đang lưu…" : "Lưu thông tin buổi học"}
          </Button>
        </form>

        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-[13px] font-bold text-text-primary">Learning blocks</h3>
          <div className="space-y-2">
            {blocks.map((block) => (
              <BlockMaterialsField
                key={block.id}
                sessionId={sessionId}
                block={block}
                isOwnerOrCo={isOwnerOrCo}
                canDelete={isOwnerOrCo && blocks.length > 1}
              />
            ))}
          </div>
          {isOwnerOrCo && <AddBlockField sessionId={sessionId} />}
        </div>

        {isOwnerOrCo && (
          <div className="border-t border-border pt-4">
            <TrainerAssignment
              sessionId={sessionId}
              allTrainers={allTrainers}
              assignedTrainerIds={assignedTrainerIds}
            />
          </div>
        )}

        {isOwnerOrCo && (
          <div className="border-t border-border pt-4">
            <DeleteSessionSection sessionId={sessionId} programId={programId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlockMaterialsField({
  sessionId,
  block,
  isOwnerOrCo,
  canDelete,
}: {
  sessionId: string;
  block: BlockInput;
  isOwnerOrCo: boolean;
  canDelete: boolean;
}) {
  const [value, setValue] = React.useState(block.materials_url ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateSessionBlockMaterials(sessionId, block.id, value);
    setPending(false);
    if (result.error) setError(result.error);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeletePending(true);
    setError(null);
    const result = await deleteSessionBlock(sessionId, block.id);
    setDeletePending(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{block.title}</span>
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…"
          className="h-9 w-56 rounded-lg border border-border bg-background px-2.5 text-[12px] text-text-primary outline-none focus:border-brand-orange-2"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "…" : "Lưu"}
        </Button>
      </form>
      {isOwnerOrCo && canDelete && (
        <button
          type="button"
          disabled={deletePending}
          onClick={handleDelete}
          className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-risk hover:bg-risk/10 disabled:opacity-50"
        >
          {deletePending ? "…" : confirmDelete ? "Xác nhận xoá?" : "Xoá block"}
        </button>
      )}
      {error && <span className="text-[11px] font-medium text-risk">{error}</span>}
    </div>
  );
}

function AddBlockField({ sessionId }: { sessionId: string }) {
  const [title, setTitle] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await addSessionBlock(sessionId, title);
    setPending(false);
    if (result.error) setError(result.error);
    else setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tên learning block mới"
        className="h-9 w-64 rounded-lg border border-border bg-background px-2.5 text-[12px] text-text-primary outline-none focus:border-brand-orange-2"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending || !title.trim()}>
        {pending ? "…" : "+ Thêm block"}
      </Button>
      {error && <span className="text-[11px] font-medium text-risk">{error}</span>}
    </form>
  );
}

function TrainerAssignment({
  sessionId,
  allTrainers,
  assignedTrainerIds,
}: {
  sessionId: string;
  allTrainers: { id: string; display_name: string }[];
  assignedTrainerIds: string[];
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(assignedTrainerIds));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await assignTrainers(sessionId, Array.from(selected));
    setPending(false);
    if (result.error) setError(result.error);
  }

  return (
    <div>
      <h3 className="mb-2 text-[13px] font-bold text-text-primary">Gán Trainer phụ trách</h3>
      {allTrainers.length === 0 ? (
        <p className="text-[13px] text-text-secondary">Chưa có tài khoản Trainer active nào trong chương trình.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allTrainers.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-primary"
            >
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
              {t.display_name}
            </label>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={handleSave} disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu Trainer"}
        </Button>
        {error && <span className="text-[11px] font-medium text-risk">{error}</span>}
      </div>
    </div>
  );
}

function DeleteSessionSection({ sessionId, programId }: { sessionId: string; programId: string }) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setPending(true);
    setError(null);
    const result = await deleteSession(sessionId, programId);
    // deleteSession redirect()s to /app/schedule on success — this only
    // returns here when there was an error.
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div>
      <h3 className="mb-1 text-[13px] font-bold text-text-primary">Xoá buổi học</h3>
      <p className="mb-2 text-[12px] text-text-secondary">
        Xoá toàn bộ learning block và attendance sheet gắn với buổi này. Không thể hoàn tác.
      </p>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={handleDelete}
      >
        {pending ? "Đang xoá…" : confirmDelete ? "Xác nhận xoá buổi học?" : "Xoá buổi học"}
      </Button>
      {error && <p className="mt-1.5 text-[11px] font-medium text-risk">{error}</p>}
    </div>
  );
}
