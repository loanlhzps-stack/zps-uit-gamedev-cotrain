-- VNG-ZPSxUIT-GameDev CoTrain — drop session start_time/end_time (section 10)
--
-- Lịch học thật cố định vào buổi chiều mỗi ngày (không có buổi sáng/tối
-- xen kẽ) — chương trình chỉ cần theo dõi theo BUỔI (ngày), không cần
-- lưu giờ bắt đầu/kết thúc từng buổi. Loại bỏ để tránh dữ liệu chết và
-- một trường nhập liệu không ai dùng tới.

alter table public.sessions
  drop column start_time,
  drop column end_time;
