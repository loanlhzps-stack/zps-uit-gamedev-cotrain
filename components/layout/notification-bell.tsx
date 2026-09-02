"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/constants/statuses";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import type { NotificationItem } from "@/lib/notifications/queries";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return `${days} ngày trước`;
}

/**
 * Main Bar "Notification center" (section 7.1). Server-rendered
 * initial data (from app/app/layout.tsx) is threaded down through
 * AppShell/MainBar — same router.refresh()-after-action pattern as
 * every other list in this app, no client-side polling/websocket.
 */
export function NotificationBell({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: NotificationItem[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [markAllPending, setMarkAllPending] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  async function handleItemClick(item: NotificationItem) {
    setOpen(false);
    if (!item.readAt) {
      await markNotificationRead(item.id);
      router.refresh();
    }
  }

  async function handleMarkAllRead() {
    setMarkAllPending(true);
    await markAllNotificationsRead();
    setMarkAllPending(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={initialUnreadCount > 0 ? `Thông báo (${initialUnreadCount} chưa đọc)` : "Thông báo"}
        className="relative flex size-10 items-center justify-center rounded-lg text-text-secondary hover:bg-background"
      >
        <Bell className="size-5" />
        {initialUnreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-risk text-[9px] font-bold text-white">
            {initialUnreadCount > 9 ? "9+" : initialUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <p className="text-[13px] font-bold text-text-primary">Thông báo</p>
            {initialUnreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markAllPending}
                className="text-[11.5px] font-semibold text-brand-orange-3 hover:underline disabled:opacity-50"
              >
                {markAllPending ? "Đang xử lý…" : "Đánh dấu tất cả đã đọc"}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {initialItems.length === 0 ? (
              <p className="px-3.5 py-4 text-[12.5px] text-text-secondary">Chưa có thông báo nào.</p>
            ) : (
              <ul>
                {initialItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={(item.linkHref ?? "/app/notifications") as never}
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "block border-b border-border px-3.5 py-2.5 last:border-0 hover:bg-background",
                        !item.readAt && "bg-brand-orange-2/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-semibold text-text-primary">{item.title}</p>
                        {!item.readAt && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-orange-2" aria-hidden="true" />}
                      </div>
                      {item.body && <p className="mt-0.5 truncate text-[11.5px] text-text-secondary">{item.body}</p>}
                      <p className="mt-1 text-[10.5px] text-text-secondary">
                        {NOTIFICATION_TYPE_LABELS[item.type]} · {relativeTime(item.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3.5 py-2.5 text-center text-[12.5px] font-semibold text-brand-orange-3 hover:bg-background"
          >
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  );
}
