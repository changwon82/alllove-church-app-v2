"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type MenuItem = {
  label: string;
  path: string;
  icon: string;
};

const getIcon = (label: string) => {
  const icons: Record<string, string> = {
    홈: "🏠",
    "내 프로필": "👤",
    "성경일독365일": "📖",
    "회원 조회": "👥",
    연락처: "📞",
    "생일 관리": "🎂",
    관리자페이지: "⚙️",
    "통계 대시보드": "📊",
  };
  return icons[label] || "•";
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        setIsAdmin(data?.role === "admin");
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [pathname, isMobile]);

  const menuItems: MenuItem[] = [
    { label: "홈", path: "/", icon: getIcon("홈") },
    { label: "내 프로필", path: "/profile", icon: getIcon("내 프로필") },
    { label: "성경일독365일", path: "/bible-reading", icon: getIcon("성경일독365일") },
    ...(isAdmin
      ? [
          { label: "회원 조회", path: "/members", icon: getIcon("회원 조회") },
          { label: "연락처", path: "/contacts", icon: getIcon("연락처") },
          { label: "생일 관리", path: "/birthdays", icon: getIcon("생일 관리") },
          { label: "관리자페이지", path: "/admin", icon: getIcon("관리자페이지") },
          { label: "통계 대시보드", path: "/admin/stats", icon: getIcon("통계 대시보드") },
        ]
      : []),
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* 모바일 메뉴 버튼 */}
      {isMobile && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            zIndex: 1001,
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            background: "#1f2937",
            color: "#ffffff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      )}

      {/* 오버레이 (모바일) */}
      {isOpen && isMobile && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 998,
          }}
        />
      )}

      {/* 사이드바 */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: isMobile ? (isOpen ? 0 : "-240px") : 0,
          width: 240,
          height: "100vh",
          background: "#1f2937",
          zIndex: 999,
          transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          padding: "20px 0",
          display: "flex",
          flexDirection: "column",
          boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: "0 16px", marginBottom: 24 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
              letterSpacing: "-0.3px",
            }}
          >
            교회 관리 시스템
          </h2>
        </div>

        {/* 메뉴 */}
        <nav style={{ flex: 1, padding: "0 8px", overflowY: "auto" }}>
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                  if (isMobile) {
                    setIsOpen(false);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  textAlign: "left",
                  background: isActive ? "#3b82f6" : "transparent",
                  color: isActive ? "#ffffff" : "#d1d5db",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#374151";
                    e.currentTarget.style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#d1d5db";
                  }
                }}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* 로그아웃 버튼 */}
        <div style={{ padding: "0 16px", borderTop: "1px solid #374151", paddingTop: 12 }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#ef4444",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#7f1d1d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}
