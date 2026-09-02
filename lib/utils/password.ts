// Sinh mật khẩu ngẫu nhiên dùng chung — mục "authen" (theo yêu cầu của
// bạn): Owner tự tạo tài khoản + đặt mật khẩu cho từng người, gửi thủ
// công, KHÔNG qua email mời của Supabase nữa (xem lib/actions/invitations.ts
// — inviteMember dùng admin.createUser thay admin.inviteUserByEmail).
// Dùng globalThis.crypto.getRandomValues (có sẵn cả trình duyệt lẫn
// Node/Next.js server) nên 1 hàm chạy được ở cả 2 phía: nút "Tạo ngẫu
// nhiên" trong form tạo tài khoản (client) và resetMemberPassword
// (server, Owner đặt lại mật khẩu khi thành viên quên).
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // bỏ 0/O/1/l/I dễ nhầm khi đọc/gõ lại

export function generateRandomPassword(length = 10): string {
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (n) => CHARSET[n % CHARSET.length]).join("");
}
