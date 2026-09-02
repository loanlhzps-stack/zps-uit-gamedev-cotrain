"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createCheckpointPackage } from "@/lib/actions/checkpoint";

export function CreatePackageForm({ programId }: { programId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await createCheckpointPackage(programId, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + Tạo result package mới
      </Button>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <input
        name="versionLabel"
        required
        autoFocus
        placeholder="Version label (ví dụ: v1 — Checkpoint 17/12)"
        className="h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo"}
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
        Huỷ
      </Button>
      {error && <p className="w-full text-[11px] font-medium text-risk">{error}</p>}
    </form>
  );
}
