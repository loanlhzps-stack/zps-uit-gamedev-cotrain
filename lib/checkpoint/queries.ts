import { createClient } from "@/lib/supabase/server";
import type { CheckpointStatus } from "@/lib/constants/statuses";

export interface CheckpointPackage {
  id: string;
  versionLabel: string;
  status: CheckpointStatus;
  excelFileUrl: string | null;
  pdfFileUrl: string | null;
  driveUrl: string | null;
  notes: string | null;
  highlights: string | null;
  groupsMeetingExpectations: number | null;
  groupsNeedingImprovement: number | null;
  preExpoActions: string | null;
  uploadedByName: string | null;
  uploadedAt: string | null;
  publishedByName: string | null;
  publishedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PackageRow {
  id: string;
  version_label: string;
  status: CheckpointStatus;
  excel_file_url: string | null;
  pdf_file_url: string | null;
  drive_url: string | null;
  notes: string | null;
  highlights: string | null;
  groups_meeting_expectations: number | null;
  groups_needing_improvement: number | null;
  pre_expo_actions: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  published_by: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

const PACKAGE_SELECT =
  "id, version_label, status, excel_file_url, pdf_file_url, drive_url, notes, highlights, groups_meeting_expectations, groups_needing_improvement, pre_expo_actions, uploaded_by, uploaded_at, published_by, published_at, withdrawn_at, created_at, updated_at";

/**
 * `uploaded_by`/`published_by` are resolved with two extra lookups
 * (not a PostgREST embed) — both columns reference `profiles`, and
 * embedding two FKs to the same target table needs the generated
 * constraint name, which is fragile to guess; same approach already
 * used for `attendance_sheets.submitted_by`/`reopened_by`
 * (app/app/attendance/[sessionId]/[groupId]/page.tsx).
 */
async function attachNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: PackageRow[]
): Promise<CheckpointPackage[]> {
  const profileIds = [...new Set(rows.flatMap((r) => [r.uploaded_by, r.published_by]).filter((id): id is string => !!id))];
  const nameById = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", profileIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name);
  }

  return rows.map((r) => ({
    id: r.id,
    versionLabel: r.version_label,
    status: r.status,
    excelFileUrl: r.excel_file_url,
    pdfFileUrl: r.pdf_file_url,
    driveUrl: r.drive_url,
    notes: r.notes,
    highlights: r.highlights,
    groupsMeetingExpectations: r.groups_meeting_expectations,
    groupsNeedingImprovement: r.groups_needing_improvement,
    preExpoActions: r.pre_expo_actions,
    uploadedByName: r.uploaded_by ? (nameById.get(r.uploaded_by) ?? null) : null,
    uploadedAt: r.uploaded_at,
    publishedByName: r.published_by ? (nameById.get(r.published_by) ?? null) : null,
    publishedAt: r.published_at,
    withdrawnAt: r.withdrawn_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Owner/Co-owner view — every package regardless of status (RLS:
 * checkpoint_result_packages_select grants them full read), newest
 * first, so past withdrawn packages stay visible as history (section
 * 14.3 — "withdrawn ... without deleting the file history").
 */
export async function getCheckpointPackagesForOwner(programId: string): Promise<CheckpointPackage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checkpoint_result_packages")
    .select(PACKAGE_SELECT)
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .returns<PackageRow[]>();

  return attachNames(supabase, data ?? []);
}

/**
 * Everyone-else view — RLS only returns rows with status='published'
 * for non-Owner/Co-owner (checkpoint_result_packages_select), so this
 * query is safe for any role. Section 14.3/9.2 — "Milestones and
 * published results" (Sponsor Home) and the read-only /app/projects
 * view for every other role.
 */
export async function getPublishedCheckpointPackage(programId: string): Promise<CheckpointPackage | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checkpoint_result_packages")
    .select(PACKAGE_SELECT)
    .eq("program_id", programId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .returns<PackageRow[]>();

  const rows = await attachNames(supabase, data ?? []);
  return rows[0] ?? null;
}
