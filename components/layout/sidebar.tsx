"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { LogoFull, LogoMark } from "@/components/brand/logo";
import { navForRole } from "@/lib/nav";
import { useCurrentUser } from "@/lib/auth/user-context";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const items = navForRole(user.role);

  const content = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 items-center border-b border-border px-4",
          collapsed ? "justify-center px-2" : "justify-between"
        )}
      >
        <Link href="/app" className="flex items-center gap-2 overflow-hidden" onClick={onCloseMobile}>
          {collapsed ? <LogoMark height={28} /> : <LogoFull height={52} />}
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          className="text-text-secondary md:hidden"
          aria-label="Đóng menu"
        >
          <X className="size-5" />
        </button>
      </div>

      {!collapsed && (
        <div className="mx-3 mt-3 rounded-xl border border-border bg-background px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            Môn học
          </p>
          <p className="mt-0.5 truncate text-[13px] font-bold text-text-primary">
            Phát triển Kỹ năng Lập trình Game
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Điều hướng chính">
        {items.map((item, index) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const isHome = index === 0;
          const link = (
            <Link
              href={item.href as never}
              onClick={onCloseMobile}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition-colors duration-150",
                collapsed ? "justify-center px-0" : isHome && "min-w-0 flex-1",
                active
                  ? "bg-brand-gradient text-white shadow-sm"
                  : "text-text-secondary hover:bg-background hover:text-text-primary"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (!isHome) {
            return <div key={item.href}>{link}</div>;
          }

          // Collapse/expand toggle lives right at the end of the Home row —
          // the most-visible spot at the top of the nav — instead of buried
          // at the bottom of the sidebar.
          return (
            <div key={item.href} className={cn("flex items-center gap-1", collapsed && "flex-col gap-0.5")}>
              {link}
              <button
                type="button"
                onClick={onToggleCollapsed}
                title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
                className={cn(
                  "hidden md:flex shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-background hover:text-text-primary",
                  collapsed ? "h-8 w-full" : "size-9"
                )}
              >
                {collapsed ? <PanelLeftOpen className="size-[16px]" /> : <PanelLeftClose className="size-[16px]" />}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <Link
          href="/app/profile"
          onClick={onCloseMobile}
          className={cn(
            "mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-background",
            collapsed && "justify-center px-0"
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
            {user.displayName.slice(0, 1).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-text-primary">
                {user.displayName}
              </span>
              <span className="block truncate text-[11px] text-text-secondary">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          )}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-surface transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-[260px]"
        )}
      >
        {content}
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={onCloseMobile}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-[280px] bg-surface shadow-xl transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {content}
        </aside>
      </div>
    </>
  );
}
