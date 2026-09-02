"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSession } from "@/lib/actions/schedule";

export function CreateSessionForm({ programId }: { programId: string }) {
  const router = useRouter();
  const [blockTitles, setBlockTitles] = React.useState<string[]>([""]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateBlock(i: number, value: string) {
    setBlockTitles((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function addBlock() {
    setBlockTitles((prev) => [...prev, ""]);
  }

  function removeBlock(i: number) {
    setBlockTitles((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await createSession(formData);
    // createSession redirect()s to the new session on success — it only
    // returns here when there was a validation/DB error.
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thêm buổi học</CardTitle>
        <CardDescription>
          Dùng khi lịch gốc 16 buổi thay đổi (nghỉ lễ, dời lịch, buổi phát sinh) — Owner/Co-owner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sessionDate" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Ngày học
              </label>
              <input
                id="sessionDate"
                name="sessionDate"
                type="date"
                required
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
              />
            </div>
            <div>
              <label htmlFor="location" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Địa điểm
              </label>
              <input
                id="location"
                name="location"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
              />
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-text-primary">Learning block</span>
            <div className="space-y-2">
              {blockTitles.map((title, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    name="blockTitle"
                    value={title}
                    onChange={(e) => updateBlock(i, e.target.value)}
                    placeholder="Tên learning block"
                    required
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
                  />
                  {blockTitles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBlock(i)}
                      className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-risk hover:bg-risk/10"
                    >
                      Xoá
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addBlock}
              className="mt-2 text-[12px] font-semibold text-brand-orange-3 hover:underline"
            >
              + Thêm learning block
            </button>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Đang tạo…" : "Tạo buổi học"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => router.back()}>
              Huỷ
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
