import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProgramSettingsForm } from "@/components/settings/program-settings-form";
import { formatSessionDate } from "@/lib/format/schedule";

interface SessionOptionRow {
  id: string;
  session_date: string;
  session_blocks: { title: string; sort_order: number }[];
}

export default async function SettingsPage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  if (user.role !== "owner" && user.role !== "co_owner") {
    redirect("/app");
  }

  const supabase = await createClient();
  const [{ data: program }, { data: sessions }] = await Promise.all([
    supabase
      .from("programs")
      .select("name, starts_on, ends_on, checkpoint_session_id")
      .eq("id", user.programId)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("id, session_date, session_blocks(title, sort_order)")
      .eq("program_id", user.programId)
      .order("session_date", { ascending: true })
      .returns<SessionOptionRow[]>(),
  ]);

  const sessionOptions = (sessions ?? []).map((s) => ({
    id: s.id,
    label: `${formatSessionDate(s.session_date)} — ${
      [...s.session_blocks]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((b) => b.title)
        .join(" · ") || "Chưa có block"
    }`,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Program settings</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgramSettingsForm
            startsOn={program?.starts_on ?? ""}
            endsOn={program?.ends_on ?? ""}
            checkpointSessionId={program?.checkpoint_session_id ?? ""}
            sessionOptions={sessionOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
