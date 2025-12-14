-- 출석 보고완료 테이블 생성 SQL

-- 1. 출석 보고완료 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  sunday_date DATE NOT NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(department, sunday_date)
);

-- 2. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_attendance_reports_department ON attendance_reports(department);
CREATE INDEX IF NOT EXISTS idx_attendance_reports_sunday_date ON attendance_reports(sunday_date);
CREATE INDEX IF NOT EXISTS idx_attendance_reports_dept_date ON attendance_reports(department, sunday_date);

-- 3. RLS (Row Level Security) 정책 설정
ALTER TABLE attendance_reports ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 출석 보고 조회 가능
CREATE POLICY "Users can view attendance reports"
  ON attendance_reports FOR SELECT
  USING (true);

-- 관리자 또는 출석체크 권한이 있는 사용자만 추가 가능
CREATE POLICY "Admin or attendance permission users can insert attendance reports"
  ON attendance_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.attendance_permission = true)
    )
  );

-- 관리자만 수정/삭제 가능 (보고완료는 수정 불가하므로 삭제만 가능)
CREATE POLICY "Admin can delete attendance reports"
  ON attendance_reports FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

