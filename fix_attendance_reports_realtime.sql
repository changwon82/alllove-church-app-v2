-- attendance_reports 테이블에 REPLICA IDENTITY FULL 설정
-- DELETE 이벤트 시 전체 행 데이터가 payload.old에 포함되도록 설정
-- Supabase SQL Editor에서 실행해주세요

ALTER TABLE attendance_reports REPLICA IDENTITY FULL;

