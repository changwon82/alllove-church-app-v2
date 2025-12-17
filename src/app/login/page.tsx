"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type LoginTab = "email" | "oauth" | "easy";

// 어르신 전용 회원가입 모달 컴포넌트
function ElderSignupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim() || name.trim().length < 2) {
      setErrorMsg("이름을 올바르게 입력해주세요.");
      return;
    }

    if (!phone.trim()) {
      setErrorMsg("전화번호를 입력해주세요.");
      return;
    }

    // 전화번호 형식 정리 (숫자만 추출)
    const cleanedPhone = phone.replace(/[^0-9]/g, "");
    if (cleanedPhone.length < 10) {
      setErrorMsg("전화번호를 올바르게 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/elder-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanedPhone,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setErrorMsg(data.message || "회원가입에 실패했습니다.");
        setLoading(false);
        return;
      }

      setSuccessMsg("회원가입이 완료되었습니다! 간편로그인을 사용하실 수 있습니다.");
      setTimeout(() => {
        onClose();
        // 폼 초기화
        setName("");
        setPhone("");
      }, 2000);
    } catch (err: any) {
      console.error("회원가입 에러:", err);
      setErrorMsg("회원가입 처리 중 오류가 발생했습니다.");
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
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: "32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#1f2937",
              marginBottom: 8,
            }}
          >
            어르신 전용 회원가입
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            이름과 전화번호만 입력하시면 됩니다
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
              marginBottom: 16,
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
              전화번호
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                // 숫자만 추출
                const numbers = e.target.value.replace(/[^0-9]/g, "");
                // 자동으로 하이픈 추가 (010-1234-5678 형식)
                let formatted = numbers;
                if (numbers.length > 3 && numbers.length <= 7) {
                  formatted = `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
                } else if (numbers.length > 7) {
                  formatted = `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
                }
                setPhone(formatted);
              }}
              placeholder="010-1234-5678"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 14,
              }}
              required
              maxLength={13}
            />
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, marginBottom: 0, textAlign: "left" }}>
              하이픈(-)을 포함하여 입력해주세요 (예: 010-1234-5678)
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
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
              취소
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
              {loading ? "처리 중..." : "회원가입"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 어르신 간편로그인 폼 컴포넌트
function EasyLoginForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showElderSignup, setShowElderSignup] = useState(false);

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
        setLoading(false);
        return;
      }

      // 로그인 처리 (비밀번호 방식)
      if (data.loginInfo.method === "password") {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: data.loginInfo.email,
          password: data.loginInfo.password,
        });

        if (loginError) {
          setErrorMsg("로그인에 실패했습니다. 다시 시도해주세요.");
          setLoading(false);
          return;
        }

        if (loginData.session) {
          // 로그인 성공 - 홈으로 이동
          router.push("/");
        }
      } else {
        setErrorMsg("로그인 처리 중 오류가 발생했습니다.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("OTP 검증 에러:", err);
      setErrorMsg("인증 처리 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {errorMsg && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            color: "#dc2626",
            border: "1px solid #fecaca",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 13,
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
                transition: "all 0.2s ease",
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
                transition: "all 0.2s ease",
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
                transition: "all 0.2s ease",
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
              {loading ? "인증 중..." : "인증하기"}
            </button>
          </div>
        </form>
      )}

      {/* 안내 문구 및 회원가입 버튼 */}
      {step === "input" && (
        <>
          <div
            style={{
              marginTop: 8,
              padding: "12px",
              backgroundColor: "#fef3c7",
              border: "1px solid #fde68a",
              borderRadius: 6,
              fontSize: 12,
              color: "#92400e",
              textAlign: "center",
            }}
          >
            회원가입이 익숙치 않은 어르신만 이용해주세요
          </div>
          <button
            type="button"
            onClick={() => setShowElderSignup(true)}
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
            어르신 전용 회원가입
          </button>
        </>
      )}

      {showElderSignup && <ElderSignupModal onClose={() => setShowElderSignup(false)} />}
    </div>
  );
}

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
            어르신 전용
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
                  구글 로그인
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
                  카카오톡 로그인
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === "easy" && (
          <EasyLoginForm />
        )}

        </div>
      </div>

    </div>
  );
}
