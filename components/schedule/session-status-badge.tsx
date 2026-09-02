import { Badge } from "@/components/ui/badge";
import type { SessionStatusDisplay } from "@/lib/format/schedule";

/**
 * Nhận sẵn `display` (nhãn + màu đã tính, có thể là "Sắp tới"/"Đang
 * học" tự tính theo ngày) thay vì tự suy ra từ `status` — xem
 * `getSessionStatusDisplay` (lib/format/schedule.ts) ở nơi gọi.
 */
export function SessionStatusBadge({ display }: { display: SessionStatusDisplay }) {
  return <Badge variant={display.variant}>{display.label}</Badge>;
}
