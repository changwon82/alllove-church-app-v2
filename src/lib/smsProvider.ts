/**
 * SMS Provider 인터페이스
 * 실제 SMS 공급자(알리고, Twilio 등)를 추상화하여 교체 가능하게 함
 */

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

/**
 * 알리고 SMS Provider 구현
 * 환경변수 SMS_PROVIDER가 'aligo'일 때 사용
 */
class AligoSmsProvider implements SmsProvider {
  private apiKey: string;
  private userId: string;
  private sender: string;

  constructor() {
    this.apiKey = process.env.SMS_ALIGO_API_KEY || "";
    this.userId = process.env.SMS_ALIGO_USER_ID || "";
    this.sender = process.env.SMS_ALIGO_SENDER || "";

    if (!this.apiKey || !this.userId || !this.sender) {
      console.warn("알리고 SMS 설정이 완전하지 않습니다. SMS 발송이 실패할 수 있습니다.");
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    // 알리고 API 호출
    // 실제 구현은 알리고 API 문서 참조
    const response = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        key: this.apiKey,
        user_id: this.userId,
        sender: this.sender,
        receiver: phone,
        msg: `[다애공동체] 인증번호는 ${code}입니다. 5분간 유효합니다.`,
      }),
    });

    const data = await response.json();
    if (data.result_code !== "1") {
      throw new Error(`SMS 발송 실패: ${data.message || "알 수 없는 오류"}`);
    }
  }
}

/**
 * Mock SMS Provider (개발/테스트용)
 * 환경변수 SMS_PROVIDER가 'mock'일 때 사용
 */
class MockSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    // 개발 환경에서는 콘솔에만 출력
    console.log(`[Mock SMS] ${phone}로 인증번호 ${code} 발송`);
    // 실제로는 SMS를 발송하지 않음
  }
}

/**
 * SMS Provider 팩토리
 * 환경변수에 따라 적절한 Provider 반환
 */
export function getSmsProvider(): SmsProvider {
  const provider = process.env.SMS_PROVIDER || "mock";

  switch (provider) {
    case "aligo":
      return new AligoSmsProvider();
    case "mock":
    default:
      return new MockSmsProvider();
  }
}
