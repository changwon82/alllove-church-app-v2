-- 출석관리 시스템을 위한 테이블 생성 SQL

-- 1. profiles 테이블에 출석체크 권한 컬럼 추가 (이미 있을 수 있으므로 IF NOT EXISTS 사용 불가 - 직접 실행 필요)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS attendance_permission BOOLEAN DEFAULT false;

-- Supabase SQL Editor에서 실행:
ALTER TABLE profiles ADD COLUMN attendance_permission BOOLEAN DEFAULT false;

-- 2. 출석체크 대상자 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender TEXT, -- '남' 또는 '여'
  birth_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 출석 기록 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES attendance_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  attended BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id, date)
);

-- 4. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_attendance_members_name ON attendance_members(name);
CREATE INDEX IF NOT EXISTS idx_attendance_records_member_id ON attendance_records(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_member_date ON attendance_records(member_id, date);

-- 5. RLS (Row Level Security) 정책 설정

-- attendance_members 테이블
ALTER TABLE attendance_members ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 출석체크 대상자 조회 가능 (권한이 있는 사람만 체크하도록 앱 레벨에서 제어)
CREATE POLICY "Users can view attendance members"
  ON attendance_members FOR SELECT
  USING (true);

-- 관리자 또는 출석체크 권한이 있는 사용자만 추가/수정/삭제 가능
CREATE POLICY "Admin or attendance permission users can insert attendance members"
  ON attendance_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.attendance_permission = true)
    )
  );

CREATE POLICY "Admin or attendance permission users can update attendance members"
  ON attendance_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.attendance_permission = true)
    )
  );

CREATE POLICY "Admin or attendance permission users can delete attendance members"
  ON attendance_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.attendance_permission = true)
    )
  );

-- attendance_records 테이블
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 출석 기록 조회 가능 (권한이 있는 사람만 체크하도록 앱 레벨에서 제어)
CREATE POLICY "Users can view attendance records"
  ON attendance_records FOR SELECT
  USING (true);

-- 관리자 또는 출석체크 권한이 있는 사용자만 추가/수정 가능
CREATE POLICY "Admin or attendance permission users can insert attendance records"
  ON attendance_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.attendance_permission = true)
    )
  );

CREATE POLICY "Admin or attendance permission users can update attendance records"
  ON attendance_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.attendance_permission = true)
    )
  );

CREATE POLICY "Admin or attendance permission users can delete attendance records"
  ON attendance_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.attendance_permission = true)
    )
  );

