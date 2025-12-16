"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

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
        return;
      }

      if (!data.session) {
        setErrorMsg("로그인 세션이 생성되지 않았습니다.");
        return;
      }

      router.push("/");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message ?? "로그인 중 오류가 발생했습니다.");
    } finally {
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
            marginBottom: 32,
          }}
        >
          로그인하여 서비스를 이용하세요
        </p>

        <form 
          name="login"
          method="post"
          onSubmit={handleSubmit} 
          style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}
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
        </form>

        <div style={{ marginTop: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>또는</span>
            <div style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
              onMouseEnter={(e) => {
                if (!kakaoLoading && !loading) {
                  e.currentTarget.style.background = "#FDD835";
                }
              }}
              onMouseLeave={(e) => {
                if (!kakaoLoading && !loading) {
                  e.currentTarget.style.background = "#FEE500";
                }
              }}
            >
              {kakaoLoading ? (
                "연결 중..."
              ) : (
                <>
                  <span style={{ fontSize: 18 }}>💬</span>
                  카카오톡으로 시작하기{" "}
                  <span style={{ color: "#dc2626", fontSize: 12 }}>(준비 중)</span>
                </>
              )}
            </button>

            <button
              onClick={() => router.push("/signup")}
              style={{
                width: "100%",
                padding: "12px 24px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
                color: "#374151",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f9fafb";
                e.currentTarget.style.borderColor = "#d1d5db";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#e5e7eb";
              }}
            >
              회원가입
            </button>
          </div>
        </div>

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
      </div>
    </div>
  );
}
