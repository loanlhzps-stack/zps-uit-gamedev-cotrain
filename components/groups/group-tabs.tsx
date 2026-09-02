"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface GroupTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Section 13.2 — the 6-tab switcher. Every tab's content is rendered
 * server-side in the page (data fetching stays in Server Components)
 * and just handed to this client component as pre-built JSX so
 * switching tabs is instant and needs no client-side fetch.
 */
export function GroupWorkspaceTabs({ tabs, initialTabId }: { tabs: GroupTab[]; initialTabId?: string }) {
  const [activeId, setActiveId] = React.useState(
    (initialTabId && tabs.some((t) => t.id === initialTabId) ? initialTabId : tabs[0]?.id) ?? ""
  );
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="mb-4 flex flex-wrap gap-1.5 overflow-x-auto border-b border-border pb-2.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === activeTab?.id}
            onClick={() => setActiveId(t.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors",
              t.id === activeTab?.id
                ? "bg-brand-gradient text-white shadow-sm"
                : "text-text-secondary hover:bg-background hover:text-text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{activeTab?.content}</div>
    </div>
  );
}
