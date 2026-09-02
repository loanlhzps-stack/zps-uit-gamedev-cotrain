import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { GroupMemberDetail } from "@/lib/groups/queries";

/**
 * "Thành viên" tab (section 13.3) — read-only aggregation.
 *
 * README flagged deviation (theo yêu cầu của bạn): bỏ cột "Vai trò dự
 * án" khỏi bảng này (dữ liệu vẫn còn trong schema `project_members`,
 * chỉ không còn UI đọc/sửa ở app). Gộp 3 cột Tham gia/Vắng/Điều kiện
 * (cùng mô tả điểm danh, dễ đọc nhầm) thành 1 cột "Số buổi tham gia" x/y (đổi tên cột theo yêu cầu của bạn — "Tham gia" ngắn dễ hiểu lầm).
 * Cột "Tiến độ task" (dựa trên Nhiệm vụ/Mentor Task) đã bỏ hẳn cùng
 * đợt xoá hẳn tính năng Nhiệm vụ khỏi app (code + schema).
 */
export function MembersTable({
  members,
  viewerId,
}: {
  members: GroupMemberDetail[];
  viewerId: string;
}) {
  if (members.length === 0) {
    return <p className="text-[13px] text-text-secondary">Nhóm chưa có thành viên nào.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-wide text-text-secondary">
            <th className="py-2 pr-3 font-semibold">Thành viên</th>
            <th className="py-2 font-semibold">Số buổi tham gia</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.profileId} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <Avatar src={m.avatarUrl} name={m.displayName} size={28} />
                  <span className="font-semibold text-text-primary">{m.displayName}</span>
                  {m.profileId === viewerId && <Badge variant="brand">Bạn</Badge>}
                </div>
              </td>
              <td className="py-2.5 text-text-secondary">
                {m.attended}/{m.totalSessions}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
