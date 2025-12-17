"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
  date: string; // YYYY-MM-DD
  attended: boolean;
  created_at: string;
};

const departments = ["유치부", "유초등부", "청소년부", "청년부"];

export default function DepartmentAttendancePage() {
  const router = useRouter();
  // React DevTools enumeration 방지: useParams를 즉시 구조 분해하여 params 객체를 변수에 저장하지 않음
  const department = ((useParams() as { department?: string })?.department as string) || "";

  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, boolean>>>({});
  const [currentWeekDates, setCurrentWeekDates] = useState<string[]>([]);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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
    if (!department || !departments.includes(department)) {
      router.push("/attendance");
      return;
    }

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
          .select("role, department")
          .eq("id", user.id)
          .maybeSingle();

        const isAdminUser = profile?.role === "admin";
        const hasAttendancePermission = isAdminUser || !!profile?.department;

        if (!hasAttendancePermission) {
          router.push("/");
          return;
        }

        setIsAdmin(isAdminUser);
        
        // 부서명 매핑
        const deptMapping: Record<string, string> = {
          "아동부": "유치부",
          "중고등부": "청소년부",
        };
        
        // 사용자의 부서 정보 설정
        if (!isAdminUser && profile?.department) {
          const mappedDept = deptMapping[profile.department] || profile.department;
          setUserDepartment(mappedDept);
        } else {
          setUserDepartment(null);
        }

        setHasPermission(true);

        // 출석체크 대상자 목록 불러오기 (부서 필터링)
        const { data: membersData, error: membersError } = await supabase
          .from("attendance_members")
          .select("*")
          .order("name", { ascending: true });

        if (membersError) {
          console.error("출석체크 대상자 조회 에러:", membersError);
        } else {
          // 부서 필터링
          const allMembers = (membersData as AttendanceMember[]) || [];
          if (!isAdminUser && userDepartment) {
            const filtered = allMembers.filter((m) => {
              const mappedDept = deptMapping[m.department || ""] || m.department;
              return mappedDept === userDepartment || m.department === userDepartment;
            });
            setMembers(filtered);
          } else if (department) {
            // 부서 페이지인 경우 해당 부서만 필터링
            const filtered = allMembers.filter((m) => {
              const mappedDept = deptMapping[m.department || ""] || m.department;
              return mappedDept === department || m.department === department;
            });
            setMembers(filtered);
          } else {
            setMembers(allMembers);
          }
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
  }, [router, currentWeekDates, department]);

  const toggleAttendance = async (memberId: string, date: string) => {
    const currentStatus = records[memberId]?.[date] || false;
    const newStatus = !currentStatus;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      const { error } = await supabase.from("attendance_records").upsert(
        {
          member_id: memberId,
          date: date,
          attended: newStatus,
        },
        {
          onConflict: "member_id,date",
        }
      );

      if (error) {
        console.error("출석 기록 저장 에러:", error);
        alert("출석 기록 저장 중 오류가 발생했습니다.");
        return;
      }

      setRecords((prev) => ({
        ...prev,
        [memberId]: {
          ...(prev[memberId] || {}),
          [date]: newStatus,
        },
      }));
    } catch (err: any) {
      console.error("출석 체크 에러:", err);
      alert("출석 체크 중 오류가 발생했습니다.");
    }
  };

  const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  };

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

  // 일요일 날짜 (오늘 날짜 기준)
  const sundayDate = currentWeekDates[0];

  // 부서명 매핑
  const deptMapping: Record<string, string> = {
    "아동부": "유치부",
    "중고등부": "청소년부",
  };

  // 표시할 부서명
  const displayDepartment = userDepartment || department;

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
            {displayDepartment} 출석체크
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            일요일 출석체크 ({sundayDate && formatDate(sundayDate)})
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/attendance"
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#374151",
              fontWeight: 500,
              fontSize: 13,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            통계 보기
          </Link>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          padding: "20px",
        }}
      >
        {members.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            출석체크 대상자가 없습니다. 명단 관리에서 추가해주세요.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {members.map((member) => {
              const attended = records[member.id]?.[sundayDate] === true;
              return (
                <button
                  key={member.id}
                  onClick={() => toggleAttendance(member.id, sundayDate)}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: attended ? "#3b82f6" : "#ffffff",
                    color: attended ? "#ffffff" : "#1f2937",
                    fontSize: 15,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    minWidth: 100,
                  }}
                  onMouseEnter={(e) => {
                    if (!attended) {
                      e.currentTarget.style.background = "#f3f4f6";
                      e.currentTarget.style.borderColor = "#d1d5db";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!attended) {
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }
                  }}
                >
                  {member.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

