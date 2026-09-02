"use client";

import * as React from "react";
import type { AppUser } from "@/lib/auth/current-user";

interface CurrentUserContextValue {
  user: AppUser;
}

const CurrentUserContext = React.createContext<CurrentUserContextValue | null>(null);

/**
 * Provides the real, session-derived identity (resolved server-side in
 * app/app/layout.tsx via lib/auth/get-current-user.ts) to the client
 * components that make up the shell (Sidebar, MainBar, ProfileMenu) and
 * the role-aware pages under /app. There is no client-side role
 * switching anymore — Phase 1+2's dev-only mock is gone; to see the app
 * as a different role, sign in as a different sample account (see
 * README, "Tài khoản mẫu sau khi seed").
 */
export function CurrentUserProvider({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ user }), [user]);
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const ctx = React.useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used within CurrentUserProvider");
  return ctx;
}
