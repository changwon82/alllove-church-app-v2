import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
      is_default_image?: boolean;
    };
    email?: string;
  };
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type"); // easy_login 구분용

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.user && data?.session) {
      const userId = data.user.id;
      const userEmail = data.user.email;
      const providerToken = data.session.provider_token;
      // user.app_metadata에서 provider 확인
      const provider = data.user.app_metadata?.provider as string | undefined;

      // 카카오 사용자 정보 가져오기 API 호출 (카카오인 경우만)
      let kakaoProfile: KakaoUserInfo | null = null;
      if (provider === "kakao" && providerToken) {
        try {
          const kakaoResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${providerToken}`,
              "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            },
          });

          if (kakaoResponse.ok) {
            kakaoProfile = await kakaoResponse.json();
          } else {
            console.error("카카오 사용자 정보 가져오기 실패:", await kakaoResponse.text());
          }
        } catch (err) {
          console.error("카카오 API 호출 에러:", err);
        }
      }

      // 프로필이 이미 있는지 확인
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", userId)
        .maybeSingle();

      // OAuth Provider별 정보 추출
      let nickname: string | null = null;
      if (provider === "kakao") {
        nickname = kakaoProfile?.kakao_account?.profile?.nickname || null;
      } else if (provider === "google") {
        // 구글은 user_metadata에서 이름 가져오기
        nickname = data.user.user_metadata?.full_name || data.user.user_metadata?.name || null;
      }

      if (!existingProfile) {
        // 새 프로필 생성
        await supabase.from("profiles").insert({
          id: userId,
          email: userEmail,
          full_name: nickname,
          role: "member",
          approved: false,
          signup_method: "oauth",
        });
      } else {
        // 기존 프로필 업데이트
        const updateData: {
          email?: string;
          full_name?: string | null;
          signup_method?: string;
        } = { email: userEmail, signup_method: "oauth" };

        // 기존 full_name이 없으면 OAuth에서 가져온 이름으로 설정
        if (!existingProfile.full_name && nickname) {
          updateData.full_name = nickname;
        }

        await supabase.from("profiles").update(updateData).eq("id", userId);
      }
    }
  }

  // OAuth 성공 후 홈으로 리다이렉트
  // 간편로그인인 경우도 동일하게 처리
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
