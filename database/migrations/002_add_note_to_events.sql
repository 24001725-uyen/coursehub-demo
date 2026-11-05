BEGIN;

-- Thêm cột note vào bảng hiện tại
ALTER TABLE enrollment_events 
ADD COLUMN IF NOT EXISTS note VARCHAR(200);

-- Ghi nhận lịch sử áp dụng migration
INSERT INTO schema_migrations (version, description)
VALUES ('002', 'Add note column to enrollment_events');

COMMIT;