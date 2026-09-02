import { ExternalLink, FileSpreadsheet, FileText } from "lucide-react";
import type { CheckpointPackage } from "@/lib/checkpoint/queries";

/**
 * Read-only rendering of a published result package — used both on
 * `/app/projects` for every non-Owner/Co-owner role and (a compact
 * variant) on Sponsor Home (section 9.2 — "Milestones and published
 * results").
 */
export function PublishedResultView({ pkg, compact = false }: { pkg: CheckpointPackage; compact?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-text-primary">{pkg.versionLabel}</span>
        {pkg.publishedAt && (
          <span className="text-[11.5px] text-text-secondary">
            Công bố bởi {pkg.publishedByName ?? "—"} · {new Date(pkg.publishedAt).toLocaleDateString("vi-VN")}
          </span>
        )}
      </div>

      {(pkg.groupsMeetingExpectations !== null || pkg.groupsNeedingImprovement !== null) && (
        <div className="grid grid-cols-2 gap-2.5">
          {pkg.groupsMeetingExpectations !== null && (
            <div className="rounded-lg border border-border bg-background p-2.5 text-center">
              <p className="text-lg font-extrabold text-success">{pkg.groupsMeetingExpectations}</p>
              <p className="text-[11px] text-text-secondary">Nhóm đạt kỳ vọng</p>
            </div>
          )}
          {pkg.groupsNeedingImprovement !== null && (
            <div className="rounded-lg border border-border bg-background p-2.5 text-center">
              <p className="text-lg font-extrabold text-warning">{pkg.groupsNeedingImprovement}</p>
              <p className="text-[11px] text-text-secondary">Nhóm cần cải thiện</p>
            </div>
          )}
        </div>
      )}

      {pkg.highlights && !compact && (
        <div>
          <p className="mb-1 text-[12px] font-semibold text-text-primary">Điểm nổi bật</p>
          <p className="whitespace-pre-wrap text-[13px] text-text-secondary">{pkg.highlights}</p>
        </div>
      )}

      {!compact && pkg.preExpoActions && (
        <div>
          <p className="mb-1 text-[12px] font-semibold text-text-primary">Việc cần làm trước Expo</p>
          <p className="whitespace-pre-wrap text-[13px] text-text-secondary">{pkg.preExpoActions}</p>
        </div>
      )}

      {!compact && pkg.notes && (
        <div>
          <p className="mb-1 text-[12px] font-semibold text-text-primary">Ghi chú</p>
          <p className="whitespace-pre-wrap text-[13px] text-text-secondary">{pkg.notes}</p>
        </div>
      )}

      {(pkg.excelFileUrl || pkg.pdfFileUrl || pkg.driveUrl) && (
        <div className="flex flex-wrap gap-3">
          {pkg.excelFileUrl && (
            <a
              href={pkg.excelFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-orange-3 hover:underline"
            >
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              File Excel
            </a>
          )}
          {pkg.pdfFileUrl && (
            <a
              href={pkg.pdfFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-orange-3 hover:underline"
            >
              <FileText className="size-4" aria-hidden="true" />
              File PDF
            </a>
          )}
          {pkg.driveUrl && (
            <a
              href={pkg.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-orange-3 hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Google Drive
            </a>
          )}
        </div>
      )}
    </div>
  );
}
