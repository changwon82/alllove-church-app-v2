-- attendance_reports 테이블의 RLS 정책 수정
-- 모든 인증된 사용자가 보고완료를 저장할 수 있도록 허용

-- 기존 정책 확인 및 삭제 (필요시)
-- DROP POLICY IF EXISTS "Users can insert attendance reports" ON attendance_reports;
-- DROP POLICY IF EXISTS "Users can update attendance reports" ON attendance_reports;
-- DROP POLICY IF EXISTS "Users can delete attendance reports" ON attendance_reports;
-- DROP POLICY IF EXISTS "Users can view attendance reports" ON attendance_reports;

-- RLS 활성화 확인
ALTER TABLE attendance_reports ENABLE ROW LEVEL SECURITY;

-- INSERT 정책: 인증된 사용자는 자신의 부서에 대해 보고완료를 저장할 수 있음
CREATE POLICY "Authenticated users can insert attendance reports"
ON attendance_reports
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE 정책: 인증된 사용자는 보고완료를 업데이트할 수 있음
CREATE POLICY "Authenticated users can update attendance reports"
ON attendance_reports
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE 정책: 인증된 사용자는 보고완료를 삭제할 수 있음
CREATE POLICY "Authenticated users can delete attendance reports"
ON attendance_reports
FOR DELETE
TO authenticated
USING (true);

-- SELECT 정책: 인증된 사용자는 모든 보고완료를 조회할 수 있음
CREATE POLICY "Authenticated users can view attendance reports"
ON attendance_reports
FOR SELECT
TO authenticated
USING (true);
