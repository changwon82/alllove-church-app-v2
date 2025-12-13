-- profiles 테이블 RLS 정책 및 트리거 설정

-- 1. profiles 테이블이 없는 경우 생성 (기본 구조)
-- CREATE TABLE IF NOT EXISTS profiles (
--   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   email TEXT,
--   full_name TEXT,
--   role TEXT DEFAULT 'member',
--   position TEXT,
--   department TEXT,
--   phone TEXT,
--   birth DATE,
--   gender TEXT,
--   approved BOOLEAN DEFAULT false,
--   attendance_permission BOOLEAN DEFAULT false,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- 2. RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. 사용자가 자신의 프로필을 생성할 수 있는 정책
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. 사용자가 자신의 프로필을 조회할 수 있는 정책
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 5. 사용자가 자신의 프로필을 수정할 수 있는 정책
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. 모든 사용자가 다른 사용자의 프로필을 조회할 수 있는 정책 (댓글 표시용)
DROP POLICY IF EXISTS "Users can view all profiles for comments" ON profiles;
CREATE POLICY "Users can view all profiles for comments"
  ON profiles FOR SELECT
  USING (true);

-- 7. (선택사항) auth.users에 사용자가 생성될 때 자동으로 profiles 레코드를 생성하는 트리거
-- 이 방법을 사용하면 클라이언트에서 직접 insert할 필요가 없습니다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'member',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성 (이미 존재하면 제거 후 재생성)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

