import { redirect } from "next/navigation";

// "Báo cáo" đã bỏ hẳn khỏi mọi role (theo yêu cầu của bạn) — nội dung
// từng ở đây (Tiến độ đào tạo, Hoàn thành bài tập %, Attendance sheet
// còn thiếu, Sức khoẻ 8 nhóm, Audit log) đã chuyển hết về Trang chủ
// Owner/Co-owner (xem app/app/page.tsx). Giữ lại route này để không
// vỡ link cũ — chỉ redirect thẳng về Trang chủ.
export default function ReportsPage() {
  redirect("/app");
}
