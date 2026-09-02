import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      redirectTo={params.redirectTo}
      initialError={params.error ? "Phiên đăng nhập đã hết hạn hoặc không hợp lệ, vui lòng đăng nhập lại." : undefined}
    />
  );
}
