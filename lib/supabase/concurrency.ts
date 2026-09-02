import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Section 20 — "Detect stale updates using updated_at ... Do not
 * silently overwrite a newer saved version." Shared by every
 * Server Action that edits a row multiple people can open at once
 * (group identity, Final Project meta, project submission drafts —
 * see README Phase 10 flagged deviation for the full list and why).
 *
 * The caller reads `updatedAt` off the row when the edit form was
 * rendered (a hidden form field) and passes it back here right before
 * writing. If someone else saved in between, the DB's current
 * `updated_at` no longer matches and the write is refused instead of
 * silently clobbering their change — same table, same client, same
 * column read twice, so exact string equality is reliable (no
 * cross-format timestamp parsing needed).
 */
export async function assertNotStale(
  supabase: SupabaseServerClient,
  table: string,
  id: string,
  expectedUpdatedAt: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!expectedUpdatedAt) {
    // No baseline to compare (e.g. a brand-new row never rendered in a
    // form yet) — nothing to protect against, let the caller proceed.
    return { ok: true };
  }
  const { data, error } = await supabase.from(table).select("updated_at").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Không tìm thấy dữ liệu." };
  if (data.updated_at !== expectedUpdatedAt) {
    return {
      ok: false,
      error: "Dữ liệu này vừa được người khác cập nhật. Tải lại trang để xem bản mới nhất trước khi lưu tiếp.",
    };
  }
  return { ok: true };
}
