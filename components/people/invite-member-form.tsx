"use client";

import * as React from "react";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLES, ROLE_LABELS, GROUP_ASSIGNABLE_ROLES } from "@/lib/constants/roles";
import { inviteMember, type InviteFormState } from "@/lib/actions/invitations";
import { generateRandomPassword } from "@/lib/utils/password";

const initialState: InviteFormState = {};

const GROUP_ROLES = new Set<string>(GROUP_ASSIGNABLE_ROLES);

export function InviteMemberForm({
  programId,
  groups,
  sessions,
}: {
  programId: string;
  groups: { id: string; name: string }[];
  sessions: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(inviteMember, initialState);
  const [role, setRole] = React.useState<string>("student");
  const [password, setPassword] = React.useState("");
  const showSingleGroup = GROUP_ROLES.has(role);
  const isTrainer = role === "trainer";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4 text-brand-orange-3" aria-hidden="true" />
          Tạo tài khoản thành viên
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />

          <div className="grid gap-3 sm:grid-cols-[1.4fr_1.6fr_1.1fr]">
            <div>
              <label htmlFor="invite-fullname" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Họ tên
              </label>
              <input
                id="invite-fullname"
                name="fullName"
                type="text"
                required
                placeholder="Nguyễn Văn A"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
              />
            </div>

            <div>
              <label htmlFor="invite-email" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Email
              </label>
              <input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="ten@vidu.com"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
              />
            </div>

            <div>
              <label htmlFor="invite-role" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Vai trò
              </label>
              <select
                id="invite-role"
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-w-xs">
            <label htmlFor="invite-password" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Mật khẩu
            </label>
            <div className="flex gap-2">
              <input
                id="invite-password"
                name="password"
                type="text"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => setPassword(generateRandomPassword())}>
                Tạo ngẫu nhiên
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-text-secondary">
              Bạn tự gửi email + mật khẩu này cho thành viên (Zalo/tin nhắn...) — hệ thống không gửi mail mời.
            </p>
          </div>

          {showSingleGroup && (
            <div className="max-w-xs">
              <label htmlFor="invite-group" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Nhóm (tuỳ chọn)
              </label>
              <select
                id="invite-group"
                name="groupId"
                defaultValue=""
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
              >
                <option value="">— Chưa gán —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isTrainer && (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-text-primary">Nhóm phụ trách (tuỳ chọn)</p>
              <p className="mb-1.5 text-[11.5px] text-text-secondary">
                Chỉ để hiển thị ở Quản lý thành viên — không giới hạn, Trainer vẫn gán bài tập được cho bất kỳ nhóm nào.
              </p>
              {groups.length === 0 ? (
                <p className="text-[12px] text-text-secondary">Chương trình chưa có nhóm nào.</p>
              ) : (
                <div className="grid max-h-40 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-4">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-1.5 text-[12.5px] text-text-primary">
                      <input type="checkbox" name="groupIds" value={g.id} className="size-3.5 accent-brand-orange-3" />
                      {g.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {isTrainer && (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-text-primary">Nội dung học / Buổi phụ trách (tuỳ chọn)</p>
              <p className="mb-1.5 text-[11.5px] text-text-secondary">
                Gán sẵn buổi học cho Trainer này — sau này Trainer chỉ chọn được buổi gắn kèm bài tập trong số buổi đã gán ở đây (gán/sửa thêm được sau ở Thời khóa biểu).
              </p>
              {sessions.length === 0 ? (
                <p className="text-[12px] text-text-secondary">Chương trình chưa có buổi học nào.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-3">
                  {sessions.map((s) => (
                    <label key={s.id} className="flex items-start gap-1.5 text-[12.5px] text-text-primary">
                      <input
                        type="checkbox"
                        name="sessionIds"
                        value={s.id}
                        className="mt-0.5 size-3.5 accent-brand-orange-3"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Đang tạo…" : "Tạo tài khoản"}
            </Button>
          </div>
        </form>

        {state.error && (
          <p role="alert" className="mt-3 rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
            {state.error}
          </p>
        )}
        {state.success && (
          <div role="status" className="mt-3 rounded-lg bg-success/10 px-3 py-2.5">
            <p className="text-[12px] font-medium text-success">{state.success}</p>
            {state.createdPassword && (
              <div className="mt-2 rounded-md border border-success/30 bg-background px-3 py-2 font-mono text-[12.5px] text-text-primary">
                <p>Email: {state.createdEmail}</p>
                <p>Mật khẩu: {state.createdPassword}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
