import { Badge } from "@/components/ui/badge";

export type SheetStatus = "missing" | "open" | "submitted" | "locked" | "reopened";

const LABEL: Record<SheetStatus, string> = {
  missing: "Chưa mở",
  open: "Đang mở",
  submitted: "Đã nộp",
  locked: "Đã khoá",
  reopened: "Đã mở lại",
};

const VARIANT: Record<SheetStatus, "neutral" | "success" | "warning" | "risk"> = {
  missing: "neutral",
  open: "warning",
  submitted: "success",
  locked: "success",
  reopened: "warning",
};

export function SheetStatusBadge({ status }: { status: SheetStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
