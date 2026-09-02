"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { openAttendanceSheet } from "@/lib/actions/attendance";

export function OpenSheetButton({ sessionId, groupId }: { sessionId: string; groupId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = await openAttendanceSheet(sessionId, groupId);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
      <Button size="sm" onClick={handleClick} disabled={pending}>
        {pending ? "Đang mở…" : "Mở điểm danh"}
      </Button>
      {error && <p className="mt-1.5 text-[11px] font-medium text-risk">{error}</p>}
    </div>
  );
}
