import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { NoAccessScreen } from "@/components/auth/no-access-screen";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { getNotificationsForUser, getUnreadNotificationCount } from "@/lib/notifications/queries";

// Real session/membership gate (section 19.2). proxy.ts already keeps a
// signed-out browser out of /app/* — this is the second check, and the
// one that also enforces onboarding completion and membership status
// (RLS in supabase/migrations/0002_rls.sql is the real, unbypassable
// gate underneath both).
export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentAppUser();

  switch (result.status) {
    case "unauthenticated":
      redirect("/login");
    case "onboarding_incomplete":
      redirect("/onboarding/profile");
    case "no_membership":
    case "suspended":
    case "archived":
      return <NoAccessScreen reason={result.status} />;
    case "ok": {
      const [notifications, unreadCount] = await Promise.all([
        getNotificationsForUser(8),
        getUnreadNotificationCount(),
      ]);
      return (
        <AppShell user={result.user} notifications={notifications} unreadCount={unreadCount}>
          {children}
        </AppShell>
      );
    }
  }
}
