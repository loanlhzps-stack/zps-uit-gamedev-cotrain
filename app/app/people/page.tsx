import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { InviteMemberForm } from "@/components/people/invite-member-form";
import { MemberRow, type MemberRowData } from "@/components/people/member-row";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatSessionDate } from "@/lib/format/schedule";

interface SessionOptionRow {
  id: string;
  session_date: string;
  session_blocks: { title: string; sort_order: number }[];
}

// "Quản lý thành viên" giờ chỉ Owner mới vào được (theo yêu cầu của bạn) —
// trước đó Co-owner có chế độ chỉ xem, đã bỏ hẳn (đổi theo lib/nav.ts).
export default async function PeoplePage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/app");
  }
  const { user } = result;
  if (user.role !== "owner") {
    redirect("/app");
  }

  const supabase = await createClient();
  const [{ data: members }, { data: groups }, { data: sessionRows }] = await Promise.all([
    supabase
      .from("program_memberships")
      .select("id, role, status, invited_email, created_at, profiles!program_memberships_profile_id_fkey ( id, full_name, display_name, email )")
      .eq("program_id", user.programId)
      .order("created_at", { ascending: true })
      .returns<MemberRowData[]>(),
    supabase.from("groups").select("id, name").eq("program_id", user.programId).order("name"),
    supabase
      .from("sessions")
      .select("id, session_date, session_blocks(title, sort_order)")
      .eq("program_id", user.programId)
      .order("session_date", { ascending: true })
      .order("sort_order", { referencedTable: "session_blocks", ascending: true })
      .returns<SessionOptionRow[]>(),
  ]);

  const groupList = groups ?? [];
  const groupNameById = new Map(groupList.map((g) => [g.id, g.name]));
  const groupIds = groupList.map((g) => g.id);

  // Nhãn cho checklist "Nội dung học / Buổi phụ trách" ở form mời Trainer
  // — "Buổi 0X · ngày · nội dung" đúng cách đánh số ở /app/schedule.
  const sessionOptions = (sessionRows ?? []).map((s, index) => ({
    id: s.id,
    label: `Buổi ${String(index + 1).padStart(2, "0")} · ${formatSessionDate(s.session_date)} · ${
      s.session_blocks.map((b) => b.title).join(" · ") || "Chưa có learning block"
    }`,
  }));

  // Section 5.3 — "Assigned group(s)" is read-only on the member's own
  // profile; here (People & Access) is where Owner actually sets it.
  // Students live in group_members, Mentor ZPS/SV in mentor_assignments
  // (keyed by profile_id + mentor_type since a group has one slot of
  // each) — same two tables `changeMemberGroup` (lib/actions/invitations.ts)
  // writes to.
  const studentGroupByProfile = new Map<string, string>();
  const mentorGroupByProfile = new Map<string, string>();
  // Trainer — thông tin/hiển thị thôi (0018_trainer_group_assignments.sql),
  // 1 Trainer có thể phụ trách nhiều nhóm nên map ra mảng tên, khác 2 map
  // 1-nhóm-1-người ở trên (student/mentor).
  const trainerGroupNamesByProfile = new Map<string, string[]>();
  const trainerGroupIdsByProfile = new Map<string, string[]>();
  if (groupIds.length > 0) {
    const [{ data: groupMembers }, { data: mentorAssignments }, { data: trainerGroups }] = await Promise.all([
      supabase.from("group_members").select("profile_id, group_id").in("group_id", groupIds),
      supabase.from("mentor_assignments").select("profile_id, group_id, mentor_type").in("group_id", groupIds),
      supabase.from("trainer_group_assignments").select("profile_id, group_id").in("group_id", groupIds),
    ]);
    for (const gm of groupMembers ?? []) studentGroupByProfile.set(gm.profile_id, gm.group_id);
    for (const ma of mentorAssignments ?? []) mentorGroupByProfile.set(`${ma.profile_id}:${ma.mentor_type}`, ma.group_id);
    for (const tg of trainerGroups ?? []) {
      const name = groupNameById.get(tg.group_id);
      if (!name) continue;
      const nameList = trainerGroupNamesByProfile.get(tg.profile_id) ?? [];
      nameList.push(name);
      trainerGroupNamesByProfile.set(tg.profile_id, nameList);
      const idList = trainerGroupIdsByProfile.get(tg.profile_id) ?? [];
      idList.push(tg.group_id);
      trainerGroupIdsByProfile.set(tg.profile_id, idList);
    }
  }

  const membersWithGroup: MemberRowData[] = (members ?? []).map((member) => {
    const profileId = member.profiles?.id;
    if (!profileId) return member;
    let groupId: string | null = null;
    if (member.role === "student") {
      groupId = studentGroupByProfile.get(profileId) ?? null;
    } else if (member.role === "mentor_zps" || member.role === "mentor_student") {
      groupId = mentorGroupByProfile.get(`${profileId}:${member.role}`) ?? null;
    }
    const trainerGroupNames = member.role === "trainer" ? (trainerGroupNamesByProfile.get(profileId) ?? []) : null;
    const trainerGroupIds = member.role === "trainer" ? (trainerGroupIdsByProfile.get(profileId) ?? []) : null;
    return {
      ...member,
      groupId,
      groupName: groupId ? (groupNameById.get(groupId) ?? null) : null,
      trainerGroupNames,
      trainerGroupIds,
    };
  });

  return (
    <div className="space-y-6">
      <InviteMemberForm programId={user.programId} groups={groupList} sessions={sessionOptions} />

      <Card>
        <CardHeader>
          <CardTitle>Thành viên chương trình</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-border text-text-secondary">
                <tr>
                  <th className="px-5 py-3 font-semibold">Thành viên</th>
                  <th className="px-5 py-3 font-semibold">Vai trò</th>
                  <th className="px-5 py-3 font-semibold">Nhóm</th>
                  <th className="px-5 py-3 font-semibold">Trạng thái</th>
                  <th className="px-5 py-3 font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {membersWithGroup.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    programId={user.programId}
                    editable
                    currentUserId={user.id}
                    groups={groupList}
                  />
                ))}
                {membersWithGroup.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-text-secondary">
                      Chưa có thành viên nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
