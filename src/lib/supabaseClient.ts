import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 브라우저(클라이언트)에서 쓸 Supabase 클라이언트
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// 리프레시 토큰 에러 처리를 위한 헬퍼 함수
export const getUserWithErrorHandling = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // 리프레시 토큰 관련 에러인 경우
      if (
        error.message?.includes("Invalid Refresh Token") ||
        error.message?.includes("Refresh Token Not Found") ||
        error.status === 401
      ) {
        // 세션 정리 및 로그아웃
        await supabase.auth.signOut();
        return { data: null, error: null, shouldRedirect: true };
      }
      return { data, error, shouldRedirect: false };
    }
    return { data, error: null, shouldRedirect: false };
  } catch (err: any) {
    // 예상치 못한 에러
    if (
      err?.message?.includes("Invalid Refresh Token") ||
      err?.message?.includes("Refresh Token Not Found")
    ) {
      await supabase.auth.signOut();
      return { data: null, error: null, shouldRedirect: true };
    }
    return { data: null, error: err, shouldRedirect: false };
  }
};