"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateProgramSettings, type ActionResult } from "@/lib/actions/program";

const initialState: ActionResult = {};

export function ProgramSettingsForm({
  startsOn,
  endsOn,
  checkpointSessionId,
  sessionOptions,
}: {
  startsOn: string;
  endsOn: string;
  checkpointSessionId: string;
  sessionOptions: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateProgramSettings, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="startsOn" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
            Ngày khai giảng
          </label>
          <input
            id="startsOn"
            name="startsOn"
            type="date"
            defaultValue={startsOn}
            required
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
          />
        </div>
        <div>
          <label htmlFor="endsOn" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
            Ngày tổng kết / Expo
          </label>
          <input
            id="endsOn"
            name="endsOn"
            type="date"
            defaultValue={endsOn}
            required
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="checkpointSessionId" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
          Buổi Checkpoint / Trình bày dự án
        </label>
        <select
          id="checkpointSessionId"
          name="checkpointSessionId"
          defaultValue={checkpointSessionId}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
        >
          <option value="">— Chưa chọn —</option>
          {sessionOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-[12px] font-medium text-success">
          {state.success}
        </p>
      )}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Đang lưu…" : "Lưu Program settings"}
      </Button>
    </form>
  );
}
