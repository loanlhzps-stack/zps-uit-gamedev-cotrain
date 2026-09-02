"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/constants/statuses";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import type { NotificationItem } from "@/lib/notifications/queries";

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const unreadCount = items.filter((i) => !i.readAt).length;
  const [markAllPending, setMarkAllPending] = React.useState(false);

  async function handleClick(item: NotificationItem) {
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

  if (items.length === 0) {
    return <p className="text-[13px] text-text-secondary">Chưa có thông báo nào.</p>;
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="secondary" onClick={handleMarkAllRead} disabled={markAllPending}>
            {markAllPending ? "Đang xử lý…" : `Đánh dấu tất cả đã đọc (${unreadCount})`}
          </Button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((item) => {
          const content = (
            <div
              className={`rounded-lg border border-border p-3 transition-colors hover:border-brand-orange-2/60 ${
                !item.readAt ? "bg-brand-orange-2/5" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-text-primary">{item.title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={item.readAt ? "neutral" : "brand"}>{NOTIFICATION_TYPE_LABELS[item.type]}</Badge>
                  {!item.readAt && <span className="size-2 rounded-full bg-brand-orange-2" aria-hidden="true" />}
                </div>
              </div>
              {item.body && <p className="mt-1 text-[12.5px] text-text-secondary">{item.body}</p>}
              <p className="mt-1.5 text-[11px] text-text-secondary">{new Date(item.createdAt).toLocaleString("vi-VN")}</p>
            </div>
          );

          return (
            <li key={item.id}>
              {item.linkHref ? (
                <Link href={item.linkHref as never} onClick={() => handleClick(item)}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={() => handleClick(item)} className="block w-full text-left">
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
