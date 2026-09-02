import { FlaskConical } from "lucide-react";

// Design Doc section 1: sample records must be clearly marked in development.
export function SampleDataNote({ className }: { className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-[11px] font-medium text-text-secondary ${className ?? ""}`}>
      <FlaskConical className="size-3.5 text-warning" aria-hidden="true" />
      Dữ liệu mẫu minh hoạ.
    </p>
  );
}
