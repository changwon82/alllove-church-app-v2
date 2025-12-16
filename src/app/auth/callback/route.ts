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

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.user && data?.session) {
      const userId = data.user.id;
      const userEmail = data.user.email;
      const providerToken = data.session.provider_token;

      // 카카오 사용자 정보 가져오기 API 호출
      let kakaoProfile: KakaoUserInfo | null = null;
      if (providerToken) {
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
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      // kakao_account.profile에서 정보 추출
      const nickname = kakaoProfile?.kakao_account?.profile?.nickname || null;
      const profileImageUrl = kakaoProfile?.kakao_account?.profile?.profile_image_url || null;
      const thumbnailImageUrl = kakaoProfile?.kakao_account?.profile?.thumbnail_image_url || null;

      if (!existingProfile) {
        // 새 프로필 생성 (kakao_account.profile 정보 사용)
        await supabase.from("profiles").insert({
          id: userId,
          email: userEmail,
          full_name: nickname, // kakao_account.profile.nickname 사용
          role: "member",
          approved: false,
          // 프로필 이미지는 필요시 별도 필드에 저장 가능
          // avatar_url: profileImageUrl,
        });
      } else {
        // 기존 프로필 업데이트
        // full_name이 없을 때만 카카오 닉네임으로 업데이트
        const updateData: {
          email?: string;
          full_name?: string | null;
        } = { email: userEmail };

        // 기존 full_name이 없으면 카카오 닉네임으로 설정
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();

        if (!currentProfile?.full_name && nickname) {
          updateData.full_name = nickname;
        }

        await supabase.from("profiles").update(updateData).eq("id", userId);
      }
    }
  }

  // OAuth 성공 후 홈으로 리다이렉트
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
