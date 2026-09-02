"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getGroupWorkspaceAccess } from "@/lib/groups/access";
import {
  PROJECT_MILESTONE_STAGES,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_CHECKLIST_ITEM_STATUSES,
  PROJECT_CHECKLIST_CATEGORIES,
  type ProjectMilestoneStage,
  type ProjectMilestoneStatus,
  type ProjectChecklistItemStatus,
} from "@/lib/constants/statuses";
import { assertNotStale } from "@/lib/supabase/concurrency";

export interface ActionResult {
  error?: string;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function paths(groupId: string) {
  revalidatePath(`/app/groups/${groupId}`);
  revalidatePath("/app/groups");
  revalidatePath("/app");
}

// ---------------------------------------------------------------------
// Group identity (section 13.1) — name/image. Owner/Co-owner or any
// STUDENT member (mentors excluded — see lib/groups/access.ts header).
// ---------------------------------------------------------------------
export async function updateGroupIdentity(groupId: string, formData: FormData): Promise<ActionResult> {
  const access = await getGroupWorkspaceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.canEditIdentity) return { error: "Bạn không có quyền sửa thông tin nhóm này." };
  const { supabase, user } = access;

  const name = String(formData.get("name") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const expectedUpdatedAt = String(formData.get("updatedAt") ?? "").trim() || null;
  if (!name) return { error: "Thiếu tên nhóm." };

  const stale = await assertNotStale(supabase, "groups", groupId, expectedUpdatedAt);
  if (!stale.ok) return { error: stale.error };

  const { error } = await supabase
    .from("groups")
    .update({ name, image_url: imageUrl || null, last_updated_by: user.id })
    .eq("id", groupId);
  if (error) return { error: error.message };

  paths(groupId);
  return {};
}

// ---------------------------------------------------------------------
// group_projects is seeded 1:1 per group — always an update, never a
// create. Owner/Co-owner or any group member/mentor (RLS:
// group_projects_update).
// ---------------------------------------------------------------------
async function getProjectId(groupId: string, supabase: SupabaseServerClient) {
  const { data } = await supabase.from("group_projects").select("id").eq("group_id", groupId).maybeSingle();
  return data?.id ?? null;
}

export async function updateGroupProject(groupId: string, formData: FormData): Promise<ActionResult> {
  const access = await getGroupWorkspaceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.canEditProjectContent) return { error: "Bạn không có quyền sửa Final Project của nhóm này." };
  const { supabase, user } = access;

  const projectId = await getProjectId(groupId, supabase);
  if (!projectId) return { error: "Không tìm thấy dự án của nhóm." };

  const gameName = String(formData.get("gameName") ?? "").trim();
  const concept = String(formData.get("concept") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const expectedUpdatedAt = String(formData.get("updatedAt") ?? "").trim() || null;

  const stale = await assertNotStale(supabase, "group_projects", projectId, expectedUpdatedAt);
  if (!stale.ok) return { error: stale.error };

  const { error } = await supabase
    .from("group_projects")
    .update({
      game_name: gameName || null,
      concept: concept || null,
      image_url: imageUrl || null,
      last_updated_by: user.id,
    })
    .eq("id", projectId);
  if (error) return { error: error.message };

  paths(groupId);
  return {};
}

// ---------------------------------------------------------------------
// "Tiến độ dự án" — hành trình 8 giai đoạn cố định + trạng thái/mục
// tiêu tiếp theo/deadline (theo yêu cầu của bạn, thay "milestone" tự
// do cũ). Không có form nộp/khoá — chỉ 1 dòng trạng thái hiện tại của
// group_projects, ai canEditProjectContent cũng sửa được, giống
// updateGroupProject.
// ---------------------------------------------------------------------
export async function updateProjectMilestone(groupId: string, formData: FormData): Promise<ActionResult> {
  const access = await getGroupWorkspaceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.canEditProjectContent) return { error: "Bạn không có quyền sửa tiến độ dự án này." };
  const { supabase, user } = access;

  const projectId = await getProjectId(groupId, supabase);
  if (!projectId) return { error: "Không tìm thấy dự án của nhóm." };

  const stage = String(formData.get("milestoneStage") ?? "");
  const status = String(formData.get("milestoneStatus") ?? "");
  const nextGoal = String(formData.get("milestoneNextGoal") ?? "").trim();
  const deadlineRaw = String(formData.get("milestoneDeadline") ?? "").trim();
  const expectedUpdatedAt = String(formData.get("updatedAt") ?? "").trim() || null;

  if (!PROJECT_MILESTONE_STAGES.includes(stage as ProjectMilestoneStage)) return { error: "Giai đoạn không hợp lệ." };
  if (!PROJECT_MILESTONE_STATUSES.includes(status as ProjectMilestoneStatus)) return { error: "Trạng thái không hợp lệ." };

  const stale = await assertNotStale(supabase, "group_projects", projectId, expectedUpdatedAt);
  if (!stale.ok) return { error: stale.error };

  const { error } = await supabase
    .from("group_projects")
    .update({
      milestone_stage: stage,
      milestone_status: status,
      milestone_next_goal: nextGoal || null,
      milestone_deadline: deadlineRaw || null,
      last_updated_by: user.id,
    })
    .eq("id", projectId);
  if (error) return { error: error.message };

  paths(groupId);
  return {};
}

// ---------------------------------------------------------------------
// "Build và tài liệu" (project_builds) — mỗi build là 1 dòng riêng,
// KHÔNG ghi đè (theo yêu cầu của bạn: "+ Thêm phiên bản mới" thay vì
// 1 ô Build duy nhất). Sửa/xoá vẫn cho phép (sửa nhầm, dọn bản test)
// — không có khái niệm khoá như "Bài nộp dự án" cũ.
// ---------------------------------------------------------------------
function readBuildFields(formData: FormData) {
  return {
    version_name: String(formData.get("versionName") ?? "").trim(),
    platform: String(formData.get("platform") ?? "").trim() || null,
    build_url: String(formData.get("buildUrl") ?? "").trim() || null,
    repository_url: String(formData.get("repositoryUrl") ?? "").trim() || null,
    install_instructions: String(formData.get("installInstructions") ?? "").trim() || null,
    known_issues: String(formData.get("knownIssues") ?? "").trim() || null,
    release_notes: String(formData.get("releaseNotes") ?? "").trim() || null,
    gdd_url: String(formData.get("gddUrl") ?? "").trim() || null,
    gameplay_demo_url: String(formData.get("gameplayDemoUrl") ?? "").trim() || null,
    screenshot_urls: String(formData.get("screenshotUrls") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export async function createProjectBuild(groupId: string, formData: FormData): Promise<ActionResult> {
  const access = await getGroupWorkspaceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.canEditProjectContent) return { error: "Bạn không có quyền thêm phiên bản build." };
  const { supabase, user } = access;

  const fields = readBuildFields(formData);
  if (!fields.version_name) return { error: "Thiếu tên phiên bản." };

  const projectId = await getProjectId(groupId, supabase);
  if (!projectId) return { error: "Không tìm thấy dự án của nhóm." };

  const { error } = await supabase
    .from("project_builds")
    .insert({ group_project_id: projectId, uploaded_by: user.id, ...fields });
  if (error) return { error: error.message };

  paths(groupId);
  return {};
}

export async function updateProjectBuild(groupId: string, buildId: string, formData: FormData): Promise<ActionResult> {
  const access = await getGroupWorkspaceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.canEditProjectContent) return { error: "Bạn không có quyền sửa phiên bản build này." };
  const { supabase } = access;

  const fields = readBuildFields(formData);
  if (!fields.version_name) return { error: "Thiếu tên phiên bản." };
  const expectedUpdatedAt = String(formData.get("updatedAt") ?? "").trim() || null;

  const stale = await assertNotStale(supabase, "project_builds", buildId, expectedUpdatedAt);
  if (!stale.ok) return { error: stale.error };

  const { error } = await supabase.from("project_builds").update(fields).eq("id", buildId);
  if (error) return { error: error.message };

  paths(groupId);
  return {};
}

export async function deleteProjectBuild(groupId: string, buildId: string): Promise<ActionResult> {
  const access = await getGroupWorkspaceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.canEditProjectContent) return { error: "Bạn không có quyền xoá phiên bản build này." };
  const { supabase } = access;

  const { error } = await supabase.from("project_builds").delete().eq("id", buildId);
  if (error) return { error: error.message };

  paths(groupId);
  return {};
}

// ---------------------------------------------------------------------
// Checklist (project_checklist_status) — 15 mục cố định (định nghĩa ở
// lib/constants/statuses.ts PROJECT_CHECKLIST_CATEGORIES), mỗi mục 1
// trong 4 trạng thái. Sparse: upsert theo (group_project_id, item_key)
// — mục chưa từng đổi thì không có dòng, coi như "not_started".
// ---------------------------------------------------------------------
const CHECKLIST_ITEM_KEYS = new Set(
  PROJECT_CHECKLIST_CATEGORIES.flatMap((c) => c.items.map((i) => i.key))
);

export async function setProjectChecklistItemStatus(
  groupId: string,
  itemKey: string,
  status: ProjectChecklistItemStatus
): Promise<ActionResult> {
  const access = await getGroupWorkspaceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.canEditProjectContent) return { error: "Bạn không có quyền sửa checklist này." };
  const { supabase, user } = access;

  if (!CHECKLIST_ITEM_KEYS.has(itemKey)) return { error: "Mục checklist không hợp lệ." };
  if (!PROJECT_CHECKLIST_ITEM_STATUSES.includes(status)) return { error: "Trạng thái không hợp lệ." };

  const projectId = await getProjectId(groupId, supabase);
  if (!projectId) return { error: "Không tìm thấy dự án của nhóm." };

  const { error } = await supabase
    .from("project_checklist_status")
    .upsert(
      { group_project_id: projectId, item_key: itemKey, status, updated_by: user.id },
      { onConflict: "group_project_id,item_key" }
    );
  if (error) return { error: error.message };

  paths(groupId);
  return {};
}
