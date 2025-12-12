"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 로그인/회원가입 페이지는 레이아웃 적용 안 함
  if (pathname === "/login" || pathname === "/signup") {
    return <>{children}</>;
  }

  // 로딩 중
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

  // 로그인 안 되어 있으면 사이드바 없이 표시
  if (!isLoggedIn) {
    return <>{children}</>;
  }

  // 로그인 되어 있으면 사이드바와 함께 표시
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f7fa" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: isMobile ? 0 : 240,
          padding: isMobile ? "56px 12px 12px 12px" : "20px",
          transition: "margin-left 0.3s ease, padding 0.3s ease",
          minHeight: "100vh",
        }}
      >
        {children}
      </main>
    </div>
  );
}
