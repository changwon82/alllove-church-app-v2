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
    // Supabase Admin API를 사용하여 사용자 세션을 직접 생성합니다.
    // 이는 서버 사이드에서만 가능하며, Service Role Key가 필요합니다.
    
    // 사용자 정보 조회
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (userError || !authUser?.user?.email) {
      return NextResponse.json(
        { success: false, message: "인증에 실패했습니다." },
        { status: 200 }
      );
    }

    // Supabase Admin API로 사용자 세션 생성
    // generateLink를 사용하여 일회성 로그인 링크 생성
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?type=easy_login`,
      },
    });

    if (linkError || !linkData) {
      console.error("Magic Link 생성 에러:", linkError);
      // 대안: 임시 비밀번호 방식 사용
      const tempPassword = `temp_${code}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        password: tempPassword,
      });

      if (updateError) {
        console.error("임시 비밀번호 설정 에러:", updateError);
        return NextResponse.json(
          { success: false, message: "인증에 실패했습니다." },
          { status: 200 }
        );
      }

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
          tempPassword: tempPassword,
          method: "password", // 클라이언트에서 signInWithPassword 사용
        },
      });
    }

    // Magic Link 방식 성공
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
        magicLink: linkData.properties.action_link,
        method: "magiclink", // 클라이언트에서 링크로 리다이렉트
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
