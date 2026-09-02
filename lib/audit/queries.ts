import { createClient } from "@/lib/supabase/server";

export interface AuditLogEntry {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  created_at: string;
}

/**
 * Owner/Co-owner only (permission matrix "View audit log", mục 4.2) —
 * `audit_logs_select` RLS enforces the same, this is just the UI-branch
 * gate. Names resolved with a separate lookup, same reasoning as
 * checkpoint_result_packages' uploaded_by/published_by
 * (lib/checkpoint/queries.ts) — actor_profile_id is one more FK to
 * `profiles` and an embed would need the generated constraint name.
 */
export async function getAuditLog(programId: string, limit = 100): Promise<AuditLogEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, actor_profile_id, action, entity_type, entity_id, reason, created_at")
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AuditLogRow[]>();

  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_profile_id).filter((id): id is string => !!id))];
  const nameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", actorIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name);
  }

  return rows.map((r) => ({
    id: r.id,
    actorName: r.actor_profile_id ? (nameById.get(r.actor_profile_id) ?? null) : null,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}
