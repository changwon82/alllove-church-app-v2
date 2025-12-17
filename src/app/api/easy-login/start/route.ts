import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getSmsProvider } from "@/lib/smsProvider";
import crypto from "crypto";

// Rate limiting을 위한 간단한 메모리 저장소 (프로덕션에서는 Redis 등 사용 권장)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }); // 1분
    return true;
  }

  if (limit.count >= 5) {
    // 분당 5회 제한
    return false;
  }

  limit.count++;
  return true;
}

/**
 * 어르신 간편로그인 - OTP 발송 시작
 * POST /api/easy-login/start
 * 
 * 요청:
 * {
 *   name: string,
 *   phoneLast4: string
 * }
 * 
 * 응답:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting 체크
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, phoneLast4 } = body;

    // 입력 검증
    if (!name || !name.trim() || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, message: "이름을 올바르게 입력해주세요." },
        { status: 400 }
      );
    }

    if (!phoneLast4 || !/^\d{4}$/.test(phoneLast4)) {
      return NextResponse.json(
        { success: false, message: "전화번호 뒤 4자리를 올바르게 입력해주세요." },
        { status: 400 }
      );
    }

    // 계정 열거 방지: 정확히 1명만 찾기
    // phone_last4 필드가 없을 수 있으므로 phone 필드에서 추출하여 비교
    const supabaseAdmin = getSupabaseAdmin();
    const { data: profiles, error: searchError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, easy_login_enabled, signup_method")
      .ilike("full_name", name.trim())
      .limit(10); // 최대 10개만 가져와서 서버에서 필터링

    if (searchError) {
      console.error("프로필 검색 에러:", searchError);
      return NextResponse.json(
        { success: false, message: "요청이 처리되었습니다." },
        { status: 200 } // 보안: 에러를 노출하지 않음
      );
    }

    // phone 필드에서 뒤 4자리 추출하여 필터링
    const matchingProfiles = (profiles || []).filter((p) => {
      if (!p.phone) return false;
      // phone 형식: "010-1234-5678" 또는 "01012345678"
      const cleaned = p.phone.replace(/[^0-9]/g, "");
      const last4 = cleaned.slice(-4);
      return last4 === phoneLast4;
    });

    // 계정 열거 방지: 정확히 1명이 아니면 진행하지 않음
    if (matchingProfiles.length !== 1) {
      // 동명이인 또는 일치하는 계정이 없음
      // 보안: 항상 동일한 응답 반환
      return NextResponse.json(
        { success: false, message: "요청이 처리되었습니다." },
        { status: 200 }
      );
    }

    const profile = matchingProfiles[0];

    // 간편로그인 허용 여부 확인
    const isEligible =
      profile.easy_login_enabled === true || profile.signup_method === "auto";

    if (!isEligible) {
      // 보안: 허용되지 않은 경우에도 동일한 응답
      return NextResponse.json(
        { success: false, message: "요청이 처리되었습니다." },
        { status: 200 }
      );
    }

    // OTP 생성 (6자리 숫자)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // OTP 해시 생성 (저장용)
    const otpHash = crypto
      .createHash("sha256")
      .update(otpCode + process.env.OTP_SECRET || "default-secret")
      .digest("hex");

    // OTP 만료 시간 (5분)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // otp_requests 테이블에 저장
    const { error: otpError } = await supabaseAdmin
      .from("otp_requests")
      .insert({
      phone: profile.phone,
      purpose: "easy_login",
      otp_hash: otpHash,
      expires_at: expiresAt,
      user_id: profile.id,
      ip: ip,
      user_agent: request.headers.get("user-agent") || "",
      attempts: 0,
      used: false,
    });

    if (otpError) {
      console.error("OTP 저장 에러:", otpError);
      return NextResponse.json(
        { success: false, message: "요청이 처리되었습니다." },
        { status: 200 }
      );
    }

    // SMS 발송
    try {
      const smsProvider = getSmsProvider();
      await smsProvider.sendOtp(profile.phone!, otpCode);
    } catch (smsError: any) {
      console.error("SMS 발송 에러:", smsError);
      // SMS 발송 실패해도 OTP는 저장되었으므로 계속 진행
      // 하지만 사용자에게는 실패 메시지 반환하지 않음 (보안)
    }

    // 보안: 성공/실패를 구분하지 않는 응답
    return NextResponse.json(
      { success: false, message: "요청이 처리되었습니다." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("간편로그인 시작 에러:", error);
    return NextResponse.json(
      { success: false, message: "요청이 처리되었습니다." },
      { status: 200 }
    );
  }
}
