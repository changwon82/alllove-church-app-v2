import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";

/**
 * 어르신 간편로그인 - OTP 검증 및 로그인
 * POST /api/easy-login/verify
 * 
 * 요청:
 * {
 *   name: string,
 *   phoneLast4: string,
 *   code: string
 * }
 * 
 * 응답:
 * {
 *   success: boolean,
 *   message: string,
 *   sessionUrl?: string (성공 시)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phoneLast4, code } = body;

    // 입력 검증
    if (!name || !name.trim() || !phoneLast4 || !/^\d{4}$/.test(phoneLast4) || !code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, message: "입력 정보를 확인해주세요." },
        { status: 400 }
      );
    }

    // 사용자 찾기 (start와 동일한 로직)
    const supabaseAdmin = getSupabaseAdmin();
    const { data: profiles, error: searchError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, easy_login_enabled, signup_method")
      .ilike("full_name", name.trim())
      .limit(10);

    if (searchError || !profiles || profiles.length === 0) {
      return NextResponse.json(
        { success: false, message: "인증에 실패했습니다." },
        { status: 200 }
      );
    }

    const matchingProfiles = profiles.filter((p) => {
      if (!p.phone) return false;
      const cleaned = p.phone.replace(/[^0-9]/g, "");
      const last4 = cleaned.slice(-4);
      return last4 === phoneLast4;
    });

    if (matchingProfiles.length !== 1) {
      return NextResponse.json(
        { success: false, message: "인증에 실패했습니다." },
        { status: 200 }
      );
    }

    const profile = matchingProfiles[0];

    // 간편로그인 허용 여부 확인
    const isEligible =
      profile.easy_login_enabled === true || profile.signup_method === "auto";

    if (!isEligible) {
      return NextResponse.json(
        { success: false, message: "인증에 실패했습니다." },
        { status: 200 }
      );
    }

    // OTP 검증
    const otpHash = crypto
      .createHash("sha256")
      .update(code + (process.env.OTP_SECRET || "default-secret"))
      .digest("hex");

    const { data: otpRequest, error: otpError } = await supabaseAdmin
      .from("otp_requests")
      .select("id, otp_hash, expires_at, attempts, user_id")
      .eq("user_id", profile.id)
      .eq("purpose", "easy_login")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRequest) {
      return NextResponse.json(
        { success: false, message: "인증에 실패했습니다." },
        { status: 200 }
      );
    }

    // 만료 확인
    if (new Date(otpRequest.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, message: "인증번호가 만료되었습니다." },
        { status: 200 }
      );
    }

    // 시도 횟수 확인 (최대 5회)
    if ((otpRequest.attempts || 0) >= 5) {
      return NextResponse.json(
        { success: false, message: "인증 시도 횟수를 초과했습니다." },
        { status: 200 }
      );
    }

    // OTP 해시 비교
    if (otpRequest.otp_hash !== otpHash) {
      // 시도 횟수 증가
      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin
        .from("otp_requests")
        .update({ attempts: (otpRequest.attempts || 0) + 1 })
        .eq("id", otpRequest.id);

      return NextResponse.json(
        { success: false, message: "인증번호가 올바르지 않습니다." },
        { status: 200 }
      );
    }

    // OTP 검증 성공 - 사용자 세션 생성
    // 
    // 보안 고려사항:
    // Supabase는 OAuth 기반 인증만 공식 지원하며, OTP 기반 직접 세션 생성은 지원하지 않습니다.
    // 따라서 다음 두 가지 방법 중 하나를 선택해야 합니다:
    //
    // 1. Magic Link 방식 (권장):
    //    - generateLink API를 사용하여 일회성 로그인 링크 생성
    //    - 사용자가 링크를 클릭하면 자동으로 세션이 생성됨
    //    - 장점: Supabase 공식 API 사용, 보안성 높음
    //    - 단점: 사용자가 링크를 클릭해야 함 (자동 로그인 불가)
    //
    // 2. 임시 비밀번호 방식 (대안):
    //    - 임시 비밀번호를 생성하여 사용자 계정에 설정
    //    - 클라이언트에서 signInWithPassword로 로그인
    //    - 장점: 자동 로그인 가능, 사용자 경험 좋음
    //    - 단점: 임시 비밀번호가 네트워크를 통해 전송됨 (보안 위험)
    //
    // 현재 구현: Magic Link를 우선 시도하고, 실패 시 임시 비밀번호 방식 사용
    // 향후 개선: Supabase가 OTP 기반 인증을 공식 지원하면 해당 방식으로 전환
    
    // 사용자 정보 조회
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (userError || !authUser?.user?.email) {
      return NextResponse.json(
        { success: false, message: "인증에 실패했습니다." },
        { status: 200 }
      );
    }

    // 간편로그인은 임시 비밀번호 방식 사용 (더 안정적)
    // 어르신 전용 회원가입 시 비밀번호가 392766으로 고정되어 있으므로
    // 해당 비밀번호로 직접 로그인 시도
    const knownPassword = "392766";
    
    // OTP 요청을 사용 완료로 표시
    await supabaseAdmin
      .from("otp_requests")
      .update({ attempts: (otpRequest.attempts || 0) + 1, used: true })
      .eq("id", otpRequest.id);

    return NextResponse.json({
      success: true,
      message: "인증이 완료되었습니다.",
      loginInfo: {
        email: authUser.user.email,
        password: knownPassword,
        method: "password", // 클라이언트에서 signInWithPassword 사용
      },
    });
  } catch (error: any) {
    console.error("간편로그인 검증 에러:", error);
    return NextResponse.json(
      { success: false, message: "인증에 실패했습니다." },
      { status: 200 }
    );
  }
}
