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
  department: string | null;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  member_id: string;
  date: string;
  attended: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  department: string | null;
  position: string | null;
};

const departments = ["유초등부", "유치부", "청소년부", "청년부"];

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, boolean>>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
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

        // 프로필 정보 불러오기 (부서별 담당자 확인용)
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, department, position")
          .not("department", "is", null)
          .eq("approved", true);

        if (profilesError) {
          console.error("프로필 조회 에러:", profilesError);
        } else {
          setProfiles((profilesData as Profile[]) || []);
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

    // 이번 주 평균 출석률
    let weekTotalAttended = 0;
    let weekTotalDays = 0;
    const sundayDate = currentWeekDates[0]; // 일요일 날짜

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

    // 부서명 매핑 (데이터베이스에 저장된 이름 -> 화면에 표시할 이름)
    const deptMapping: Record<string, string> = {
      "아동부": "유치부",
      "중고등부": "청소년부",
    };

    // 부서별 통계
    const byDepartment: Record<string, { 
      total: number; 
      attended: number; 
      checked: number;
      manager: { name: string; position: string | null } | null;
    }> = {};

    departments.forEach((dept) => {
      // 해당 부서의 출석체크 대상자 수 (매핑된 부서명도 고려)
      const deptMembers = members.filter((m) => {
        const mappedDept = deptMapping[m.department || ""] || m.department;
        return mappedDept === dept || m.department === dept;
      });
      const total = deptMembers.length;

      // 일요일 기준 출석 체크된 인원 수
      let checked = 0;
      let attended = 0;
      deptMembers.forEach((member) => {
        if (records[member.id]?.[sundayDate] !== undefined) {
          checked++;
          if (records[member.id][sundayDate]) {
            attended++;
          }
        }
      });

      // 해당 부서의 담당자 찾기 (매핑된 부서명도 고려)
      const deptProfiles = profiles.filter((p) => {
        if (!p.department) return false;
        const mappedDept = deptMapping[p.department] || p.department;
        return (mappedDept === dept || p.department === dept) && p.full_name;
      });
      const manager = deptProfiles.length > 0
        ? { name: deptProfiles[0].full_name || "", position: deptProfiles[0].position }
        : null;

      byDepartment[dept] = {
        total,
        attended,
        checked,
        manager,
      };
    });

    return {
      totalMembers,
      weekAvgRate,
      byDepartment,
    };
  }, [members, records, currentWeekDates, profiles]);

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

  const sundayDate = currentWeekDates[0];

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
            출석체크 통계
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            이번 주일 ({sundayDate} ~ {currentWeekDates[6]})
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
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>이번 주일 출석률</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
            {stats.weekAvgRate}%
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            주일예배 평균
          </div>
        </div>
      </div>

      {/* 교회학교 출석현황 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "16px",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 16 }}>교회학교 출석현황</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {departments.map((dept) => {
            const deptStats = stats.byDepartment[dept];
            const rate = deptStats.total > 0 ? Math.round((deptStats.attended / deptStats.total) * 100) : 0;

            return (
              <Link
                key={dept}
                href={`/attendance/${encodeURIComponent(dept)}`}
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
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
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1f2937", minWidth: 70 }}>
                    {dept}
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280", minWidth: 0, flex: 1 }}>
                    {deptStats.manager ? (
                      <>
                        {deptStats.manager.name}
                        {deptStats.manager.position && ` ${deptStats.manager.position}`}
                      </>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>-</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, color: "#1f2937", minWidth: 80 }}>
                    {deptStats.attended}/{deptStats.total}명
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#10b981", minWidth: 60, textAlign: "right" }}>
                    {rate}%
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
