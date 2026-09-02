"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { CircuitPattern } from "@/components/brand/circuit-pattern";
import { MainBar } from "@/components/layout/main-bar";
import { CurrentUserProvider } from "@/lib/auth/user-context";
import type { AppUser } from "@/lib/auth/current-user";
import { NAV_ITEMS } from "@/lib/nav";
import type { NotificationItem } from "@/lib/notifications/queries";

function titleForPath(pathname: string) {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return match?.label ?? "VNG-ZPSxUIT-GameDev CoTrain";
}

function AppShellInner({
  children,
  notifications,
  unreadCount,
}: {
  children: React.ReactNode;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close the mobile drawer on route change. Adjusted during render
  // (React's documented pattern for "reset state when a prop changes")
  // instead of an effect, so no cascading setState-in-effect render.
  const [lastPathname, setLastPathname] = React.useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <CircuitPattern />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <MainBar
            title={titleForPath(pathname)}
            onOpenMobileMenu={() => setMobileOpen(true)}
            notifications={notifications}
            unreadCount={unreadCount}
          />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  notifications,
  unreadCount,
  children,
}: {
  user: AppUser;
  notifications: NotificationItem[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  return (
    <CurrentUserProvider user={user}>
      <AppShellInner notifications={notifications} unreadCount={unreadCount}>
        {children}
      </AppShellInner>
    </CurrentUserProvider>
  );
}
