BEGIN;

-- CẢNH BÁO MẤT DỮ LIỆU: 
-- Khi chạy lệnh DROP COLUMN, toàn bộ dữ liệu ghi chú (note) mà người dùng 
-- đã nhập vào cột này trước đó sẽ BỊ XÓA VĨNH VIỄN. 
-- Tuy nhiên, các cột dữ liệu gốc khác (student_id, event_type...) vẫn còn nguyên.
ALTER TABLE enrollment_events 
DROP COLUMN IF EXISTS note;

-- Xóa lịch sử phiên bản
DELETE FROM schema_migrations WHERE version = '002';

COMMIT;