-- attendance_members 테이블에 is_active 필드 추가
-- 비활성화된 멤버를 완전 삭제하지 않고 보관하기 위한 필드

ALTER TABLE attendance_members 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 기존 모든 멤버는 활성화 상태로 설정
UPDATE attendance_members 
SET is_active = TRUE 
WHERE is_active IS NULL;
