"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type AttendanceMember = {
  id: string;
  name: string;
  gender: string | null;
  birth_date: string | null;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  member_id: string;
  date: string;
  attended: boolean;
  created_at: string;
};

const departments = ["유초등부", "아동부", "중고등부", "청년부", "장년부", "찬양팀", "안내팀"];

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, boolean>>>({});
  const [currentWeekDates, setCurrentWeekDates] = useState<string[]>([]);

  // 이번 주일 날짜들 계산 (일요일 기준)
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    setCurrentWeekDates(dates);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (
          authError &&
          (authError.message?.includes("Invalid Refresh Token") ||
            authError.message?.includes("Refresh Token Not Found") ||
            authError.status === 401)
        ) {
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        // 권한 확인
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, attendance_permission")
          .eq("id", user.id)
          .maybeSingle();

        const isAdminUser = profile?.role === "admin";
        const hasAttendancePermission = isAdminUser || profile?.attendance_permission === true;

        if (!hasAttendancePermission) {
          router.push("/");
          return;
        }

        setHasPermission(true);

        // 출석체크 대상자 목록 불러오기
        const { data: membersData, error: membersError } = await supabase
          .from("attendance_members")
          .select("*")
          .order("name", { ascending: true });

        if (membersError) {
          console.error("출석체크 대상자 조회 에러:", membersError);
        } else {
          setMembers((membersData as AttendanceMember[]) || []);
        }

        // 이번 주 출석 기록 불러오기
        if (currentWeekDates.length > 0) {
          const { data: recordsData, error: recordsError } = await supabase
            .from("attendance_records")
            .select("*")
            .in("date", currentWeekDates);

          if (recordsError) {
            console.error("출석 기록 조회 에러:", recordsError);
          } else {
            const recordsMap: Record<string, Record<string, boolean>> = {};
            (recordsData as AttendanceRecord[]).forEach((record) => {
              if (!recordsMap[record.member_id]) {
                recordsMap[record.member_id] = {};
              }
              recordsMap[record.member_id][record.date] = record.attended;
            });
            setRecords(recordsMap);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error("데이터 로드 에러:", err);
        setLoading(false);
      }
    };

    loadData();
  }, [router, currentWeekDates]);

  // 통계 계산
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // 오늘 출석률
    let todayAttended = 0;
    let todayTotal = 0;
    members.forEach((member) => {
      if (records[member.id]?.[todayStr] !== undefined) {
        todayTotal++;
        if (records[member.id][todayStr]) {
          todayAttended++;
        }
      }
    });
    const todayRate = todayTotal > 0 ? Math.round((todayAttended / todayTotal) * 100) : 0;

    // 이번 주 평균 출석률
    let weekTotalAttended = 0;
    let weekTotalDays = 0;
    currentWeekDates.forEach((date) => {
      let dateAttended = 0;
      let dateTotal = 0;
      members.forEach((member) => {
        if (records[member.id]?.[date] !== undefined) {
          dateTotal++;
          if (records[member.id][date]) {
            dateAttended++;
          }
        }
      });
      if (dateTotal > 0) {
        weekTotalAttended += dateAttended;
        weekTotalDays += dateTotal;
      }
    });
    const weekAvgRate = weekTotalDays > 0 ? Math.round((weekTotalAttended / weekTotalDays) * 100) : 0;

    // 부서별 통계 (출석체크 대상자에는 부서 정보가 없으므로, 전체 통계만 제공)
    const byDepartment: Record<string, { total: number; todayAttended: number; todayTotal: number }> = {};
    departments.forEach((dept) => {
      byDepartment[dept] = {
        total: 0,
        todayAttended: 0,
        todayTotal: 0,
      };
    });

    // 일일별 출석 통계
    const dailyStats = currentWeekDates.map((date) => {
      let dateAttended = 0;
      let dateTotal = 0;
      members.forEach((member) => {
        if (records[member.id]?.[date] !== undefined) {
          dateTotal++;
          if (records[member.id][date]) {
            dateAttended++;
          }
        }
      });
      return {
        date,
        attended: dateAttended,
        total: dateTotal,
        rate: dateTotal > 0 ? Math.round((dateAttended / dateTotal) * 100) : 0,
      };
    });

    return {
      totalMembers,
      todayAttended,
      todayTotal,
      todayRate,
      weekAvgRate,
      dailyStats,
      byDepartment,
    };
  }, [members, records, currentWeekDates]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${month}/${day} (${weekday})`;
  };

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

  if (!hasPermission) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 14,
          color: "#ef4444",
        }}
      >
        출석체크 권한이 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
            출석체크 통계
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            이번 주일 ({currentWeekDates[0]} ~ {currentWeekDates[6]})
          </p>
        </div>
        <Link
          href="/attendance/members"
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#3b82f6",
            color: "#ffffff",
            fontWeight: 500,
            fontSize: 13,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          명단 관리
        </Link>
      </div>

      {/* 주요 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>전체 대상자</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1f2937" }}>{stats.totalMembers}명</div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>오늘 출석률</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
            {stats.todayRate}%
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            {stats.todayAttended}/{stats.todayTotal}명
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>이번 주 평균 출석률</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>
            {stats.weekAvgRate}%
          </div>
        </div>
      </div>

      {/* 일별 출석 통계 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "16px",
          border: "1px solid #e5e7eb",
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 16 }}>일별 출석 통계</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          {stats.dailyStats.map((day) => (
            <div
              key={day.date}
              style={{
                padding: "12px",
                borderRadius: 6,
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                {formatDate(day.date)}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
                {day.rate}%
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                {day.attended}/{day.total}명
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 부서별 체크 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "16px",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 16 }}>부서별 출석체크</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {departments.map((dept) => (
            <Link
              key={dept}
              href={`/attendance/${encodeURIComponent(dept)}`}
              style={{
                padding: "16px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
                textDecoration: "none",
                display: "block",
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.backgroundColor = "#f0f9ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.backgroundColor = "#ffffff";
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", textAlign: "center" }}>
                {dept}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
