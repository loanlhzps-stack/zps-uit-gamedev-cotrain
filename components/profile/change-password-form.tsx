"use client";

import { useActionState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { changePassword, type ChangePasswordState } from "@/lib/actions/profile";

const initialState: ChangePasswordState = {};

// "Đổi mật khẩu" tự phục vụ (theo yêu cầu của bạn — mục "authen") — tách
// riêng khỏi ProfileEditForm vì đây là 1 action khác (auth.updateUser),
// không đụng bảng profiles, và không cần mật khẩu cũ.
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đổi mật khẩu</CardTitle>
        <CardDescription>Không cần nhập mật khẩu hiện tại.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Mật khẩu mới
            </label>
            <input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Tối thiểu 8 ký tự"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Xác nhận mật khẩu mới
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Nhập lại mật khẩu mới"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
            />
          </div>

          {state.error && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-[12px] font-medium text-success">
              {state.success}
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Đang đổi…" : "Đổi mật khẩu"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
