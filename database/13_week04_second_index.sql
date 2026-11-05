-- GIẢI THÍCH THỨ TỰ CỘT INDEX:
-- Theo nguyên tắc thiết kế chỉ mục (Index), các cột sử dụng toán tử so sánh bằng (=) 
-- cần được đặt lên trước để PostgreSQL thu hẹp phạm vi tìm kiếm nhanh nhất. 
-- Các cột dùng để lọc khoảng (>=) hoặc sắp xếp (ORDER BY) sẽ đặt ở phía sau.
-- Do đó, thứ tự là: class_section_id (=), event_type (=), occurred_at (>= và DESC).

CREATE INDEX idx_enrollment_events_class_type_time
ON enrollment_events (class_section_id, event_type, occurred_at DESC);

ANALYZE enrollment_events;