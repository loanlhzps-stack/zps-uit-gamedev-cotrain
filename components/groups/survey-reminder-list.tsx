import { ExternalLink } from "lucide-react";
import { formatSessionDate, formatSessionWeekday } from "@/lib/format/schedule";
import type { GroupScheduleRow } from "@/lib/groups/queries";

/**
 * Nhắc khảo sát buổi học, gắn thêm vào subtab "Bài tập cá nhân" (theo
 * yêu cầu của bạn) — link khảo sát vốn chỉ nằm ở tab "Thời khóa biểu",
 * dễ bị Sinh viên bỏ sót vì phải chủ động qua tab khác mới thấy. Hiện
 * lại đúng những buổi đã có link khảo sát (buổi `completed` + có
 * `survey_url`, cùng điều kiện với ScheduleList) ngay cạnh Bài tập cá
 * nhân để nhắc hiệu quả hơn — bấm vào mở thẳng link khảo sát, không
 * lưu trạng thái "đã làm" (app không track việc này, cũng như tab Thời
 * khóa biểu vẫn hiện lại mọi buổi đã hoàn thành, không tự ẩn khi đã
 * làm khảo sát). Không query thêm — dùng lại `scheduleRows` đã fetch
 * sẵn cho tab Thời khóa biểu.
 */
export function SurveyReminderList({ rows }: { rows: GroupScheduleRow[] }) {
  const withSurvey = rows.filter((r) => r.surveyUrl);
  if (withSurvey.length === 0) return null;

  return (
    <div className="border-t border-border pt-4">
      <h3 className="mb-2 text-[12.5px] font-semibold text-text-primary">Khảo sát buổi học</h3>
      <ul className="space-y-1.5">
        {withSurvey.map((r) => (
          <li key={r.sessionId}>
            <a
              href={r.surveyUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-orange-3 hover:underline"
            >
              {formatSessionWeekday(r.sessionDate)}, {formatSessionDate(r.sessionDate)} — Thực hiện khảo sát buổi học
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
