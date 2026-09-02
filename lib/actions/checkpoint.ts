"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrCo } from "@/lib/assignments/access";
import { CHECKPOINT_PLANNING_STATUSES, type CheckpointStatus } from "@/lib/constants/statuses";
import { createNotifications } from "@/lib/notifications/create";

export interface ActionResult {
  error?: string;
}

function paths() {
  revalidatePath("/app/projects");
  revalidatePath("/app");
}

function toIntOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Section 14.3 — Owner/Co-owner starts a new result package for the
 * checkpoint (a new `version_label`, not an edit of a past one — a
 * withdrawn package's row is kept as history rather than reused for
 * the next attempt).
 */
export async function createCheckpointPackage(programId: string, formData: FormData): Promise<ActionResult> {
  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase } = guard;

  const versionLabel = String(formData.get("versionLabel") ?? "").trim();
  if (!versionLabel) return { error: "Thiếu version label." };

  const { error } = await supabase
    .from("checkpoint_result_packages")
    .insert({ program_id: programId, version_label: versionLabel, status: "awaiting_submissions" });
  if (error) return { error: error.message };

  paths();
  return {};
}

/**
 * Free status dropdown for the 3 "planning" stages (section 14.2's
 * flow before any file exists) — same freeform-status simplification
 * used for sessions/assignments. Blocked once the package has moved
 * past planning (uploaded/published/withdrawn) so this can't be used
 * to sneak a package backward out of those states.
 */
export async function setCheckpointStage(packageId: string, programId: string, status: CheckpointStatus): Promise<ActionResult> {
  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase } = guard;

  if (!CHECKPOINT_PLANNING_STATUSES.includes(status as (typeof CHECKPOINT_PLANNING_STATUSES)[number])) {
    return { error: "Trạng thái không hợp lệ." };
  }

  const { data: pkg } = await supabase
    .from("checkpoint_result_packages")
    .select("id, status, program_id")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg || pkg.program_id !== programId) return { error: "Không tìm thấy result package." };
  if (!CHECKPOINT_PLANNING_STATUSES.includes(pkg.status as (typeof CHECKPOINT_PLANNING_STATUSES)[number])) {
    return { error: "Package đã tải lên/công bố — không đổi được về giai đoạn chuẩn bị." };
  }

  const { error } = await supabase.from("checkpoint_result_packages").update({ status }).eq("id", packageId);
  if (error) return { error: error.message };

  paths();
  return {};
}

/**
 * Editable fields (not status). Blocked once withdrawn — start a new
 * package (new version_label) instead of mutating retired history.
 */
export async function updateCheckpointMeta(packageId: string, programId: string, formData: FormData): Promise<ActionResult> {
  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase } = guard;

  const { data: pkg } = await supabase
    .from("checkpoint_result_packages")
    .select("id, status, program_id")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg || pkg.program_id !== programId) return { error: "Không tìm thấy result package." };
  if (pkg.status === "withdrawn") return { error: "Package đã thu hồi — tạo package mới thay vì sửa." };

  const versionLabel = String(formData.get("versionLabel") ?? "").trim();
  if (!versionLabel) return { error: "Thiếu version label." };

  const { error } = await supabase
    .from("checkpoint_result_packages")
    .update({
      version_label: versionLabel,
      excel_file_url: String(formData.get("excelFileUrl") ?? "").trim() || null,
      pdf_file_url: String(formData.get("pdfFileUrl") ?? "").trim() || null,
      drive_url: String(formData.get("driveUrl") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      highlights: String(formData.get("highlights") ?? "").trim() || null,
      groups_meeting_expectations: toIntOrNull(formData.get("groupsMeetingExpectations")),
      groups_needing_improvement: toIntOrNull(formData.get("groupsNeedingImprovement")),
      pre_expo_actions: String(formData.get("preExpoActions") ?? "").trim() || null,
    })
    .eq("id", packageId);
  if (error) return { error: error.message };

  paths();
  return {};
}

/**
 * Section 14.2/14.3 — "Owner/Co-owner uploads official result
 * package" as its own step, distinct from Publish. Requires at least
 * one result artifact (Excel/PDF/Drive link) so an empty upload can't
 * silently sit at `result_uploaded`.
 */
export async function uploadResultPackage(packageId: string, programId: string, formData: FormData): Promise<ActionResult> {
  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase, user } = guard;

  const { data: pkg } = await supabase
    .from("checkpoint_result_packages")
    .select("id, status, program_id")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg || pkg.program_id !== programId) return { error: "Không tìm thấy result package." };
  if (pkg.status === "published" || pkg.status === "withdrawn") {
    return { error: "Package đã công bố/thu hồi — không tải lại được ở đây." };
  }

  const excelFileUrl = String(formData.get("excelFileUrl") ?? "").trim() || null;
  const pdfFileUrl = String(formData.get("pdfFileUrl") ?? "").trim() || null;
  const driveUrl = String(formData.get("driveUrl") ?? "").trim() || null;
  if (!excelFileUrl && !pdfFileUrl && !driveUrl) {
    return { error: "Cần ít nhất một trong: file Excel, file PDF, hoặc link Drive." };
  }

  const { error } = await supabase
    .from("checkpoint_result_packages")
    .update({
      excel_file_url: excelFileUrl,
      pdf_file_url: pdfFileUrl,
      drive_url: driveUrl,
      notes: String(formData.get("notes") ?? "").trim() || null,
      highlights: String(formData.get("highlights") ?? "").trim() || null,
      groups_meeting_expectations: toIntOrNull(formData.get("groupsMeetingExpectations")),
      groups_needing_improvement: toIntOrNull(formData.get("groupsNeedingImprovement")),
      pre_expo_actions: String(formData.get("preExpoActions") ?? "").trim() || null,
      status: "result_uploaded",
      uploaded_by: user.id,
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", packageId);
  if (error) return { error: error.message };

  paths();
  return {};
}

/**
 * Section 14.3 — "Upload and Publish are separate actions." Only from
 * `result_uploaded` — Publish always follows an actual Upload, never
 * skips straight from a planning stage. Logged to audit_logs per
 * 0001_init.sql's audit_logs comment ("every publish/permission/
 * override/destructive action").
 */
export async function publishResultPackage(packageId: string, programId: string): Promise<ActionResult> {
  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase, user } = guard;

  const { data: pkg } = await supabase
    .from("checkpoint_result_packages")
    .select("id, status, program_id")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg || pkg.program_id !== programId) return { error: "Không tìm thấy result package." };
  if (pkg.status !== "result_uploaded") return { error: "Chỉ công bố được package đã tải lên." };

  const { error } = await supabase
    .from("checkpoint_result_packages")
    .update({ status: "published", published_by: user.id, published_at: new Date().toISOString() })
    .eq("id", packageId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    program_id: programId,
    actor_profile_id: user.id,
    action: "checkpoint_publish",
    entity_type: "checkpoint_result_package",
    entity_id: packageId,
    metadata: {},
  });

  // Section 16.1 — 'checkpoint_published' notification, one of the
  // enum's 9 types this session actually wires up (see README flagged
  // deviation for the ones that would need a scheduled job instead).
  const { data: memberships } = await supabase
    .from("program_memberships")
    .select("profile_id")
    .eq("program_id", programId)
    .eq("status", "active");
  await createNotifications(supabase, {
    programId,
    recipientProfileIds: (memberships ?? []).map((m) => m.profile_id),
    type: "checkpoint_published",
    title: "Kết quả Checkpoint đã được công bố",
    linkHref: "/app/projects",
    excludeProfileId: user.id,
  });

  paths();
  return {};
}

/**
 * Section 14.3 — "Published results may be withdrawn ... without
 * deleting the file history": only flips status (RLS then hides it
 * from non-Owner/Co-owner again), the row and its files stay intact.
 */
export async function withdrawResultPackage(packageId: string, programId: string): Promise<ActionResult> {
  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase, user } = guard;

  const { data: pkg } = await supabase
    .from("checkpoint_result_packages")
    .select("id, status, program_id")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg || pkg.program_id !== programId) return { error: "Không tìm thấy result package." };
  if (pkg.status !== "published") return { error: "Chỉ thu hồi được package đang công bố." };

  const { error } = await supabase
    .from("checkpoint_result_packages")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("id", packageId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    program_id: programId,
    actor_profile_id: user.id,
    action: "checkpoint_withdraw",
    entity_type: "checkpoint_result_package",
    entity_id: packageId,
    metadata: {},
  });

  paths();
  return {};
}
