"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ROLES, ROLE_LABELS, GROUP_ASSIGNABLE_ROLES, type Role } from "@/lib/constants/roles";
import {
  changeMemberRole,
  changeMemberStatus,
  changeMemberGroup,
  updateTrainerGroups,
  updateMemberSessions,
  resetMemberPassword,
} from "@/lib/actions/invitations";

const GROUP_ROLES = new Set<string>(GROUP_ASSIGNABLE_ROLES);

export interface MemberRowData {
  id: string;
  role: Role;
  status: "invited" | "active" | "suspended" | "archived";
  invited_email: string | null;
  profiles: { id: string; full_name: string; display_name: string; email: string | null } | null;
  groupId?: string | null;
  groupName?: string | null;
  // Trainer only — "Nhóm phụ trách" (0018_trainer_group_assignments.sql),
  // ĐỘC LẬP với buổi học (gán qua Thời khóa biểu) và với "Nhóm" của
  // student/mentor ở trên (groupId/groupName, 1 nhóm/người) — 1 Trainer
  // có thể phụ trách nhiều nhóm nên là mảng. Sửa được ngay tại dòng này,
  // xem updateTrainerGroups.
  trainerGroupNames?: string[] | null;
  trainerGroupIds?: string[] | null;
  // Trainer + Mentor ZPS/Sinh viên — "Nội dung học" (buổi phụ trách),
  // cùng dữ liệu thật với Thời khóa biểu (sessions.trainer_profile_ids /
  // sessions.mentor_profile_ids). Xem SessionsCell + updateMemberSessions.
  sessionIds?: string[] | null;
}

const STATUS_LABEL: Record<MemberRowData["status"], string> = {
  invited: "Đã mời",
  active: "Đang hoạt động",
  suspended: "Tạm ngưng",
  archived: "Lưu trữ",
};

const STATUS_VARIANT: Record<MemberRowData["status"], "neutral" | "success" | "warning" | "risk"> = {
  invited: "warning",
  active: "success",
  suspended: "warning",
  archived: "neutral",
};

const SESSION_ROLES = new Set<string>(["trainer", "mentor_zps", "mentor_student", "owner", "co_owner"]);

export function MemberRow({
  member,
  programId,
  editable,
  currentUserId,
  groups,
  sessionOptions,
}: {
  member: MemberRowData;
  programId: string;
  editable: boolean;
  currentUserId: string;
  groups: { id: string; name: string }[];
  sessionOptions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newPassword, setNewPassword] = React.useState<string | null>(null);
  const isSelf = member.profiles?.id === currentUserId;
  const name = member.profiles?.full_name ?? member.invited_email ?? "—";
  const email = member.profiles?.email ?? member.invited_email ?? "—";

  async function handleRoleChange(next: Role) {
    setPending(true);
    setError(null);
    const result = await changeMemberRole(member.id, programId, next);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleStatusChange(next: "active" | "suspended" | "archived") {
    setPending(true);
    setError(null);
    const result = await changeMemberStatus(member.id, programId, next);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleGroupChange(nextGroupId: string) {
    if (!member.profiles?.id) return;
    setPending(true);
    setError(null);
    const result = await changeMemberGroup(member.id, programId, member.profiles.id, member.role, nextGroupId);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  // "Đặt lại mật khẩu" (theo yêu cầu của bạn — thay cho re-invite khi
  // quên mật khẩu, xem doc-comment resetMemberPassword). Hiện mật khẩu
  // mới ngay tại dòng này đúng 1 lần để Owner copy gửi thủ công.
  async function handleResetPassword() {
    if (!member.profiles?.id) return;
    if (!window.confirm(`Đặt lại mật khẩu cho ${email}? Mật khẩu cũ sẽ không dùng được nữa.`)) return;
    setPending(true);
    setError(null);
    setNewPassword(null);
    const result = await resetMemberPassword(member.profiles.id, programId);
    setPending(false);
    if (result.error) setError(result.error);
    else if (result.password) {
      setNewPassword(result.password);
      router.refresh();
    }
  }

  const canModerate = editable && !isSelf;
  const isGroupRole = GROUP_ROLES.has(member.role);

  return (
    <tr id={member.profiles?.id ? `member-${member.profiles.id}` : undefined} className="scroll-mt-20 border-b border-border last:border-0">
      <td className="px-5 py-3">
        <div className="flex max-w-[190px] items-center gap-2.5">
          <Avatar name={name} size={28} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-text-primary">
              {name} {isSelf && <span className="font-medium text-text-secondary">(bạn)</span>}
            </p>
            <p className="truncate text-[12px] text-text-secondary">{email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        {canModerate ? (
          <select
            value={member.role}
            disabled={pending}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-[12px] text-text-primary outline-none focus:border-brand-orange-2 disabled:opacity-50"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[13px] text-text-primary">{ROLE_LABELS[member.role]}</span>
        )}
      </td>
      <td className="px-5 py-3">
        {SESSION_ROLES.has(member.role) ? (
          canModerate ? (
            <SessionsCell
              programId={programId}
              profileId={member.profiles?.id ?? null}
              role={member.role}
              sessionOptions={sessionOptions}
              initialSessionIds={member.sessionIds ?? []}
            />
          ) : (
            <SessionsSummary sessionOptions={sessionOptions} sessionIds={member.sessionIds ?? []} />
          )
        ) : (
          <span className="text-[12px] text-text-secondary">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        {isGroupRole ? (
          canModerate ? (
            <select
              value={member.groupId ?? ""}
              disabled={pending}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-[12px] text-text-primary outline-none focus:border-brand-orange-2 disabled:opacity-50"
            >
              <option value="">— Chưa gán —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[13px] text-text-primary">{member.groupName ?? "— Chưa gán —"}</span>
          )
        ) : member.role === "trainer" ? (
          canModerate ? (
            <TrainerGroupsCell
              programId={programId}
              profileId={member.profiles?.id ?? null}
              groups={groups}
              initialGroupIds={member.trainerGroupIds ?? []}
            />
          ) : (
            <span className="text-[13px] text-text-primary">
              {member.trainerGroupNames && member.trainerGroupNames.length > 0
                ? member.trainerGroupNames.join(", ")
                : "— Chưa gán —"}
            </span>
          )
        ) : (
          <span className="text-[12px] text-text-secondary">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        <Badge variant={STATUS_VARIANT[member.status]}>{STATUS_LABEL[member.status]}</Badge>
      </td>
      <td className="px-5 py-3">
        {canModerate ? (
          <div className="flex flex-wrap gap-1.5">
            {member.status !== "invited" && member.status !== "active" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleStatusChange("active")}
                className="rounded-md px-2 py-1 text-[12px] font-semibold text-success hover:bg-success/10 disabled:opacity-50"
              >
                Kích hoạt lại
              </button>
            )}
            {member.status !== "invited" && member.status !== "suspended" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleStatusChange("suspended")}
                className="rounded-md px-2 py-1 text-[12px] font-semibold text-warning hover:bg-warning/10 disabled:opacity-50"
              >
                Tạm ngưng
              </button>
            )}
            {member.status !== "invited" && member.status !== "archived" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleStatusChange("archived")}
                className="rounded-md px-2 py-1 text-[12px] font-semibold text-risk hover:bg-risk/10 disabled:opacity-50"
              >
                Lưu trữ
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={handleResetPassword}
              className="rounded-md px-2 py-1 text-[12px] font-semibold text-text-primary hover:bg-border/60 disabled:opacity-50"
            >
              Đặt lại mật khẩu
            </button>
          </div>
        ) : (
          <span className="text-[12px] text-text-secondary">
            {isSelf ? "—" : member.status === "invited" ? "Đang chờ kích hoạt" : "—"}
          </span>
        )}
        {error && <p className="mt-1 text-[11px] font-medium text-risk">{error}</p>}
        {newPassword && (
          <div className="mt-1.5 rounded-md border border-success/30 bg-success/5 px-2 py-1.5 font-mono text-[11.5px] text-text-primary">
            Mật khẩu mới: {newPassword}
          </div>
        )}
      </td>
    </tr>
  );
}

function TrainerGroupsCell({
  programId,
  profileId,
  groups,
  initialGroupIds,
}: {
  programId: string;
  profileId: string | null;
  groups: { id: string; name: string }[];
  initialGroupIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set(initialGroupIds));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!profileId) return;
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await updateTrainerGroups(profileId, programId, Array.from(selected));
    setPending(false);
    if (result.error) setError(result.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="w-[160px]">
      <div className="flex flex-wrap gap-1">
        {groups.map((g) => (
          <label
            key={g.id}
            className="flex items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[11px] font-medium text-text-primary"
          >
            <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} />
            {g.name}
          </label>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-text-primary hover:bg-border/60 disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
        {saved && !pending && <span className="text-[11px] font-medium text-success">Đã lưu.</span>}
        {error && <span className="text-[11px] font-medium text-risk">{error}</span>}
      </div>
    </div>
  );
}

function SessionsSummary({
  sessionOptions,
  sessionIds,
}: {
  sessionOptions: { id: string; label: string }[];
  sessionIds: string[];
}) {
  const assigned = sessionOptions.filter((s) => sessionIds.includes(s.id));
  if (assigned.length === 0) {
    return <span className="text-[13px] text-text-primary">— Chưa gán —</span>;
  }
  return (
    <div className="flex max-w-[200px] flex-col gap-0.5">
      {assigned.map((s) => (
        <Link
          key={s.id}
          href={`/app/schedule/${s.id}`}
          className="truncate text-[12px] font-medium text-brand-orange-3 hover:underline"
          title={s.label}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

function SessionsCell({
  programId,
  profileId,
  role,
  sessionOptions,
  initialSessionIds,
}: {
  programId: string;
  profileId: string | null;
  role: Role;
  sessionOptions: { id: string; label: string }[];
  initialSessionIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set(initialSessionIds));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!profileId) return;
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await updateMemberSessions(profileId, programId, role, Array.from(selected));
    setPending(false);
    if (result.error) setError(result.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  if (sessionOptions.length === 0) {
    return <span className="text-[12px] text-text-secondary">Chương trình chưa có buổi học nào.</span>;
  }

  return (
    <div className="w-[200px]">
      <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
        {sessionOptions.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px] text-text-primary">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="shrink-0" />
              <span className="min-w-0 truncate" title={s.label}>
                {s.label}
              </span>
            </label>
            <Link
              href={`/app/schedule/${s.id}`}
              className="shrink-0 text-[11px] text-text-secondary hover:text-brand-orange-3"
              title="Xem buổi học"
            >
              ↗
            </Link>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-text-primary hover:bg-border/60 disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
        {saved && !pending && <span className="text-[11px] font-medium text-success">Đã lưu.</span>}
        {error && <span className="text-[11px] font-medium text-risk">{error}</span>}
      </div>
    </div>
  );
}
