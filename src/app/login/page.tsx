"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type LoginTab = "email" | "oauth" | "easy";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LoginTab>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // 자동로그인 설정 불러오기
  useEffect(() => {
    const savedRememberMe = localStorage.getItem("rememberMe");
    const savedEmail = localStorage.getItem("rememberedEmail");
    
    if (savedRememberMe === "true" && savedEmail) {
      setRememberMe(true);
      setEmail(savedEmail);
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setErrorMsg("로그인 세션이 생성되지 않았습니다.");
        setLoading(false);
        return;
      }

      // 자동로그인 설정 저장
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("rememberedEmail", email.trim());
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("rememberedEmail");
      }

      router.push("/");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message ?? "로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setErrorMsg(null);
    setKakaoLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "profile_nickname profile_image account_email",
          queryParams: {
            theme: "light",
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || "카카오 로그인에 실패했습니다.");
        setKakaoLoading(false);
      }
      // 성공 시 자동으로 리다이렉트되므로 여기서는 아무것도 하지 않음
    } catch (err: any) {
      console.error("카카오 로그인 에러:", err);
      setErrorMsg(err.message ?? "카카오 로그인 중 오류가 발생했습니다.");
      setKakaoLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMsg(error.message || "구글 로그인에 실패했습니다.");
        setGoogleLoading(false);
      }
      // 성공 시 자동으로 리다이렉트되므로 여기서는 아무것도 하지 않음
    } catch (err: any) {
      console.error("구글 로그인 에러:", err);
      setErrorMsg(err.message ?? "구글 로그인 중 오류가 발생했습니다.");
      setGoogleLoading(false);
    }
  };


  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "#f5f7fa",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          padding: "40px 32px",
          textAlign: "center",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            margin: "0 auto 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/alllove-logo.png"
            alt="AllLove Church Community Logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1f2937",
            marginBottom: 4,
          }}
        >
          다애공동체
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#6b7280",
            margin: 0,
            marginBottom: 8,
          }}
        >
          AllLove Church Community
        </p>
        <p
          style={{
            fontSize: 14,
            color: "#6b7280",
            marginBottom: 24,
          }}
        >
          로그인하여 서비스를 이용하세요
        </p>

        {/* 로그인 방식 탭 */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "transparent",
              color: activeTab === "email" ? "#3b82f6" : "#6b7280",
              fontWeight: activeTab === "email" ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              borderBottom: activeTab === "email" ? "2px solid #3b82f6" : "2px solid transparent",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
            }}
          >
            이메일 로그인
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("oauth")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "transparent",
              color: activeTab === "oauth" ? "#3b82f6" : "#6b7280",
              fontWeight: activeTab === "oauth" ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              borderBottom: activeTab === "oauth" ? "2px solid #3b82f6" : "2px solid transparent",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
            }}
          >
            소셜 로그인
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("easy")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "transparent",
              color: activeTab === "easy" ? "#3b82f6" : "#6b7280",
              fontWeight: activeTab === "easy" ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              borderBottom: activeTab === "easy" ? "2px solid #3b82f6" : "2px solid transparent",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
            }}
          >
            어르신 간편로그인
          </button>
        </div>

        {/* 탭 콘텐츠 영역 - 최소 높이 설정으로 레이아웃 고정 */}
        <div style={{ minHeight: "280px" }}>
        {activeTab === "email" && (
          <>
          <form 
          name="login"
          method="post"
          onSubmit={handleSubmit} 
          style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 8 }}
        >
          <div>
            <label
              htmlFor="email"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#374151",
                display: "block",
                marginBottom: 6,
                textAlign: "left",
              }}
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                transition: "all 0.2s ease",
              }}
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#374151",
                display: "block",
                marginBottom: 6,
                textAlign: "left",
              }}
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                transition: "all 0.2s ease",
              }}
              required
            />
          </div>

          {errorMsg && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fecaca",
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "12px 24px",
              borderRadius: 6,
              border: "none",
              background: loading ? "#d1d5db" : "#3b82f6",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "#2563eb";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "#3b82f6";
              }
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                cursor: "pointer",
                marginRight: 8,
              }}
            />
            <label
              htmlFor="rememberMe"
              style={{
                fontSize: 13,
                color: "#6b7280",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              자동로그인
            </label>
          </div>
        </form>

        {/* 구분선 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "16px 0",
            gap: 12,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              backgroundColor: "#e5e7eb",
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: "#9ca3af",
            }}
          >
            또는
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              backgroundColor: "#e5e7eb",
            }}
          />
        </div>

        {/* 회원가입 버튼 */}
        <button
          type="button"
          onClick={() => router.push("/signup")}
          style={{
            width: "100%",
            padding: "12px 24px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            color: "#374151",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3b82f6";
            e.currentTarget.style.color = "#3b82f6";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e5e7eb";
            e.currentTarget.style.color = "#374151";
          }}
        >
          회원가입
        </button>

        {/* 아이디/비밀번호 찾기 */}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link
            href="/forgot-password"
            style={{
              fontSize: 13,
              color: "#3b82f6",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            아이디 / 비밀번호 찾기
          </Link>
        </div>
        </>
        )}

        {activeTab === "oauth" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              style={{
                width: "100%",
                padding: "12px 24px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: googleLoading || loading ? "#d1d5db" : "#ffffff",
                color: "#374151",
                fontWeight: 600,
                fontSize: 14,
                cursor: googleLoading || loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {googleLoading ? "연결 중..." : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none" fillRule="evenodd">
                      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.55 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </g>
                  </svg>
                  구글로 로그인
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleKakaoLogin}
              disabled={kakaoLoading || loading}
              style={{
                width: "100%",
                padding: "12px 24px",
                borderRadius: 8,
                border: "none",
                background: kakaoLoading || loading ? "#d1d5db" : "#FEE500",
                color: "#000000",
                fontWeight: 600,
                fontSize: 14,
                cursor: kakaoLoading || loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {kakaoLoading ? "연결 중..." : (
                <>
                  <img 
                    src="/kakao-icon.png" 
                    alt="카카오톡" 
                    style={{ width: 18, height: 18, objectFit: "contain" }}
                  />
                  카카오톡으로 로그인
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === "easy" && (
          <div style={{ textAlign: "center", padding: "20px 0", marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
              어르신 간편로그인 페이지로 이동합니다
            </p>
            <button
              type="button"
              onClick={() => router.push("/easy-login")}
              style={{
                padding: "12px 24px",
                borderRadius: 6,
                border: "none",
                background: "#3b82f6",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              간편로그인 페이지로 이동
            </button>
          </div>
        )}

        </div>
      </div>

    </div>
  );
}
