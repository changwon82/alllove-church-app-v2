# 발신자 이름 "Supabase Auth" 변경하기

## 문제
Supabase 기본 이메일을 사용하면 발신자 이름이 "Supabase Auth"로 고정되어 표시됩니다.

## 해결 방법: 커스텀 SMTP 설정

### 1. Supabase 대시보드 접속
1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택

### 2. SMTP 설정 페이지로 이동
1. 왼쪽 메뉴에서 **Project Settings** (⚙️ 아이콘) 클릭
2. **Auth** 메뉴 선택
3. **SMTP Settings** 섹션으로 스크롤

### 3. 커스텀 SMTP 활성화
1. **Enable Custom SMTP** 토글을 **ON**으로 변경
2. 다음 정보 입력:

```
SMTP Host: [이메일 서비스의 SMTP 서버]
SMTP Port: 587
SMTP User: [SMTP 사용자명]
SMTP Password: [SMTP 비밀번호]
Sender Email: [발신자 이메일 주소]
Sender Name: 다애공동체  ← 여기가 중요!
```

### 4. 빠른 설정: Gmail 사용하기

가장 간단한 방법은 Gmail을 사용하는 것입니다:

1. **Gmail 계정 준비**
   - Gmail 계정이 필요합니다
   - [2단계 인증](https://myaccount.google.com/security) 활성화 필수

2. **앱 비밀번호 생성**
   - [앱 비밀번호 페이지](https://myaccount.google.com/apppasswords) 접속
   - "앱 선택" → "기타(맞춤 이름)" → "Supabase" 입력
   - "생성" 클릭
   - 생성된 16자리 비밀번호 복사 (예: `abcd efgh ijkl mnop`)

3. **Supabase에 입력**
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: your-email@gmail.com
   SMTP Password: abcd efgh ijkl mnop (생성한 앱 비밀번호)
   Sender Email: your-email@gmail.com
   Sender Name: 다애공동체
   ```

4. **저장 및 테스트**
   - **Save** 버튼 클릭
   - 비밀번호 찾기 기능으로 테스트 이메일 발송
   - 받은 이메일에서 발신자가 "다애공동체"로 표시되는지 확인

### 5. 다른 이메일 서비스 사용하기

**SendGrid (무료 플랜: 월 100통)**
```
Host: smtp.sendgrid.net
Port: 587
User: apikey
Password: [SendGrid API 키]
Sender Email: noreply@yourdomain.com
Sender Name: 다애공동체
```

**AWS SES**
```
Host: email-smtp.[region].amazonaws.com
Port: 587
User: [AWS SMTP 사용자명]
Password: [AWS SMTP 비밀번호]
Sender Email: noreply@yourdomain.com
Sender Name: 다애공동체
```

## 설정 후 확인사항

1. ✅ 이메일 발송 테스트
2. ✅ 발신자 이름이 "다애공동체"로 표시되는지 확인
3. ✅ 스팸 폴더 확인 (처음 사용 시 스팸으로 분류될 수 있음)

## 주의사항

- Gmail 사용 시 일일 발송 제한: 약 500통
- 처음 설정한 이메일은 스팸 폴더로 갈 수 있으니 확인하세요
- 자체 도메인 이메일을 사용하려면 도메인 인증이 필요합니다

## 문제 해결

**이메일이 발송되지 않는 경우:**
- SMTP 설정 정보 재확인
- Gmail 앱 비밀번호가 올바른지 확인
- 방화벽 설정 확인

**발신자 이름이 여전히 "Supabase Auth"로 표시되는 경우:**
- SMTP 설정이 올바르게 저장되었는지 확인
- 이메일 클라이언트 캐시 삭제 후 재확인
- Supabase 대시보드에서 테스트 이메일 발송
