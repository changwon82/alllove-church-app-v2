# 카카오톡 로그인 설정 가이드

## Supabase 대시보드에서 카카오 OAuth 설정

### 1. 카카오 개발자 콘솔 설정

1. [카카오 개발자 콘솔](https://developers.kakao.com/) 접속
2. 내 애플리케이션 → 애플리케이션 추가하기
3. 앱 이름 입력 후 저장

### 2. 카카오 앱 설정

1. **앱 키 확인**
   - 내 애플리케이션 → 앱 선택 → 앱 키
   - **REST API 키** 복사 (나중에 사용)

2. **플랫폼 설정**
   - 내 애플리케이션 → 앱 선택 → 플랫폼
   - Web 플랫폼 등록
   - 사이트 도메인 입력: `https://your-domain.vercel.app` (배포된 도메인)
   - Redirect URI 등록: `https://your-domain.vercel.app/auth/callback`

3. **카카오 로그인 활성화**
   - 내 애플리케이션 → 앱 선택 → 제품 설정 → 카카오 로그인
   - **활성화 설정: ON**
   - **Redirect URI 등록**: `https://your-domain.vercel.app/auth/callback`
   - **OpenID Connect 활성화**: ON (선택사항, 더 많은 정보를 받기 위해)

4. **동의항목 설정** (중요!)
   - 내 애플리케이션 → 앱 선택 → 제품 설정 → 카카오 로그인 → 동의항목
   - **반드시 활성화해야 하는 동의 항목:**
     - ✅ **닉네임** (profile_nickname) - 필수
     - ✅ **이메일** (account_email) - 선택이지만 Supabase가 요청할 수 있음
     - ✅ **프로필 사진** (profile_image) - 선택이지만 Supabase가 요청할 수 있음
   
   ⚠️ **중요**: 이 동의 항목들이 활성화되지 않으면 `KOE205` 에러가 발생합니다!
   
   각 동의 항목에서:
   - **필수 동의**: 체크 (사용자가 반드시 동의해야 함)
   - **선택 동의**: 체크 (사용자가 선택적으로 동의할 수 있음)
   - **동의 화면 노출**: 체크 (로그인 시 동의 화면에 표시)

### 3. Supabase 대시보드 설정

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택

3. **Authentication → Providers**
   - **Kakao** 찾기
   - **Enable Kakao provider** 토글 ON

4. **Kakao 설정 정보 입력**
   - **Kakao Client ID (REST API Key)**: 카카오 개발자 콘솔에서 복사한 REST API 키 입력
   - **Kakao Client Secret (없으면 비워두기)**: 카카오 로그인을 사용하는 경우 보통 필요 없음
   - **Redirect URL**: 자동으로 설정됨 (확인만 하면 됨)

5. **저장**

### 4. Redirect URLs 설정

1. Supabase 대시보드 → **Authentication → URL Configuration**
2. **Redirect URLs**에 다음 추가:
   ```
   https://your-domain.vercel.app/auth/callback
   http://localhost:3000/auth/callback (개발용)
   ```

### 5. 프로필 자동 생성 설정 (선택사항)

카카오 로그인 후 프로필이 자동으로 생성되도록 Supabase Database에서 트리거를 설정해야 합니다.

이미 `profiles` 테이블에 자동 생성 트리거가 있다면 추가 설정이 필요 없습니다.

트리거가 없다면 다음 SQL을 실행하세요:

```sql
-- 카카오 로그인 사용자 프로필 자동 생성 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '카카오 사용자'),
    'member',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거가 이미 있다면 이 부분은 건너뛰기
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 6. 테스트

1. 로그인 페이지에서 "카카오톡으로 시작하기" 버튼 클릭
2. 카카오 로그인 화면으로 이동
3. 카카오 계정으로 로그인
4. 홈으로 리다이렉트되며 로그인 완료

## 카카오 로그인 화면 다크모드 문제 해결

카카오 로그인 화면이 다크모드로 표시되는 경우:

### 방법 1: 카카오 개발자 콘솔에서 설정
1. [카카오 개발자 콘솔](https://developers.kakao.com/) 접속
2. 내 애플리케이션 → 앱 선택 → 제품 설정 → 카카오 로그인
3. **카카오 로그인 화면 설정**에서 테마를 "라이트"로 설정

### 방법 2: 코드에서 테마 지정 (이미 적용됨)
코드에서 `queryParams: { theme: "light" }`를 추가하여 라이트 모드를 강제할 수 있습니다.
이미 모든 카카오 로그인 버튼에 적용되어 있습니다.

### 방법 3: 브라우저 설정 확인
- 브라우저의 다크모드 설정이 카카오 로그인 페이지에 영향을 줄 수 있습니다
- 브라우저 설정에서 다크모드를 비활성화하거나, 카카오 로그인만 새 창에서 열리도록 설정

## 문제 해결

### KOE205 에러: 잘못된 요청 (동의 항목 미설정)

**에러 메시지:**
```
잘못된 요청 (KOE205)
설정하지 않은 카카오 로그인 동의 항목을 포함해 인가 코드를 요청했습니다.
설정하지 않은 동의 항목: account_email, profile_image, profile_nickname
```

**해결 방법:**
1. [카카오 개발자 콘솔](https://developers.kakao.com/) 접속
2. 내 애플리케이션 → 앱 선택 → 제품 설정 → 카카오 로그인 → 동의항목
3. 다음 동의 항목들을 **반드시 활성화**:
   - ✅ **닉네임** (profile_nickname)
   - ✅ **이메일** (account_email)
   - ✅ **프로필 사진** (profile_image)
4. 각 항목에서 "동의 화면 노출" 체크
5. 저장 후 다시 로그인 시도

### 카카오 로그인 버튼이 작동하지 않는 경우
- Supabase 대시보드에서 Kakao provider가 활성화되어 있는지 확인
- 카카오 개발자 콘솔에서 Redirect URI가 올바르게 설정되었는지 확인
- 브라우저 콘솔에서 에러 메시지 확인

### Redirect URI 오류
- 카카오 개발자 콘솔과 Supabase의 Redirect URL이 정확히 일치하는지 확인
- 도메인에 `http://` 또는 `https://`가 포함되어 있는지 확인
- 경로가 정확히 `/auth/callback`인지 확인

### 프로필이 생성되지 않는 경우
- Supabase Database에서 트리거가 설정되어 있는지 확인
- `profiles` 테이블의 RLS 정책이 올바른지 확인

## 참고사항

- 카카오 로그인은 이메일/비밀번호 로그인과 함께 사용할 수 있습니다
- 카카오 로그인 사용자는 이메일이 없을 수 있으므로, 프로필 생성 시 이를 고려해야 합니다
- 카카오에서 받은 정보(닉네임, 프로필 사진 등)는 `user_metadata`에 저장됩니다
