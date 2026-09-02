"use client";

import { useCurrentUser } from "@/lib/auth/user-context";
import { ROLE_WELCOME_SUBTITLE } from "@/lib/constants/roles";

export function WelcomeHeaderClientPart() {
  const { user } = useCurrentUser();
  return (
    <div>
      <h2 className="text-xl font-extrabold text-text-primary md:text-2xl">
        Welcome, {user.displayName} 👋
      </h2>
      <p className="mt-1 text-sm text-text-secondary">{ROLE_WELCOME_SUBTITLE[user.role]}</p>
    </div>
  );
}
