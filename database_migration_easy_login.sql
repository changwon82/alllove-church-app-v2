-- 어르신 간편로그인 기능을 위한 데이터베이스 마이그레이션
-- 실행 전: Supabase Dashboard > SQL Editor에서 실행

-- 1. profiles 테이블에 필요한 컬럼 추가 (없는 경우만)
DO $$ 
BEGIN
  -- phone_last4 컬럼 추가 (없는 경우)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone_last4'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_last4 TEXT;
    COMMENT ON COLUMN profiles.phone_last4 IS '전화번호 뒤 4자리 (검색용)';
  END IF;

  -- easy_login_enabled 컬럼 추가 (없는 경우)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'easy_login_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN easy_login_enabled BOOLEAN DEFAULT false;
    COMMENT ON COLUMN profiles.easy_login_enabled IS '어르신 간편로그인 허용 여부';
  END IF;

  -- signup_method 컬럼 추가 (없는 경우)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'signup_method'
  ) THEN
    ALTER TABLE profiles ADD COLUMN signup_method TEXT;
    COMMENT ON COLUMN profiles.signup_method IS '회원가입 방법 (email, oauth, auto 등)';
  END IF;
END $$;

-- 2. phone_last4 자동 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_phone_last4()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    -- 전화번호에서 숫자만 추출하여 뒤 4자리 저장
    NEW.phone_last4 = RIGHT(REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g'), 4);
  ELSE
    NEW.phone_last4 = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. phone_last4 자동 업데이트 트리거 생성 (없는 경우만)
DROP TRIGGER IF EXISTS trigger_update_phone_last4 ON profiles;
CREATE TRIGGER trigger_update_phone_last4
  BEFORE INSERT OR UPDATE OF phone ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_phone_last4();

-- 4. 기존 데이터의 phone_last4 업데이트
UPDATE profiles
SET phone_last4 = RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 4)
WHERE phone IS NOT NULL AND phone_last4 IS NULL;

-- 5. otp_requests 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'easy_login',
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. otp_requests 테이블 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_otp_requests_user_id ON otp_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_requests_purpose ON otp_requests(purpose);
CREATE INDEX IF NOT EXISTS idx_otp_requests_expires_at ON otp_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_requests_created_at ON otp_requests(created_at);

-- 7. otp_requests 테이블 RLS 정책 설정
ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 사용자는 자신의 OTP 요청만 조회 가능 (필요한 경우)
-- 하지만 서버 사이드에서만 접근하므로 일반 사용자 접근 차단
DROP POLICY IF EXISTS "Users can view their own OTP requests" ON otp_requests;
CREATE POLICY "Users can view their own OTP requests"
  ON otp_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- 서버 사이드에서만 접근 가능하도록 기본 정책 설정
DROP POLICY IF EXISTS "Service role can manage OTP requests" ON otp_requests;
-- Service Role은 RLS를 우회하므로 별도 정책 불필요

-- 8. profiles 테이블 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_profiles_phone_last4 ON profiles(phone_last4);
CREATE INDEX IF NOT EXISTS idx_profiles_easy_login_enabled ON profiles(easy_login_enabled);
CREATE INDEX IF NOT EXISTS idx_profiles_signup_method ON profiles(signup_method);

-- 9. 만료된 OTP 자동 정리 함수 (선택사항)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_requests
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- 주기적으로 만료된 OTP 정리 (선택사항 - pg_cron 확장 필요)
-- SELECT cron.schedule('cleanup-expired-otps', '0 2 * * *', 'SELECT cleanup_expired_otps()');

COMMENT ON TABLE otp_requests IS 'OTP 요청 감사 로그 및 rate limit용 테이블';
COMMENT ON COLUMN otp_requests.otp_hash IS 'OTP 코드의 SHA256 해시값';
COMMENT ON COLUMN otp_requests.attempts IS 'OTP 검증 시도 횟수';
COMMENT ON COLUMN otp_requests.used IS 'OTP 사용 완료 여부';
