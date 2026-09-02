"use client";

import { useActionState } from "react";
import { LogoFull } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { completeOnboarding, type OnboardingFormState } from "@/lib/actions/profile";

const initialState: OnboardingFormState = {};

export function OnboardingForm({
  defaultFullName,
  defaultEmail,
  roleLabel,
}: {
  defaultFullName: string;
  defaultEmail: string;
  roleLabel: string;
}) {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <div className="mb-6 flex justify-center">
          <LogoFull height={40} />
        </div>
        <h1 className="text-center text-lg font-extrabold text-text-primary">Hoàn tất hồ sơ</h1>
        <p className="mt-1 text-center text-[13px] text-text-secondary">
          Bước cuối trước khi vào VNG-ZPSxUIT-GameDev CoTrain — {defaultEmail}
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Họ tên" name="fullName" defaultValue={defaultFullName} required />
            <ReadOnlyField label="Vai trò" value={roleLabel} />
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-text-primary">Thông báo</span>
            <div className="flex flex-col gap-1.5 text-[13px] text-text-primary">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="notifyInApp" defaultChecked />
                Thông báo trong ứng dụng
              </label>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <Field
              label="Mật khẩu mới"
              name="password"
              type="password"
              placeholder="Bắt buộc nếu đây là lần đầu kích hoạt tài khoản"
            />
          </div>

          {state.error && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Đang lưu…" : "Tiếp tục"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-[13px] font-semibold text-text-primary">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
      />
    </div>
  );
}

// Vai trò do Owner gán lúc mời (mục 5), hệ thống tự link qua
// program_memberships.role — hiển thị read-only, không phải trường tự
// nhập (theo yêu cầu của bạn, áp dụng đồng bộ với Chỉnh sửa hồ sơ).
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-text-primary">{label}</span>
      <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background px-3 text-[13px] text-text-secondary">
        {value}
      </div>
    </div>
  );
}
