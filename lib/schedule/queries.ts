import { createClient } from "@/lib/supabase/server";

/**
 * Home dashboard read helpers (section 9.1/9.3/9.4/9.5) — real data for
 * program progress and next-session widgets. Attendance widgets moved to
 * lib/attendance/queries.ts (Phase 6); assignment/deadline widgets to
 * lib/assignments/queries.ts (Phase 7).
 */

export async function getProgramSessionStats(
  programId: string
): Promise<{ completed: number; total: number }> {
  const supabase = await createClient();
  const [{ count: total }, { count: completed }] = await Promise.all([
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("program_id", programId),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("program_id", programId)
      .eq("status", "completed"),
  ]);
  return { completed: completed ?? 0, total: total ?? 0 };
}

/**
 * Id buổi `draft`/`scheduled` gần hôm nay nhất (>= hôm nay) — dùng
 * cho trang chi tiết 1 buổi học (`/app/schedule/[sessionId]`) để biết
 * buổi đang xem có phải "Sắp tới" hay không, vì trang đó chỉ fetch 1
 * buổi, không có sẵn cả danh sách như trang `/app/schedule` hay tab
 * Thời khóa biểu của Nhóm dự án (2 nơi đó dùng bản thuần
 * `getNearestUpcomingSessionId` trong `lib/format/schedule.ts` thay vì
 * gọi hàm này, vì đã có sẵn đủ dữ liệu, không cần query thêm).
 */
export async function getNearestUpcomingSessionId(programId: string): Promise<string | null> {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("sessions")
    .select("id")
    .eq("program_id", programId)
    .in("status", ["draft", "scheduled"])
    .gte("session_date", todayIso)
    .order("session_date", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export interface UpcomingSessionSummary {
  id: string;
  sessionDate: string;
  blocks: string[];
}

interface NextSessionRow {
  id: string;
  session_date: string;
  session_blocks: { title: string; sort_order: number }[];
}

/**
 * Next session from today onward. Pass trainerId to scope to a
 * Trainer's own assigned sessions (section 9.3 "Buổi dạy sắp tới");
 * omit it for the program-wide next session (section 9.4/9.5 Mentor
 * "Buổi kế tiếp"). (Bỏ filter loại `cancelled` cũ — status đó không
 * còn tồn tại sau đợt rút gọn Session status, xem `lib/constants/
 * statuses.ts`.)
 */
export async function getNextUpcomingSession(
  programId: string,
  opts?: { trainerId?: string }
): Promise<UpcomingSessionSummary | null> {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("sessions")
    .select("id, session_date, session_blocks(title, sort_order)")
    .eq("program_id", programId)
    .gte("session_date", todayIso)
    .order("session_date", { ascending: true })
    .limit(1);

  if (opts?.trainerId) {
    query = query.contains("trainer_profile_ids", [opts.trainerId]);
  }

  const { data } = await query.returns<NextSessionRow[]>();
  const row = data?.[0];
  if (!row) return null;

  return {
    id: row.id,
    sessionDate: row.session_date,
    blocks: [...row.session_blocks].sort((a, b) => a.sort_order - b.sort_order).map((b) => b.title),
  };
}
