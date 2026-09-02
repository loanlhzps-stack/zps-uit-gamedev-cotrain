"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, User, Settings2, Bell, LogOut } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/user-context";
import { signOutAction } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function ProfileMenu() {
  const { user } = useCurrentUser();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const menuItems = [
    { href: "/app/profile", label: "Xem hồ sơ", icon: User },
    { href: "/app/profile", label: "Chỉnh sửa hồ sơ", icon: Settings2 },
    { href: "/app/notifications", label: "Cài đặt thông báo", icon: Bell },
  ];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-background"
      >
        <Avatar name={user.fullName} src={user.avatarUrl} size={32} />
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-bold leading-tight text-text-primary">
            {user.displayName}
          </span>
          <span className="block text-[11px] leading-tight text-text-secondary">
            {ROLE_LABELS[user.role]}
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-text-secondary transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg"
        >
          <div className="border-b border-border px-3.5 py-3">
            <p className="truncate text-[13px] font-bold text-text-primary">{user.fullName}</p>
            <p className="truncate text-[12px] text-text-secondary">{ROLE_LABELS[user.role]}</p>
          </div>
          <div className="p-1.5">
            {menuItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href as never}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-text-primary hover:bg-background"
              >
                <Icon className="size-4 text-text-secondary" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
          <div className="border-t border-border p-1.5">
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-risk hover:bg-risk/10"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
