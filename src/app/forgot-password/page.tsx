"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"find-id" | "find-password">("find-id");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);

  const handleFindId = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // 이름과 이메일로 프로필 찾기
      const { data, error } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("full_name", name.trim())
        .eq("email", email.trim())
        .maybeSingle();

      if (error) {
        setErrorMsg("조회 중 오류가 발생했습니다.");
        return;
      }

      if (!data || !data.email) {
        setErrorMsg("일치하는 계정을 찾을 수 없습니다. 이름과 이메일을 확인해주세요.");
        return;
      }

      // 이메일 일부만 표시 (보안)
      const emailParts = data.email.split("@");
      const maskedEmail = emailParts[0].substring(0, 2) + "***@" + emailParts[1];
      setFoundEmail(data.email);
      setSuccessMsg(`아이디: ${maskedEmail}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message ?? "아이디 찾기 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleFindPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // 비밀번호 재설정 이메일 전송
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setErrorMsg(error.message || "비밀번호 재설정 이메일 전송에 실패했습니다.");
        return;
      }

      setSuccessMsg("비밀번호 재설정 링크가 이메일로 전송되었습니다. 이메일을 확인해주세요.");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message ?? "비밀번호 찾기 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          padding: "40px 32px",
          border: "1px solid #e5e7eb",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#3b82f6",
              margin: "0 auto 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 36, color: "#ffffff" }}>🔍</span>
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1f2937",
              marginBottom: 8,
            }}
          >
            아이디 / 비밀번호 찾기
          </h1>
        </div>

        {/* 탭 전환 */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <button
            onClick={() => {
              setMode("find-id");
              setErrorMsg(null);
              setSuccessMsg(null);
              setFoundEmail(null);
              setEmail("");
              setName("");
            }}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "none",
              borderBottom: mode === "find-id" ? "2px solid #3b82f6" : "2px solid transparent",
              color: mode === "find-id" ? "#3b82f6" : "#6b7280",
              fontWeight: mode === "find-id" ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            아이디 찾기
          </button>
          <button
            onClick={() => {
              setMode("find-password");
              setErrorMsg(null);
              setSuccessMsg(null);
              setFoundEmail(null);
              setEmail("");
              setName("");
            }}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "none",
              borderBottom: mode === "find-password" ? "2px solid #3b82f6" : "2px solid transparent",
              color: mode === "find-password" ? "#3b82f6" : "#6b7280",
              fontWeight: mode === "find-password" ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            비밀번호 찾기
          </button>
        </div>

        {/* 아이디 찾기 폼 */}
        {mode === "find-id" && (
          <form onSubmit={handleFindId} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                }}
                required
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
                }}
              >
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
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

            {successMsg && (
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  color: "#16a34a",
                  border: "1px solid #86efac",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                }}
              >
                {successMsg}
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
            >
              {loading ? "조회 중..." : "아이디 찾기"}
            </button>
          </form>
        )}

        {/* 비밀번호 찾기 폼 */}
        {mode === "find-password" && (
          <form onSubmit={handleFindPassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
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
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                }}
                required
              />
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4, margin: 0 }}>
                등록된 이메일로 비밀번호 재설정 링크가 전송됩니다.
              </p>
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

            {successMsg && (
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  color: "#16a34a",
                  border: "1px solid #86efac",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                }}
              >
                {successMsg}
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
            >
              {loading ? "전송 중..." : "비밀번호 재설정 이메일 전송"}
            </button>
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
            ← 로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
