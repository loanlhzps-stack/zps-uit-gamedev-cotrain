import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";

/**
 * Section 4.2/12.1 — who may edit a Course Assignment's own fields
 * (title/description/due date/status) or review its submissions:
 * Owner/Co-owner (any assignment, override) or the Trainer who created
 * it ("own teaching session" scope — an assignment's session_id may be
 * null for a whole-program assignment created by Owner/Co-owner, but a
 * Trainer can only ever be the creator of assignments tied to their own
 * session, enforced at creation time in lib/actions/assignments.ts).
 * Mirrors assignments_update/assignments_delete RLS (0002_rls.sql) —
 * this is the UI-branch resolution, RLS is still the real boundary.
 */
export async function getAssignmentAccess(assignmentId: string) {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    return { ok: false as const, error: "Chưa đăng nhập hoặc không có quyền." };
  }
  const { user } = result;

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, program_id, created_by, session_id, status, submission_mode")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment || assignment.program_id !== user.programId) {
    return { ok: false as const, error: "Không tìm thấy bài tập." };
  }

  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  const isCreator = assignment.created_by === user.id;
  // Section 12.1 — "the owning Trainer reviews ... Owner/Co-owner can
  // override with an audit reason." canReviewAsOwner flags the
  // override branch specifically so actions can decide when to write
  // to audit_logs (only when the actor is NOT the normal owning Trainer).
  const canEditMeta = isOwnerOrCo || (user.role === "trainer" && isCreator);
  const canReview = canEditMeta;
  const isOverrideReview = isOwnerOrCo && !isCreator;

  return {
    ok: true as const,
    supabase,
    user,
    programId: assignment.program_id,
    assignment,
    isOwnerOrCo,
    isCreator,
    canEditMeta,
    canReview,
    isOverrideReview,
  };
}

/** Section 4.2 — creating an assignment is Owner/Co-owner-only in the "any scope" branch. */
export async function requireOwnerOrCo(programId: string) {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    return { ok: false as const, error: "Chưa đăng nhập hoặc không có quyền." };
  }
  const { user } = result;
  if (user.programId !== programId) {
    return { ok: false as const, error: "Không tìm thấy chương trình." };
  }
  if (user.role !== "owner" && user.role !== "co_owner") {
    return { ok: false as const, error: "Chỉ Owner/Co-owner mới có thể thực hiện thao tác này." };
  }
  const supabase = await createClient();
  return { ok: true as const, supabase, user };
}
