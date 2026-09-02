import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { getCheckpointPackagesForOwner, getPublishedCheckpointPackage } from "@/lib/checkpoint/queries";
import { CreatePackageForm } from "@/components/checkpoint/create-package-form";
import { PackageItem } from "@/components/checkpoint/package-item";
import { PublishedResultView } from "@/components/checkpoint/published-result-view";

export default async function ProjectsPage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;
  // Checkpoint tab hidden per PO request (2026) — feature not needed for now, code/data kept intact.
  redirect("/app");
  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-text-primary">Checkpoint 17/12 &amp; Kết quả</h2>
        <p className="text-[13px] text-text-secondary">
          Nhóm nộp bằng chứng dự án ở tab Final Project (Nhóm dự án); ở đây là bản tổng hợp kết quả cho toàn
          chương trình.
        </p>
      </div>

      {isOwnerOrCo ? (
        <OwnerView programId={user.programId} />
      ) : (
        <NonOwnerView programId={user.programId} />
      )}
    </div>
  );
}

async function OwnerView({ programId }: { programId: string }) {
  const packages = await getCheckpointPackagesForOwner(programId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Result package</CardTitle>
        <CardDescription>
          Tải lên và công bố là 2 bước riêng biệt. Thu hồi không xoá dữ liệu — vẫn giữ lại làm lịch sử.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {packages.length === 0 ? (
          <p className="text-[13px] text-text-secondary">Chưa có result package nào.</p>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <PackageItem key={pkg.id} programId={programId} pkg={pkg} />
            ))}
          </div>
        )}
        <CreatePackageForm programId={programId} />
      </CardContent>
    </Card>
  );
}

async function NonOwnerView({ programId }: { programId: string }) {
  const published = await getPublishedCheckpointPackage(programId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-orange-2/10 text-brand-orange-3">
            <Trophy className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>Kết quả Checkpoint</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {published ? (
          <PublishedResultView pkg={published} />
        ) : (
          <p className="text-[13px] text-text-secondary">Chương trình chưa công bố kết quả checkpoint.</p>
        )}
      </CardContent>
    </Card>
  );
}
