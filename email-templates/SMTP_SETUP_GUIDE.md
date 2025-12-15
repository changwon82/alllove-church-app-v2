# SMTP 설정 가이드 - 다애공동체

## 개요
커스텀 SMTP를 설정하면 이메일 발신자를 "다애공동체" 또는 원하는 이름으로 변경할 수 있습니다.

## Supabase에서 SMTP 설정하기

### 1. Supabase 대시보드 접속
1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택

### 2. SMTP 설정 페이지 이동
1. 왼쪽 메뉴에서 **Project Settings** (⚙️ 아이콘) 클릭
2. **Auth** 메뉴 선택
3. **SMTP Settings** 섹션으로 스크롤

### 3. SMTP 정보 입력
1. **Enable Custom SMTP** 토글을 **ON**으로 변경
2. 다음 정보 입력:

```
SMTP Host: [이메일 서비스 제공자의 SMTP 서버]
SMTP Port: 587 (또는 465)
SMTP User: [SMTP 사용자명]
SMTP Password: [SMTP 비밀번호]
Sender Email: noreply@yourdomain.com
Sender Name: 다애공동체
```

### 4. 저장 및 테스트
1. **Save** 버튼 클릭
2. 테스트 이메일 발송하여 확인

## 이메일 서비스별 설정

### Gmail 사용하기

**장점:**
- 무료
- 설정 간단

**단점:**
- 일일 발송 제한 (약 500통)
- 개인 Gmail 계정 사용 시 제한적

**설정 방법:**
1. Gmail 계정에서 [2단계 인증](https://myaccount.google.com/security) 활성화
2. [앱 비밀번호](https://myaccount.google.com/apppasswords) 생성
3. Supabase SMTP 설정:
   ```
   Host: smtp.gmail.com
   Port: 587
   User: your-email@gmail.com
   Password: [생성한 앱 비밀번호]
   Sender Email: your-email@gmail.com
   Sender Name: 다애공동체
   ```

### SendGrid 사용하기

**장점:**
- 무료 플랜 제공 (월 100통)
- 전문적인 이메일 서비스
- 높은 발송 한도

**설정 방법:**
1. [SendGrid](https://sendgrid.com) 계정 생성
2. API 키 생성 (Settings → API Keys)
3. 도메인 인증 (선택사항, 권장)
4. Supabase SMTP 설정:
   ```
   Host: smtp.sendgrid.net
   Port: 587
   User: apikey
   Password: [생성한 API 키]
   Sender Email: noreply@yourdomain.com (또는 인증한 도메인)
   Sender Name: 다애공동체
   ```

### AWS SES 사용하기

**장점:**
- 저렴한 비용
- 높은 신뢰성
- 대량 발송 가능

**설정 방법:**
1. AWS 계정 생성
2. SES 서비스에서 SMTP 자격 증명 생성
3. 도메인 인증
4. Supabase SMTP 설정:
   ```
   Host: email-smtp.[region].amazonaws.com
   Port: 587
   User: [SMTP 사용자명]
   Password: [SMTP 비밀번호]
   Sender Email: noreply@yourdomain.com
   Sender Name: 다애공동체
   ```

### 기타 이메일 서비스

**Mailgun, Postmark, Resend** 등도 사용 가능합니다.
각 서비스의 SMTP 설정 문서를 참고하세요.

## 발신자 이름 커스터마이징

SMTP 설정에서 **Sender Name**을 다음과 같이 설정할 수 있습니다:

- `다애공동체`
- `AllLove Church Community`
- `다애공동체 AllLove Church`
- `[다애공동체]`

## 주의사항

1. **도메인 인증**: 자체 도메인 이메일을 사용하려면 도메인 인증이 필요합니다
2. **스팸 필터**: 처음 사용 시 스팸 폴더로 갈 수 있으니 확인하세요
3. **발송 한도**: 각 서비스의 일일/월간 발송 한도를 확인하세요
4. **비용**: 무료 플랜이 있지만, 대량 발송 시 유료 플랜이 필요할 수 있습니다

## 문제 해결

### 이메일이 발송되지 않는 경우
1. SMTP 설정 정보 확인 (Host, Port, User, Password)
2. 방화벽 설정 확인
3. 이메일 서비스 제공자의 로그 확인

### 이메일이 스팸으로 분류되는 경우
1. SPF, DKIM, DMARC 레코드 설정
2. 도메인 인증 완료
3. 발신자 이름과 이메일 주소 일관성 유지

### 테스트 이메일이 오지 않는 경우
1. Supabase 대시보드에서 테스트 이메일 발송
2. 스팸 폴더 확인
3. 이메일 서비스 제공자의 발송 로그 확인
