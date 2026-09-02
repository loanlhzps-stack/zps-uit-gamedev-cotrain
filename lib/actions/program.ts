"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";

export interface ActionResult {
  error?: string;
  success?: string;
}

/**
 * Section 4.2 / new "Program settings" (/app/settings) — Owner/Co-owner
 * edit the program's start/end date and pick which session is the
 * Checkpoint milestone. Same bar as editing a program row anywhere else
 * (RLS: programs_update uses is_owner_or_co, 0002_rls.sql), and the
 * source of truth Home's "Giai đoạn chương trình" widget reads
 * (lib/schedule/milestones.ts).
 */
export async function updateProgramSettings(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") return { error: "Chưa đăng nhập." };
  const { user } = result;
  if (user.role !== "owner" && user.role !== "co_owner") {
    return { error: "Chỉ Owner/Co-owner mới có thể sửa Program settings." };
  }

  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const endsOn = String(formData.get("endsOn") ?? "").trim();
  const checkpointSessionId = String(formData.get("checkpointSessionId") ?? "").trim() || null;

  if (!startsOn || !endsOn) {
    return { error: "Thiếu ngày khai giảng hoặc tổng kết." };
  }
  if (startsOn > endsOn) {
    return { error: "Ngày khai giảng phải trước ngày tổng kết." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({
      starts_on: startsOn,
      ends_on: endsOn,
      checkpoint_session_id: checkpointSessionId,
    })
    .eq("id", user.programId);

  if (error) return { error: error.message };

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { success: "Đã lưu Program settings." };
}
