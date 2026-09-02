"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createProjectBuild, updateProjectBuild, deleteProjectBuild } from "@/lib/actions/groups";

export interface ProjectBuildRow {
  id: string;
  versionName: string;
  platform: string | null;
  buildUrl: string | null;
  repositoryUrl: string | null;
  installInstructions: string | null;
  knownIssues: string | null;
  releaseNotes: string | null;
  gddUrl: string | null;
  gameplayDemoUrl: string | null;
  screenshotUrls: string[];
  uploadedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * "Build và tài liệu" subtab (theo yêu cầu của bạn) — mỗi build là 1
 * phiên bản riêng (project_builds), không ghi đè lên nhau như 3 ô
 * Repository/Build/Video đơn trước đây. "+ Thêm phiên bản mới" thay
 * vì chỉ có 1 ô Build.
 */
export function ProjectBuildsManager({
  groupId,
  builds,
  canEdit,
}: {
  groupId: string;
  builds: ProjectBuildRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Build và tài liệu</CardTitle>
        <CardDescription>Mỗi lần thêm là một phiên bản mới — lịch sử build không bị ghi đè.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {builds.length === 0 && !creating && (
          <p className="text-[13px] text-text-secondary">Chưa có phiên bản build nào.</p>
        )}
        <ul className="space-y-3">
          {builds.map((b) => (
            <BuildItem key={b.id} groupId={groupId} build={b} canEdit={canEdit} onChanged={() => router.refresh()} />
          ))}
        </ul>

        {canEdit &&
          (creating ? (
            <BuildForm
              groupId={groupId}
              buildId={null}
              onDone={() => {
                setCreating(false);
                router.refresh();
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(true)}>
              + Thêm phiên bản mới
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}

const LINK_FIELDS: { key: keyof ProjectBuildRow; label: string }[] = [
  { key: "buildUrl", label: "Link/file build" },
  { key: "repositoryUrl", label: "Repository" },
  { key: "gddUrl", label: "GDD / Pitch Deck" },
  { key: "gameplayDemoUrl", label: "Gameplay demo/trailer" },
];

function BuildItem({
  groupId,
  build,
  canEdit,
  onChanged,
}: {
  groupId: string;
  build: ProjectBuildRow;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Xoá phiên bản "${build.versionName}"? Không thể hoàn tác.`)) return;
    setPending(true);
    setError(null);
    const result = await deleteProjectBuild(groupId, build.id);
    setPending(false);
    if (result.error) setError(result.error);
    else onChanged();
  }

  if (editing) {
    return (
      <li>
        <BuildForm
          groupId={groupId}
          buildId={build.id}
          initial={build}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const links = LINK_FIELDS.filter((f) => build[f.key]);

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-bold text-text-primary">{build.versionName}</p>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            {build.platform && <>{build.platform} · </>}
            {build.uploadedByName ? `Upload bởi ${build.uploadedByName}` : "Chưa rõ người upload"} ·{" "}
            {new Date(build.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Sửa
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleDelete} disabled={pending} className="text-risk">
              Xoá
            </Button>
          </div>
        )}
      </div>

      {links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {links.map((f) => (
            <a
              key={f.key}
              href={build[f.key] as string}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-orange-3 hover:underline"
            >
              {f.label}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}

      {build.screenshotUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {build.screenshotUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- external screenshot links, not a local/optimized asset */}
              <img src={url} alt={`Screenshot ${i + 1} của ${build.versionName}`} className="h-16 w-24 rounded-md border border-border object-cover" />
            </a>
          ))}
        </div>
      )}

      {build.releaseNotes && (
        <p className="mt-2 text-[12px] text-text-primary">
          <span className="font-semibold">Release note: </span>
          {build.releaseNotes}
        </p>
      )}
      {build.installInstructions && (
        <p className="mt-1 text-[12px] text-text-secondary">
          <span className="font-semibold text-text-primary">Cài đặt/chạy: </span>
          {build.installInstructions}
        </p>
      )}
      {build.knownIssues && (
        <p className="mt-1 text-[12px] text-text-secondary">
          <span className="font-semibold text-text-primary">Known issues: </span>
          {build.knownIssues}
        </p>
      )}

      {error && <p className="mt-1.5 text-[11px] font-medium text-risk">{error}</p>}
    </li>
  );
}

function BuildForm({
  groupId,
  buildId,
  initial,
  onDone,
  onCancel,
}: {
  groupId: string;
  buildId: string | null;
  initial?: ProjectBuildRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = buildId
      ? await updateProjectBuild(groupId, buildId, formData)
      : await createProjectBuild(groupId, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 rounded-lg border border-border p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextField id="versionName" label="Tên phiên bản" required placeholder="Prototype v1, Alpha v0.5…" defaultValue={initial?.versionName} />
        <TextField id="platform" label="Platform" placeholder="Android APK, WebGL, Windows…" defaultValue={initial?.platform ?? undefined} />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextField id="buildUrl" label="Link/file build" type="url" defaultValue={initial?.buildUrl ?? undefined} />
        <TextField id="repositoryUrl" label="Repository" type="url" defaultValue={initial?.repositoryUrl ?? undefined} />
        <TextField id="gddUrl" label="GDD / Pitch Deck" type="url" defaultValue={initial?.gddUrl ?? undefined} />
        <TextField id="gameplayDemoUrl" label="Gameplay demo/trailer" type="url" defaultValue={initial?.gameplayDemoUrl ?? undefined} />
      </div>
      <TextAreaField
        id="screenshotUrls"
        label="Screenshot gallery (mỗi link 1 dòng)"
        rows={2}
        defaultValue={(initial?.screenshotUrls ?? []).join("\n")}
      />
      <TextAreaField id="installInstructions" label="Hướng dẫn cài đặt/chạy game" rows={2} defaultValue={initial?.installInstructions ?? ""} />
      <TextAreaField id="knownIssues" label="Known issues" rows={2} defaultValue={initial?.knownIssues ?? ""} />
      <TextAreaField id="releaseNotes" label="Release note — phiên bản này đã thay đổi gì" rows={2} defaultValue={initial?.releaseNotes ?? ""} />

      {initial && <input type="hidden" name="updatedAt" value={initial.updatedAt} />}
      {error && <p className="text-[11px] font-medium text-risk">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  defaultValue,
  type = "text",
  required = false,
  placeholder,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-semibold text-text-primary">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  defaultValue,
  rows = 2,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-semibold text-text-primary">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
      />
    </div>
  );
}
