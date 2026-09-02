import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { getStudentGroupId, getMentorGroupIds } from "@/lib/attendance/queries";
import { getNearestUpcomingSessionId } from "@/lib/schedule/queries";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SessionStatusBadge } from "@/components/schedule/session-status-badge";
import { SessionEditForm } from "@/components/schedule/session-edit-form";
import { formatSessionDate, formatSessionWeekday, getSessionStatusDisplay } from "@/lib/format/schedule";
import type { SessionStatus } from "@/lib/constants/statuses";

interface SessionDetailRow {
  id: string;
  session_date: string;
  location: string | null;
  status: SessionStatus;
  trainer_profile_ids: string[];
  survey_url: string | null;
  internal_notes: string | null;
  post_session_reflection: string | null;
  session_blocks: { id: string; title: string; sort_order: number; materials_url: string | null }[];
}

// Section 10.3 (session record) + 15 (survey link) + 4.3-style column
// privacy for internal_notes/post_session_reflection: staff-only, so
// they are simply not selected/rendered for Sponsor/Mentor/Student —
// same technique as attendance_records.note (see 0002_rls.sql header).
// Trainer bỏ khỏi staff-only kể từ đây (theo yêu cầu của bạn, thu hẹp
// phạm vi Trainer) — chỉ còn Owner/Co-owner thấy 2 trường này.
const STAFF_ROLES = new Set(["owner", "co_owner"]);

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  let backHref = "/app/schedule";
  if (user.role === "student") {
    const groupId = await getStudentGroupId(user.id);
    if (groupId) backHref = `/app/groups/${groupId}?tab=schedule`;
  } else if (user.role === "mentor_zps" || user.role === "mentor_student") {
    // Mentor không còn menu "Thời khóa biểu" riêng nữa (theo yêu cầu
    // của bạn, xem 0016_mentor_parity.sql) — quay lại đúng nhóm mình
    // phụ trách thay vì trang danh sách đã bị chặn.
    const [groupId] = await getMentorGroupIds(user.id);
    if (groupId) backHref = `/app/groups/${groupId}?tab=schedule`;
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, session_date, location, status, trainer_profile_ids, survey_url, internal_notes, post_session_reflection, session_blocks(id, title, sort_order, materials_url)"
    )
    .eq("id", sessionId)
    .eq("program_id", user.programId)
    .order("sort_order", { referencedTable: "session_blocks", ascending: true })
    .maybeSingle<SessionDetailRow>();

  if (!session) {
    notFound();
  }

  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  // Trainer không còn sửa được buổi học nữa — Owner/Co-owner quản lý
  // toàn bộ Thời khóa biểu (theo yêu cầu của bạn, xem
  // 0017_trainer_view_scope.sql — sessions_update/session_blocks_write
  // đã bỏ nhánh Trainer ở RLS, đây là UI mirror của thay đổi đó).
  const canEdit = isOwnerOrCo;
  const canSeeStaffFields = STAFF_ROLES.has(user.role);

  const { data: trainerProfiles } = session.trainer_profile_ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", session.trainer_profile_ids)
    : { data: [] as { id: string; display_name: string }[] };

  let allTrainers: { id: string; display_name: string }[] = [];
  if (isOwnerOrCo) {
    const { data: trainerMembers } = await supabase
      .from("program_memberships")
      .select("profiles ( id, display_name )")
      .eq("program_id", user.programId)
      .eq("role", "trainer")
      .eq("status", "active")
      .returns<{ profiles: { id: string; display_name: string } | null }[]>();
    allTrainers = (trainerMembers ?? [])
      .map((m) => m.profiles)
      .filter((p): p is { id: string; display_name: string } => p !== null);
  }

  const showSurvey = session.status === "completed" && session.survey_url;
  const nearestUpcomingId = await getNearestUpcomingSessionId(user.programId);
  const statusDisplay = getSessionStatusDisplay(session.status, session.id === nearestUpcomingId);

  return (
    <div className="space-y-5">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Thời khóa biểu
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {formatSessionWeekday(session.session_date)}, {formatSessionDate(session.session_date)}
            </CardTitle>
            <SessionStatusBadge display={statusDisplay} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {session.location && (
            <p className="flex items-center gap-1.5 text-[13px] text-text-primary">
              <MapPin className="size-4 text-text-secondary" aria-hidden="true" />
              {session.location}
            </p>
          )}

          <div>
            <h3 className="mb-2 text-[13px] font-bold text-text-primary">Learning blocks</h3>
            <ul className="space-y-2">
              {session.session_blocks.map((block) => (
                <li key={block.id} className="rounded-lg border border-border p-3">
                  <p className="text-[13px] font-semibold text-text-primary">{block.title}</p>
                  {block.materials_url && (
                    <a
                      href={block.materials_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-brand-orange-3 hover:underline"
                    >
                      Tài liệu <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </li>
              ))}
              {session.session_blocks.length === 0 && (
                <li className="text-[13px] text-text-secondary">Chưa có learning block.</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="mb-1 text-[13px] font-bold text-text-primary">Trainer phụ trách</h3>
            <p className="text-[13px] text-text-secondary">
              {trainerProfiles && trainerProfiles.length > 0
                ? trainerProfiles.map((t) => t.display_name).join(", ")
                : "Chưa gán Trainer."}
            </p>
          </div>

          {showSurvey && (
            <a
              href={session.survey_url!}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-4 py-2 text-[13px] font-bold text-white"
            >
              Thực hiện khảo sát buổi học <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}

          {canSeeStaffFields && (session.internal_notes || session.post_session_reflection) && (
            <div className="space-y-3 border-t border-border pt-4">
              {session.internal_notes && (
                <div>
                  <h3 className="mb-1 text-[13px] font-bold text-text-primary">Ghi chú nội bộ</h3>
                  <p className="whitespace-pre-wrap text-[13px] text-text-secondary">{session.internal_notes}</p>
                </div>
              )}
              {session.post_session_reflection && (
                <div>
                  <h3 className="mb-1 text-[13px] font-bold text-text-primary">Đúc kết sau buổi học</h3>
                  <p className="whitespace-pre-wrap text-[13px] text-text-secondary">
                    {session.post_session_reflection}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <SessionEditForm
          sessionId={session.id}
          programId={user.programId}
          isOwnerOrCo={isOwnerOrCo}
          status={session.status}
          sessionDate={session.session_date}
          location={session.location}
          surveyUrl={session.survey_url}
          internalNotes={session.internal_notes}
          postSessionReflection={session.post_session_reflection}
          blocks={session.session_blocks}
          allTrainers={allTrainers}
          assignedTrainerIds={session.trainer_profile_ids}
        />
      )}
    </div>
  );
}
