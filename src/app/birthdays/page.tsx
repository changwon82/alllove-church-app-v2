"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  birth: string | null;
  department: string | null;
  phone: string | null;
};

type BirthdayInfo = {
  profile: Profile;
  daysUntil: number;
  age: number | null;
  isThisMonth: boolean;
  birthDate: Date;
};

export default function BirthdaysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [viewMode, setViewMode] = useState<"thisMonth" | "upcoming">("thisMonth");

  useEffect(() => {
    const loadProfiles = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, birth, department, phone")
        .not("birth", "is", null)
        .order("full_name", { ascending: true });

      if (error) {
        console.error("생일 정보 조회 에러:", error);
        setLoading(false);
        return;
      }

      setProfiles((data ?? []) as Profile[]);
      setLoading(false);
    };

    loadProfiles();
  }, [router]);

  const birthdays = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();

    return profiles
      .map((p) => {
        if (!p.birth) return null;
        try {
          const birthDate = new Date(p.birth);
          const thisYear = now.getFullYear();
          const thisYearBirthday = new Date(thisYear, birthDate.getMonth(), birthDate.getDate());
          const nextYearBirthday = new Date(thisYear + 1, birthDate.getMonth(), birthDate.getDate());

          let daysUntil: number;
          if (thisYearBirthday >= now) {
            daysUntil = Math.ceil((thisYearBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            daysUntil = Math.ceil((nextYearBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          }

          const age = thisYear - birthDate.getFullYear();
          const isThisMonth = birthDate.getMonth() === currentMonth;

          return {
            profile: p,
            daysUntil,
            age,
            isThisMonth,
            birthDate,
          };
        } catch {
          return null;
        }
      })
      .filter((b): b is BirthdayInfo => b !== null)
      .sort((a, b) => {
        if (viewMode === "thisMonth") {
          return a.birthDate.getDate() - b.birthDate.getDate();
        } else {
          return a.daysUntil - b.daysUntil;
        }
      })
      .filter((b) => {
        if (viewMode === "thisMonth") {
          return b.isThisMonth;
        } else {
          return b.daysUntil <= 30 && b.daysUntil >= 0;
        }
      });
  }, [profiles, viewMode]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 14,
          color: "#6b7280",
        }}
      >
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
          생일 관리
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>생일자를 확인하고 관리합니다</p>
      </div>

      {/* 필터 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          padding: "12px",
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <button
          onClick={() => setViewMode("thisMonth")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: viewMode === "thisMonth" ? "#3b82f6" : "#f3f4f6",
            color: viewMode === "thisMonth" ? "white" : "#374151",
            fontWeight: 500,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          이번 달 생일
        </button>
        <button
          onClick={() => setViewMode("upcoming")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: viewMode === "upcoming" ? "#3b82f6" : "#f3f4f6",
            color: viewMode === "upcoming" ? "white" : "#374151",
            fontWeight: 500,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          다가오는 생일 (30일)
        </button>
        <div
          style={{
            marginLeft: "auto",
            color: "#6b7280",
            fontSize: 12,
            padding: "8px 12px",
            backgroundColor: "#f3f4f6",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
          }}
        >
          {birthdays.length}명
        </div>
      </div>

      {/* 생일자 목록 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {birthdays.map((b) => {
          const isToday = b.daysUntil === 0;

          return (
            <div
              key={b.profile.id}
              style={{
                backgroundColor: isToday ? "#fef3c7" : "#ffffff",
                borderRadius: 8,
                padding: "16px",
                border: isToday ? "2px solid #f59e0b" : "1px solid #e5e7eb",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = isToday
                  ? "0 4px 12px rgba(245, 158, 11, 0.2)"
                  : "0 2px 6px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {isToday && (
                <div
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 12,
                    backgroundColor: "#f59e0b",
                    color: "white",
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 10,
                  }}
                >
                  오늘 생일!
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 6 }}>
                {b.profile.full_name || "-"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                생일: {b.birthDate.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
              </div>
              {b.age !== null && (
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>만 {b.age}세</div>
              )}
              {b.daysUntil > 0 && (
                <div style={{ fontSize: 12, color: "#3b82f6", marginBottom: 8, fontWeight: 500 }}>
                  {b.daysUntil}일 후
                </div>
              )}
              {b.profile.department && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: "1px solid #f3f4f6",
                  }}
                >
                  {b.profile.department}
                </div>
              )}
              {b.profile.phone && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{b.profile.phone}</div>
              )}
            </div>
          );
        })}

        {birthdays.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "32px",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            {viewMode === "thisMonth" ? "이번 달 생일자가 없습니다." : "다가오는 생일자가 없습니다."}
          </div>
        )}
      </div>
    </div>
  );
}
