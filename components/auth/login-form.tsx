"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  redirectTo,
  initialError,
}: {
  redirectTo?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(
        signInError.message === "Invalid login credentials"
          ? "Email hoặc mật khẩu không đúng."
          : "Không thể đăng nhập. Vui lòng thử lại."
      );
      return;
    }

    router.replace(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/app");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <div className="mb-6 flex justify-center">
          <LogoFull height={44} />
        </div>
        <h1 className="text-center text-lg font-extrabold text-text-primary">Đăng nhập</h1>
        <p className="mt-1 text-center text-[13px] text-text-secondary">
          Dùng email đã được mời vào chương trình.
        </p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2 focus:ring-2 focus:ring-brand-orange-2/30"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>
      </div>
    </div>
  );
}
