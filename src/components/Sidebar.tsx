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
    "출석체크": "✅",
  };
  return icons[label] || "•";
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAttendancePermission, setHasAttendancePermission] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role, attendance_permission, full_name")
          .eq("id", user.id)
          .maybeSingle();
        const isAdminUser = data?.role === "admin";
        setIsAdmin(isAdminUser);
        setHasAttendancePermission(isAdminUser || data?.attendance_permission === true);
        setUserName(data?.full_name || null);
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
    { label: "성경일독365일", path: "/bible-reading", icon: getIcon("성경일독365일") },
    ...(hasAttendancePermission
      ? [{ label: "출석체크", path: "/attendance", icon: getIcon("출석체크") }]
      : []),
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
            top: 8,
            left: 8,
            zIndex: 1001,
            padding: "8px 12px",
            borderRadius: 6,
            border: "none",
            background: "#1f2937",
            color: "#ffffff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            height: 36,
            maxWidth: "calc(100vw - 16px)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            다애공동체
          </span>
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
          left: isMobile ? (isOpen ? 0 : "-280px") : 0,
          width: isMobile ? 280 : 240,
          height: "100vh",
          background: "#1f2937",
          zIndex: 999,
          transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
          maxWidth: isMobile ? "85vw" : "none",
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: isMobile ? "24px 16px" : "28px 20px", flexShrink: 0, textAlign: "center" }}>
          <h2
            style={{
              fontSize: isMobile ? 18 : 20,
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
              marginBottom: 6,
              letterSpacing: "-0.3px",
            }}
          >
            다애공동체
          </h2>
          <div
            style={{
              fontSize: isMobile ? 12 : 13,
              color: "#9ca3af",
              fontWeight: 400,
              marginBottom: 20,
            }}
          >
            AllLove Church
          </div>

          {/* 이름 표시 */}
          {userName && (
            <div
              style={{
                fontSize: isMobile ? 13 : 14,
                color: "#ffffff",
                fontWeight: 500,
                marginBottom: 16,
                padding: "8px 0",
              }}
            >
              하나님의 사람 {userName}
            </div>
          )}

          {/* 내 프로필 & 로그아웃 */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                router.push("/profile");
                if (isMobile) {
                  setIsOpen(false);
                }
              }}
              style={{
                flex: 1,
                padding: isMobile ? "10px 8px" : "12px 12px",
                borderRadius: 8,
                border: "1px solid #374151",
                background: pathname === "/profile" ? "#3b82f6" : "transparent",
                color: pathname === "/profile" ? "#ffffff" : "#d1d5db",
                fontSize: isMobile ? 11 : 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
              onMouseEnter={(e) => {
                if (pathname !== "/profile") {
                  e.currentTarget.style.background = "#374151";
                  e.currentTarget.style.borderColor = "#4b5563";
                }
              }}
              onMouseLeave={(e) => {
                if (pathname !== "/profile") {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "#374151";
                }
              }}
            >
              <span style={{ fontSize: isMobile ? 13 : 14, flexShrink: 0 }}>{getIcon("내 프로필")}</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>내 프로필</span>
            </button>

            <button
              onClick={handleLogout}
              style={{
                flex: 1,
                padding: isMobile ? "10px 8px" : "12px 12px",
                borderRadius: 8,
                border: "1px solid #7f1d1d",
                background: "transparent",
                color: "#ef4444",
                fontSize: isMobile ? 11 : 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#7f1d1d";
                e.currentTarget.style.borderColor = "#991b1b";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "#7f1d1d";
              }}
            >
              <svg width={isMobile ? 13 : 14} height={isMobile ? 13 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>로그아웃</span>
            </button>
          </div>
        </div>

        {/* 메뉴 */}
        <nav style={{ flex: 1, padding: isMobile ? "0 6px" : "0 8px", overflowY: "auto", minHeight: 0 }}>
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
                  padding: isMobile ? "5px 12px" : "6px 16px",
                  textAlign: "left",
                  background: isActive ? "#3b82f6" : "transparent",
                  color: isActive ? "#ffffff" : "#d1d5db",
                  fontSize: "inherit",
                  fontWeight: "normal",
                  fontFamily: "inherit",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? 10 : 12,
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
                <span style={{ fontSize: isMobile ? 15 : 16, width: isMobile ? 18 : 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

      </aside>
    </>
  );
}
