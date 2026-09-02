import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/constants/statuses";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  linkHref: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link_href: string | null;
  read_at: string | null;
  created_at: string;
}

function toItem(r: NotificationRow): NotificationItem {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    linkHref: r.link_href,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

/**
 * `notifications_select` RLS (0002_rls.sql) already scopes every read
 * to `recipient_profile_id = auth.uid()` — no extra profileId filter
 * needed here, only passed for the query's own use (none, currently).
 */
export async function getNotificationsForUser(limit = 50): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link_href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<NotificationRow[]>();
  return (data ?? []).map(toItem);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}
