-- Supabase Realtime 활성화를 위한 SQL
-- Supabase SQL Editor에서 실행해주세요

-- attendance_records 테이블에 Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;

-- attendance_reports 테이블에 Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_reports;

