"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { updateProfile, type UpdateProfileState } from "@/lib/actions/profile";

const initialState: UpdateProfileState = {};

export interface ProfileEditFormProps {
  fullName: string;
  avatarUrl: string | null;
  roleLabel: string;
  notifyInApp: boolean;
}

/**
 * Section 5.3 "Chỉnh sửa hồ sơ" — rút gọn còn 4 phần theo yêu cầu của
 * bạn (deviation so với danh sách "required editable" gốc của doc:
 * avatar, full name, display name, organization/unit, title, theme,
 * notification preferences):
 * - Bỏ hẳn "Tên hiển thị" — Họ tên giờ dùng làm tên hiển thị luôn
 *   (`updateProfile` tự đồng bộ `display_name = full_name`, không hỏi
 *   riêng nữa).
 * - Bỏ hẳn "Đơn vị / tổ chức".
 * - "Chức danh / thông tin sinh viên" đổi thành "Vai trò" — hiển thị
 *   READ-ONLY (role do Owner gán lúc cấp tài khoản, hệ thống tự link
 *   qua `program_memberships.role`, không phải trường tự nhập).
 * - Bỏ hẳn phần chọn Giao diện — topbar (`ThemeToggle`,
 *   `components/layout/theme-toggle.tsx`) đã có sẵn, không cần trùng
 *   ở đây nữa.
 *
 * Email/vai trò/môn học/nhóm/trạng thái vẫn render read-only ở block
 * riêng (xem app/app/profile/page.tsx) — form này chỉ còn sửa
 * avatar/họ tên/thông báo.
 */
export function ProfileEditForm(props: ProfileEditFormProps) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setRemoveAvatar(false);
    }
  }

  function handleRemoveAvatar() {
    setPreview(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const displayedAvatar = removeAvatar ? null : (preview ?? props.avatarUrl);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chỉnh sửa hồ sơ</CardTitle>
        <CardDescription>Avatar, họ tên, thông báo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={props.fullName} src={displayedAvatar} size={64} />
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Chọn ảnh…
                </Button>
                {displayedAvatar && (
                  <Button type="button" size="sm" variant="ghost" onClick={handleRemoveAvatar}>
                    Xoá ảnh
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-text-secondary">
                Không bắt buộc — có thể để trống. PNG/JPEG/WEBP/GIF, tối đa 5MB.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              name="avatarFile"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <input type="hidden" name="removeAvatar" value={removeAvatar ? "on" : ""} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Họ tên" name="fullName" defaultValue={props.fullName} required />
            <ReadOnlyField label="Vai trò" value={props.roleLabel} />
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-text-primary">Thông báo</span>
            <label className="flex items-center gap-2 text-[13px] text-text-primary">
              <input type="checkbox" name="notifyInApp" defaultChecked={props.notifyInApp} />
              Thông báo trong ứng dụng
            </label>
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
            {pending ? "Đang lưu…" : "Lưu hồ sơ"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
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
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
      />
    </div>
  );
}

// System-controlled — Owner gán vai trò lúc cấp tài khoản (mục 5),
// không cho tự sửa ở đây. Cùng ngôn ngữ trực quan "disabled input" như
// các trường system-controlled khác trong app.
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
