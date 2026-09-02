"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useCurrentUser } from "@/lib/auth/user-context";
import { searchAll, type SearchCategory } from "@/lib/actions/search";
import type { NotificationItem } from "@/lib/notifications/queries";

const DEBOUNCE_MS = 300;

/**
 * Global search — added on request after a later review pass found the
 * search box was decorative (no logic behind it). Not in the original
 * design doc. Debounced dropdown, no separate results page for v1 (see
 * lib/actions/search.ts for what's searched and why).
 */
function SearchBox() {
  const { user } = useCurrentUser();
  const [query, setQuery] = React.useState("");
  const [categories, setCategories] = React.useState<SearchCategory[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = React.useRef(0);

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

  function handleChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setCategories([]);
      setLoading(false);
      setOpen(trimmed.length > 0);
      return;
    }

    setOpen(true);
    setLoading(true);
    const thisRequestId = ++requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      const result = await searchAll(user.programId, trimmed);
      if (requestIdRef.current === thisRequestId) {
        setCategories(result);
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function handleClear() {
    setQuery("");
    setCategories([]);
    setOpen(false);
  }

  const trimmedQuery = query.trim();
  const hasResults = categories.some((c) => c.items.length > 0);

  return (
    <div ref={rootRef} className="relative hidden max-w-xl flex-1 lg:block">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-text-secondary">
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => trimmedQuery.length > 0 && setOpen(true)}
          placeholder="Tìm buổi học, bài tập, nhóm, dự án, điểm danh, thành viên…"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-text-secondary"
        />
        {query && (
          <button type="button" onClick={handleClear} aria-label="Xoá tìm kiếm" className="shrink-0">
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && trimmedQuery.length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface py-2 shadow-lg">
          {loading && <p className="px-3 py-2 text-[13px] text-text-secondary">Đang tìm…</p>}

          {!loading && !hasResults && (
            <p className="px-3 py-2 text-[13px] text-text-secondary">
              Không tìm thấy kết quả nào cho &quot;{trimmedQuery}&quot;.
            </p>
          )}

          {!loading &&
            categories.map((category) => (
              <div key={category.key} className="px-1 py-1">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  {category.title}
                </p>
                {category.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href as never}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-1.5 hover:bg-background"
                  >
                    <span className="block truncate text-[13px] font-semibold text-text-primary">
                      {item.label}
                    </span>
                    {item.sublabel && (
                      <span className="block truncate text-[11.5px] text-text-secondary">{item.sublabel}</span>
                    )}
                  </Link>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export function MainBar({
  title,
  onOpenMobileMenu,
  notifications,
  unreadCount,
}: {
  title: string;
  onOpenMobileMenu: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur supports-backdrop-blur:bg-surface/70 md:px-6">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="text-text-secondary md:hidden"
        aria-label="Mở menu"
      >
        <Menu className="size-6" />
      </button>

      <h1 className="shrink-0 truncate text-[15px] font-bold text-text-primary md:text-base">
        {title}
      </h1>

      <SearchBox />

      <ThemeToggle />

      <NotificationBell initialItems={notifications} initialUnreadCount={unreadCount} />

      <ProfileMenu />
    </header>
  );
}
