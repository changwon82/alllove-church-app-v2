import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";

/**
 * 어르신 전용 회원가입 API
 * POST /api/elder-signup
 * 
 * 요청:
 * {
 *   name: string,
 *   phone: string
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
    const body = await request.json();
    const { name, phone } = body;

    // 입력 검증
    if (!name || !name.trim() || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, message: "이름을 올바르게 입력해주세요." },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, message: "전화번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 전화번호 형식 정리 및 검증
    const cleanedPhone = phone.replace(/[^0-9]/g, "");
    
    // 전화번호 길이 검증 (010으로 시작하는 11자리 또는 기타 10자리 이상)
    if (cleanedPhone.length < 10 || (cleanedPhone.startsWith("010") && cleanedPhone.length !== 11)) {
      return NextResponse.json(
        { success: false, message: "전화번호를 올바르게 입력해주세요. (예: 010-1234-5678)" },
        { status: 400 }
      );
    }

    // 전화번호 형식 변환 (01012345678 -> 010-1234-5678)
    let formattedPhone = phone; // 이미 하이픈이 포함되어 있을 수 있음
    
    // 하이픈이 없으면 추가
    if (!formattedPhone.includes("-")) {
      if (cleanedPhone.length === 11 && cleanedPhone.startsWith("010")) {
        formattedPhone = `${cleanedPhone.slice(0, 3)}-${cleanedPhone.slice(3, 7)}-${cleanedPhone.slice(7)}`;
      } else if (cleanedPhone.length === 10) {
        // 지역번호가 2자리인 경우 (02-1234-5678)
        formattedPhone = `${cleanedPhone.slice(0, 2)}-${cleanedPhone.slice(2, 6)}-${cleanedPhone.slice(6)}`;
      }
    }
    
    // 최종 검증: 하이픈 포함 형식 확인
    if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(formattedPhone)) {
      return NextResponse.json(
        { success: false, message: "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 중복 전화번호 확인
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .or(`phone.eq.${formattedPhone},phone.eq.${cleanedPhone}`)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { 
          success: false, 
          message: `이미 가입된 전화번호입니다.\n\n이 전화번호로 가입된 계정이 있습니다.\n간편로그인을 사용하여 로그인해주세요.` 
        },
        { status: 400 }
      );
    }

    // 이메일 자동 생성 (alllove1@church.com, alllove2@church.com ...)
    // profiles 테이블에서 가장 큰 번호를 찾아서 +1
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .like("email", "alllove%@church.com")
      .order("email", { ascending: false })
      .limit(100);

    let emailNumber = 1;
    
    if (existingProfiles && existingProfiles.length > 0) {
      // 기존 이메일에서 가장 큰 번호 추출
      const emailNumbers = existingProfiles
        .map((p) => {
          const match = p.email?.match(/alllove(\d+)@church\.com/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => !isNaN(n) && n > 0);
      
      if (emailNumbers.length > 0) {
        emailNumber = Math.max(...emailNumbers) + 1;
      }
    }

    let newEmail = `alllove${emailNumber}@church.com`;
    
    // 생성된 이메일이 실제로 사용 가능한지 최종 확인
    const { data: finalCheck } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", newEmail)
      .maybeSingle();

    // 만약 중복이면 다음 번호로
    if (finalCheck) {
      emailNumber++;
      newEmail = `alllove${emailNumber}@church.com`;
    }

    // 임시 비밀번호 생성 (고정값: 392766)
    const tempPassword = "392766";

    // Supabase Auth에 사용자 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: newEmail,
      password: tempPassword,
      email_confirm: true, // 이메일 인증 없이 바로 사용 가능
      user_metadata: {
        full_name: name.trim(),
      },
    });

    if (authError) {
      console.error("사용자 생성 에러 상세:", {
        message: authError.message,
        status: authError.status,
        name: authError.name,
      });
      return NextResponse.json(
        { 
          success: false, 
          message: `회원가입에 실패했습니다: ${authError.message || "알 수 없는 오류"}` 
        },
        { status: 500 }
      );
    }

    if (!authData || !authData.user) {
      console.error("사용자 생성 실패: authData가 없음");
      return NextResponse.json(
        { success: false, message: "사용자 생성에 실패했습니다. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 프로필이 이미 존재하는지 확인 (트리거로 자동 생성되었을 수 있음)
    // 잠시 대기하여 트리거가 실행될 시간을 줌
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const { data: existingProfileCheck } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle();

    const profileData = {
      id: authData.user.id,
      email: newEmail,
      full_name: name.trim(),
      phone: formattedPhone, // 하이픈 포함 형식으로 저장
      role: "member",
      approved: false,
      easy_login_enabled: true, // 간편로그인 자동 활성화
      signup_method: "auto", // 자동 생성 계정 표시
    };

    console.log("프로필 데이터:", { ...profileData, phone: formattedPhone, exists: !!existingProfileCheck });

    let savedProfile;
    
    if (existingProfileCheck) {
      // 이미 프로필이 존재하면 업데이트
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          email: newEmail,
          full_name: name.trim(),
          phone: formattedPhone,
          easy_login_enabled: true,
          signup_method: "auto",
        })
        .eq("id", authData.user.id)
        .select()
        .single();

      if (updateError) {
        console.error("프로필 업데이트 에러 상세:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
        return NextResponse.json(
          { 
            success: false, 
            message: `프로필 업데이트 중 오류가 발생했습니다: ${updateError.message || "알 수 없는 오류"}` 
          },
          { status: 500 }
        );
      }
      savedProfile = updatedProfile;
      console.log("프로필 업데이트 성공:", savedProfile);
    } else {
      // 프로필이 없으면 생성
      const { data: insertedProfile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert(profileData)
        .select()
        .single();

      if (profileError) {
        console.error("프로필 생성 에러 상세:", {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        });
        // 사용자는 생성되었지만 프로필 생성 실패 시 사용자 삭제
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          console.error("사용자 삭제 실패:", deleteError);
        }
        return NextResponse.json(
          { 
            success: false, 
            message: `프로필 저장 중 오류가 발생했습니다: ${profileError.message || "알 수 없는 오류"}` 
          },
          { status: 500 }
        );
      }
      savedProfile = insertedProfile;
      console.log("프로필 생성 성공:", savedProfile);
    }

    return NextResponse.json({
      success: true,
      message: "회원가입이 완료되었습니다.",
    });
  } catch (error: any) {
    console.error("어르신 회원가입 에러:", error);
    return NextResponse.json(
      { success: false, message: "회원가입 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
