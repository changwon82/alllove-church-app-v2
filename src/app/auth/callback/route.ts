import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.user) {
      // 카카오 로그인 후 프로필 생성/업데이트 (이메일만 사용)
      const userId = data.user.id;
      const userEmail = data.user.email;
      
      // 프로필이 이미 있는지 확인
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      
      if (!existingProfile) {
        // 새 프로필 생성 (이메일만 사용, 닉네임/프로필 사진 제외)
        await supabase.from("profiles").insert({
          id: userId,
          email: userEmail,
          full_name: null, // 카카오 닉네임 사용 안 함
          role: "member",
          approved: false,
        });
      } else {
        // 기존 프로필 업데이트 (이메일만 업데이트, 닉네임/프로필 사진은 유지)
        await supabase
          .from("profiles")
          .update({ email: userEmail })
          .eq("id", userId);
      }
    }
  }

  // OAuth 성공 후 홈으로 리다이렉트
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
