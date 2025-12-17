"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function EasyLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleStart = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const response = await fetch("/api/easy-login/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phoneLast4: phoneLast4.trim(),
        }),
      });

      const data = await response.json();

      // 보안: 성공/실패를 구분하지 않는 응답이므로 항상 다음 단계로 진행
      // 실제로는 OTP가 발송되었는지 확인할 수 없지만, 사용자 경험을 위해 진행
      setStep("verify");
      setSuccessMsg("인증번호가 발송되었습니다. 문자를 확인해주세요.");
    } catch (err: any) {
      console.error("OTP 발송 에러:", err);
      setErrorMsg("요청 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const response = await fetch("/api/easy-login/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phoneLast4: phoneLast4.trim(),
          code: otpCode.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setErrorMsg(data.message || "인증에 실패했습니다.");
        return;
      }

      // 로그인 처리
      if (data.loginInfo.method === "magiclink") {
        // Magic Link로 리다이렉트
        window.location.href = data.loginInfo.magicLink;
      } else if (data.loginInfo.method === "password") {
        // 임시 비밀번호로 로그인
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: data.loginInfo.email,
          password: data.loginInfo.tempPassword,
        });

        if (loginError) {
          setErrorMsg("로그인에 실패했습니다. 다시 시도해주세요.");
          return;
        }

        if (loginData.session) {
          // 로그인 성공 - 홈으로 이동
          router.push("/");
        }
      }
    } catch (err: any) {
      console.error("OTP 검증 에러:", err);
      setErrorMsg("인증 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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
          어르신 간편로그인
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#6b7280",
            marginBottom: 32,
          }}
        >
          이름과 전화번호 뒤 4자리로 간편하게 로그인하세요
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

        {step === "input" ? (
          <form onSubmit={handleStart} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                }}
                required
                minLength={2}
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
                전화번호 뒤 4자리
              </label>
              <input
                type="text"
                value={phoneLast4}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                  setPhoneLast4(value);
                }}
                placeholder="5678"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                }}
                required
                minLength={4}
                maxLength={4}
              />
            </div>

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
              }}
            >
              {loading ? "처리 중..." : "인증번호 받기"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                인증번호 6자리
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                  setOtpCode(value);
                }}
                placeholder="123456"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                textAlign: "center",
                letterSpacing: "8px",
                fontSize: 20,
                fontWeight: 600,
              }}
                required
                minLength={6}
                maxLength={6}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setOtpCode("");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                다시 입력
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  borderRadius: 6,
                  border: "none",
                  background: loading ? "#d1d5db" : "#3b82f6",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "인증 중..." : "인증하기"}
              </button>
            </div>
          </form>
        )}

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
            ← 일반 로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
