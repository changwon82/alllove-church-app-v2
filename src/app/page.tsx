"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .maybeSingle();
        if (data?.full_name) {
          setUserName(data.full_name);
        }
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isLoggedIn === null) {
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
        로딩 중...
      </div>
    );
  }

  // 로그인 안 되어 있으면 로그인/회원가입 버튼 표시
  if (!isLoggedIn) {
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
            <span style={{ fontSize: 36, color: "#ffffff" }}>⛪</span>
          </div>

          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1f2937",
              marginBottom: 8,
            }}
          >
            교회 관리 시스템
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#6b7280",
              marginBottom: 32,
            }}
          >
            로그인하여 서비스를 이용하세요
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => router.push("/login")}
              style={{
                width: "100%",
                padding: "12px 24px",
                borderRadius: 8,
                border: "none",
                background: "#3b82f6",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#2563eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#3b82f6";
              }}
            >
              로그인
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
      </div>
    );
  }

  // 로그인 되어 있으면 홈 페이지 내용 표시
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#1f2937",
            marginBottom: 4,
          }}
        >
          대시보드
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          {userName || userEmail}님, 환영합니다
        </p>
      </div>

      {/* 기능 카드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          onClick={() => router.push("/members")}
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "20px",
            border: "1px solid #e5e7eb",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3b82f6";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e5e7eb";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                회원 조회
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                회원 목록을 조회하고 검색합니다
              </div>
            </div>
            <span style={{ fontSize: 24 }}>👥</span>
          </div>
        </div>

        <div
          onClick={() => router.push("/contacts")}
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "20px",
            border: "1px solid #e5e7eb",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3b82f6";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e5e7eb";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                연락처
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                회원 연락처를 확인합니다
              </div>
            </div>
            <span style={{ fontSize: 24 }}>📞</span>
          </div>
        </div>

        <div
          onClick={() => router.push("/birthdays")}
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "20px",
            border: "1px solid #e5e7eb",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3b82f6";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e5e7eb";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                생일 관리
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                생일자를 확인하고 관리합니다
              </div>
            </div>
            <span style={{ fontSize: 24 }}>🎂</span>
          </div>
        </div>

        <div
          onClick={() => router.push("/profile")}
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "20px",
            border: "1px solid #e5e7eb",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3b82f6";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e5e7eb";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                내 프로필
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                내 정보를 확인하고 수정합니다
              </div>
            </div>
            <span style={{ fontSize: 24 }}>👤</span>
          </div>
        </div>
      </div>
    </div>
  );
}
