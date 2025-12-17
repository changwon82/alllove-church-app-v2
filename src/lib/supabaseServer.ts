import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 서버 사이드에서만 사용하는 Supabase 클라이언트 (Service Role Key 사용)
// 주의: 이 클라이언트는 절대 클라이언트 번들에 포함되면 안 됩니다.
// 환경변수가 없으면 빌드 타임 에러를 방지하기 위해 런타임에 체크
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// 런타임에 환경변수 확인 헬퍼 함수
export function getSupabaseAdmin() {
  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.");
  }
  if (!supabaseAdmin) {
    throw new Error("Supabase Admin 클라이언트가 초기화되지 않았습니다.");
  }
  return supabaseAdmin;
}
