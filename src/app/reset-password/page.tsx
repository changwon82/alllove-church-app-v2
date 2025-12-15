"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    // URL에서 hash fragment 확인 (Supabase가 리다이렉트할 때 사용)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");

    // URL 쿼리 파라미터도 확인
    const token = searchParams.get("token");
    const typeFromQuery = searchParams.get("type");

    // 비밀번호 재설정 토큰인지 확인
    if (type === "recovery" || typeFromQuery === "recovery" || accessToken) {
      setIsValidating(false);
    } else {
      // 토큰이 없거나 유효하지 않으면 에러 표시
      setErrorMsg("유효하지 않은 비밀번호 재설정 링크입니다.");
      setIsValidating(false);
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      // URL hash에서 토큰 추출
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        // 세션 설정
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setErrorMsg("세션 설정에 실패했습니다. 링크가 만료되었을 수 있습니다.");
          setLoading(false);
          return;
        }
      }

      // 비밀번호 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setErrorMsg(updateError.message || "비밀번호 변경에 실패했습니다.");
        setLoading(false);
        return;
      }

      setSuccessMsg("비밀번호가 성공적으로 변경되었습니다. 홈으로 이동합니다.");
      
      // 2초 후 홈으로 이동 (이미 로그인된 상태이므로)
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message ?? "비밀번호 변경 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: "#6b7280",
          background: "#f5f7fa",
        }}
      >
        확인 중...
      </div>
    );
  }

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
            marginBottom: 8,
          }}
        >
          비밀번호 재설정
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>
          새로운 비밀번호를 입력해주세요
        </p>

        {errorMsg && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              marginBottom: 16,
              textAlign: "left",
            }}
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              backgroundColor: "#f0fdf4",
              color: "#16a34a",
              border: "1px solid #86efac",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              marginBottom: 16,
              textAlign: "left",
            }}
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#374151",
                display: "block",
                marginBottom: 6,
                textAlign: "left",
              }}
            >
              새 비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 입력해주세요"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                transition: "all 0.2s ease",
              }}
              required
              minLength={6}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#374151",
                display: "block",
                marginBottom: 6,
                textAlign: "left",
              }}
            >
              비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호를 다시 입력해주세요"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                transition: "all 0.2s ease",
              }}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!successMsg}
            style={{
              marginTop: 8,
              padding: "12px 24px",
              borderRadius: 6,
              border: "none",
              background: loading || successMsg ? "#d1d5db" : "#3b82f6",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 14,
              cursor: loading || successMsg ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!loading && !successMsg) {
                e.currentTarget.style.background = "#2563eb";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && !successMsg) {
                e.currentTarget.style.background = "#3b82f6";
              }
            }}
          >
            {loading ? "변경 중..." : successMsg ? "완료" : "비밀번호 변경"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link
            href="/login"
            style={{
              fontSize: 13,
              color: "#3b82f6",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            ← 로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#6b7280",
            background: "#f5f7fa",
          }}
        >
          로딩 중...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
