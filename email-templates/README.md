# 다애공동체 이메일 템플릿

## 비밀번호 재설정 이메일 설정 방법

### 1. Supabase 대시보드 접속
1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택

### 2. 이메일 템플릿 설정
1. 왼쪽 메뉴에서 **Authentication** 클릭
2. **Email Templates** 메뉴 선택
3. **Reset Password** 템플릿 선택

### 3. 템플릿 적용
1. `password-reset-email.html` 파일의 내용을 복사
2. Supabase의 **Reset Password** 템플릿 편집기에 붙여넣기
3. **Subject** 필드에 다음 내용 입력:
   ```
   [다애공동체] 비밀번호 재설정 안내
   ```

### 4. 사용 가능한 변수
Supabase에서 제공하는 변수:
- `{{ .ConfirmationURL }}` - 비밀번호 재설정 링크
- `{{ .SiteURL }}` - 사이트 URL (로고 이미지 경로에 사용)
- `{{ .Email }}` - 사용자 이메일 주소

### 5. 로고 이미지 설정
로고가 제대로 표시되려면:

**방법 1: 절대 URL 사용 (권장)**
- 배포된 사이트의 로고 URL 사용: `https://your-domain.com/alllove-logo.png`
- 또는 Supabase Storage에 로고를 업로드하고 공개 URL 사용

**방법 2: 이모지 사용 (호환성 최고)**
- `password-reset-email-simple.html` 파일 사용
- 로고 대신 ❤️ 이모지 사용 (모든 이메일 클라이언트에서 표시됨)

**방법 3: Base64 인코딩**
- 로고 이미지를 Base64로 인코딩하여 인라인으로 삽입
- 이메일 크기가 커질 수 있음

### 6. 발신자(보내는 사람) 변경

#### 방법 1: 기본 Supabase 이메일 사용 (간단)
기본 Supabase 이메일을 사용하는 경우, 발신자 이름만 변경 가능합니다:
1. Supabase 대시보드 → **Authentication** → **Email Templates**
2. 각 템플릿에서 **From Name** 필드 수정
   - 예: `다애공동체` 또는 `AllLove Church Community`
3. **From Email**은 Supabase 기본 이메일로 고정됨 (변경 불가)

#### 방법 2: 커스텀 SMTP 사용 (권장 - 완전한 커스터마이징)
자신의 이메일 도메인으로 발송하려면 커스텀 SMTP를 설정해야 합니다:

1. **SMTP 설정**
   - Supabase 대시보드 → **Project Settings** → **Auth** → **SMTP Settings**
   - **Enable Custom SMTP** 활성화
   - 다음 정보 입력:
     - **SMTP Host**: 이메일 서비스 제공자의 SMTP 서버 (예: `smtp.gmail.com`, `smtp.sendgrid.net`)
     - **SMTP Port**: 보통 `587` (TLS) 또는 `465` (SSL)
     - **SMTP User**: SMTP 사용자명 (보통 이메일 주소)
     - **SMTP Password**: SMTP 비밀번호 또는 앱 비밀번호
     - **Sender Email**: 발신자 이메일 주소 (예: `noreply@alllove-church.com`)
     - **Sender Name**: 발신자 이름 (예: `다애공동체`)

2. **인기 이메일 서비스 설정 예시**

   **Gmail 사용 시:**
   - Host: `smtp.gmail.com`
   - Port: `587`
   - User: Gmail 주소
   - Password: [앱 비밀번호](https://myaccount.google.com/apppasswords) (2단계 인증 필요)

   **SendGrid 사용 시:**
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - User: `apikey`
   - Password: SendGrid API 키

   **AWS SES 사용 시:**
   - Host: `email-smtp.[region].amazonaws.com`
   - Port: `587`
   - User: AWS SMTP 사용자명
   - Password: AWS SMTP 비밀번호

3. **테스트**
   - SMTP 설정 후 테스트 이메일 발송
   - 받은 이메일에서 발신자 확인

### 7. 테스트
1. 비밀번호 찾기 페이지에서 이메일 입력
2. 받은 이메일 확인
3. 디자인과 링크가 정상 작동하는지 확인
4. 발신자 이름과 이메일 주소 확인

## 추가 커스터마이징

### 색상 변경
템플릿에서 다음 색상 코드를 변경하여 브랜드에 맞게 조정:
- `#3b82f6` - 메인 블루 (버튼, 헤더 배경)
- `#2563eb` - 다크 블루 (그라데이션)
- `#1f2937` - 다크 그레이 (텍스트)
- `#6b7280` - 라이트 그레이 (보조 텍스트)

### 폰트 변경
`font-family` 속성을 변경하여 원하는 폰트 적용

### 문구 수정
템플릿 내의 한글 문구를 원하는 대로 수정 가능
