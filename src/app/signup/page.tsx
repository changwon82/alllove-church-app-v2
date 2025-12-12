"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("이름을 입력해주세요.");
      return;
    }
    if (!email.trim()) {
      setErrorMsg("이메일을 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setErrorMsg("사용자 정보가 없습니다. 다시 시도해주세요.");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: name.trim(),
        role: "member",
      });

      if (profileError) {
        console.error("profiles insert error", profileError);
        setErrorMsg("프로필 저장 중 오류가 발생했습니다.");
        return;
      }

      router.push("/login");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message ?? "알 수 없는 오류가 발생했습니다.");
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
        animation: "fadeIn 0.2s ease",
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
          position: "relative",
          animation: "slideUp 0.3s ease",
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
            <span style={{ fontSize: 36, color: "#ffffff" }}>✨</span>
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1f2937",
              marginBottom: 8,
            }}
          >
            회원가입
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>새 계정을 만들어 시작하세요</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                transition: "all 0.2s ease",
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
              type="password"
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
              minLength={6}
            />
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6, margin: 0 }}>
              최소 6자 이상 입력해주세요
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
            {loading ? "처리 중..." : "회원가입"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              style={{
                color: "#3b82f6",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              로그인
            </Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
