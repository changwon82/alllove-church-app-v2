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
    "현황&기도제목": "🙏",
    "명단관리": "📋",
    "출석리포트": "📈",
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
  const [adminMenuOrder, setAdminMenuOrder] = useState<string[] | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

        // 관리자 메뉴 순서 불러오기
        if (isAdminUser) {
          const { data: menuOrderData } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "admin_menu_order")
            .maybeSingle();

          if (menuOrderData?.value) {
            setAdminMenuOrder(menuOrderData.value as string[]);
          }
        }
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

  const generalMenuItems: MenuItem[] = [
    { label: "홈", path: "/", icon: getIcon("홈") },
    { label: "성경일독365일", path: "/bible-reading", icon: getIcon("성경일독365일") },
  ];

  const permissionMenuItems: MenuItem[] = hasAttendancePermission
    ? [
        { label: "출석체크", path: "/attendance", icon: getIcon("출석체크") },
        { label: "현황&기도제목", path: "/attendance/status-prayers", icon: getIcon("현황&기도제목") },
        { label: "명단관리", path: "/attendance/members", icon: getIcon("명단관리") },
        { label: "출석리포트", path: "/attendance/report", icon: getIcon("출석리포트") },
      ]
    : [];

  // 관리자 메뉴 아이템 정의
  const allAdminMenuItems: Record<string, MenuItem> = {
    "회원 조회": { label: "회원 조회", path: "/members", icon: getIcon("회원 조회") },
    연락처: { label: "연락처", path: "/contacts", icon: getIcon("연락처") },
    "생일 관리": { label: "생일 관리", path: "/birthdays", icon: getIcon("생일 관리") },
    관리자페이지: { label: "관리자페이지", path: "/admin", icon: getIcon("관리자페이지") },
    "통계 대시보드": { label: "통계 대시보드", path: "/admin/stats", icon: getIcon("통계 대시보드") },
  };

  // 저장된 순서대로 메뉴 정렬
  const adminMenuItems: MenuItem[] = isAdmin
    ? (() => {
        const defaultOrder = ["회원 조회", "연락처", "생일 관리", "관리자페이지", "통계 대시보드"];
        const order = adminMenuOrder || defaultOrder;
        
        // 순서대로 정렬하고, 순서에 없는 항목은 뒤에 추가
        const ordered: MenuItem[] = [];
        const used = new Set<string>();
        
        order.forEach((label) => {
          if (allAdminMenuItems[label]) {
            ordered.push(allAdminMenuItems[label]);
            used.add(label);
          }
        });
        
        // 순서에 없는 항목 추가
        Object.keys(allAdminMenuItems).forEach((label) => {
          if (!used.has(label)) {
            ordered.push(allAdminMenuItems[label]);
          }
        });
        
        return ordered;
      })()
    : [];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* 모바일 메뉴 버튼 */}
      {isMobile && !isOpen && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: "fixed",
            top: 8,
            left: 8,
            zIndex: 1001,
            padding: "8px",
            borderRadius: "50%",
            border: "none",
            background: "rgba(31, 41, 55, 0.85)",
            backdropFilter: "blur(4px)",
            color: "#ffffff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            width: 36,
            height: 36,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
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
              AllLove Church Community
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
                  padding: isMobile ? "5px 8px" : "6px 12px",
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
                  padding: isMobile ? "5px 8px" : "6px 12px",
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
          {/* 일반 메뉴 (모든 회원) */}
          <div
            style={{
              padding: isMobile ? "4px 12px" : "6px 16px",
              fontSize: isMobile ? 11 : 12,
              color: "#9ca3af",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            일반 메뉴
          </div>
          {generalMenuItems.map((item) => {
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
                  marginBottom: 3,
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

          {/* 권한 메뉴 (담당자만) */}
          {permissionMenuItems.length > 0 && (
            <>
              <div
                style={{
                  margin: isMobile ? "12px 0" : "16px 0",
                  borderTop: "1px solid #374151",
                  opacity: 0.3,
                }}
              />
              <div
                style={{
                  padding: isMobile ? "4px 12px" : "6px 16px",
                  fontSize: isMobile ? 11 : 12,
                  color: "#9ca3af",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                담당자 메뉴
              </div>
              {permissionMenuItems.map((item) => {
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
                      marginBottom: 3,
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
            </>
          )}

          {/* 관리자 메뉴 구분선 */}
          {adminMenuItems.length > 0 && (
            <>
              <div
                style={{
                  margin: isMobile ? "12px 0" : "16px 0",
                  borderTop: "1px solid #374151",
                  opacity: 0.3,
                }}
              />
              <div
                style={{
                  padding: isMobile ? "4px 12px" : "6px 16px",
                  fontSize: isMobile ? 11 : 12,
                  color: "#9ca3af",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                관리자 메뉴
              </div>
              {adminMenuItems.map((item, index) => {
                const isActive = pathname === item.path;
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;
                const currentOrder = adminMenuOrder || ["회원 조회", "연락처", "생일 관리", "관리자페이지", "통계 대시보드"];

                const handleDragStart = (e: React.DragEvent) => {
                  setDraggedIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  // 드래그 이미지 숨기기
                  const img = new Image();
                  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                  e.dataTransfer.setDragImage(img, 0, 0);
                };

                const handleDragOver = (e: React.DragEvent) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (draggedIndex !== null && draggedIndex !== index) {
                    setDragOverIndex(index);
                  }
                };

                const handleDragLeave = () => {
                  setDragOverIndex(null);
                };

                const handleDrop = async (e: React.DragEvent) => {
                  e.preventDefault();
                  setDragOverIndex(null);

                  if (draggedIndex === null || draggedIndex === index) {
                    setDraggedIndex(null);
                    return;
                  }

                  const newOrder = [...currentOrder];
                  const draggedItem = newOrder[draggedIndex];
                  newOrder.splice(draggedIndex, 1);
                  newOrder.splice(index, 0, draggedItem);

                  setAdminMenuOrder(newOrder);
                  setDraggedIndex(null);

                  // 데이터베이스에 저장
                  try {
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) return;

                    await supabase
                      .from("app_settings")
                      .upsert(
                        {
                          key: "admin_menu_order",
                          value: newOrder,
                          updated_by: user.id,
                          updated_at: new Date().toISOString(),
                        },
                        {
                          onConflict: "key",
                        }
                      );
                  } catch (error) {
                    console.error("메뉴 순서 저장 에러:", error);
                  }
                };

                const handleClick = () => {
                  // 드래그 중이 아닐 때만 페이지 이동
                  if (draggedIndex === null) {
                    router.push(item.path);
                    if (isMobile) {
                      setIsOpen(false);
                    }
                  }
                };

                return (
                  <div
                    key={item.path}
                    draggable
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    style={{
                      opacity: isDragging ? 0.5 : 1,
                      transform: isDragging ? "scale(0.95)" : "scale(1)",
                      marginBottom: 3,
                      borderTop: isDragOver && draggedIndex !== null && draggedIndex < index ? "2px solid #10b981" : "none",
                      borderBottom: isDragOver && draggedIndex !== null && draggedIndex > index ? "2px solid #10b981" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <button
                      onClick={handleClick}
                      style={{
                        width: "100%",
                        padding: isMobile ? "5px 12px" : "6px 16px",
                        textAlign: "left",
                        background: isDragOver ? "#374151" : isActive ? "#3b82f6" : "transparent",
                        color: isActive ? "#ffffff" : "#d1d5db",
                        fontSize: "inherit",
                        fontWeight: "normal",
                        fontFamily: "inherit",
                        border: "none",
                        borderRadius: 8,
                        cursor: draggedIndex !== null ? "grabbing" : "grab",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? 10 : 12,
                      }}
                      draggable
                      onMouseEnter={(e) => {
                        if (!isActive && draggedIndex === null) {
                          e.currentTarget.style.background = "#374151";
                          e.currentTarget.style.color = "#ffffff";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive && draggedIndex === null) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#d1d5db";
                        }
                      }}
                    >
                      <span style={{ fontSize: isMobile ? 15 : 16, width: isMobile ? 18 : 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </nav>

      </aside>
    </>
  );
}
