import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 브라우저(클라이언트)에서 쓸 Supabase 클라이언트
export const supabase = createClient(supabaseUrl, supabaseAnonKey);