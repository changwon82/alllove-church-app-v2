"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  date: string; // YYYY-MM-DD
  attended: boolean;
  created_at: string;
};

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, boolean>>>({}); // {member_id: {date: attended}}
  const [currentWeekDates, setCurrentWeekDates] = useState<string[]>([]);

  // 이번 주일 날짜들 계산 (일요일 기준)
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = 일요일, 1 = 월요일, ...
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek); // 이번 주 일요일
    
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

        setIsAdmin(isAdminUser);
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

  const toggleAttendance = async (memberId: string, date: string) => {
    const currentStatus = records[memberId]?.[date] || false;
    const newStatus = !currentStatus;

    try {
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

      // 로컬 상태 업데이트
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

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
            출석체크
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            이번 주일 ({currentWeekDates[0]} ~ {currentWeekDates[6]})
          </p>
        </div>
        <a
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
        </a>
      </div>

      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    position: "sticky",
                    left: 0,
                    backgroundColor: "#f9fafb",
                    zIndex: 10,
                  }}
                >
                  이름
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    minWidth: 60,
                  }}
                >
                  성별
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    minWidth: 80,
                  }}
                >
                  생년월일
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    minWidth: 60,
                  }}
                >
                  나이
                </th>
                {currentWeekDates.map((date) => (
                  <th
                    key={date}
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#374151",
                      borderBottom: "1px solid #e5e7eb",
                      minWidth: 100,
                    }}
                  >
                    {formatDate(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td
                    colSpan={4 + currentWeekDates.length}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "#9ca3af",
                      fontSize: 14,
                    }}
                  >
                    출석체크 대상자가 없습니다. 명단 관리에서 추가해주세요.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const age = calculateAge(member.birth_date);
                  return (
                    <tr
                      key={member.id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: 500,
                          color: "#1f2937",
                          position: "sticky",
                          left: 0,
                          backgroundColor: "#ffffff",
                          zIndex: 5,
                        }}
                      >
                        {member.name}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#374151" }}>
                        {member.gender || "-"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#374151" }}>
                        {member.birth_date
                          ? new Date(member.birth_date).toLocaleDateString("ko-KR")
                          : "-"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#374151" }}>
                        {age !== null ? `${age}세` : "-"}
                      </td>
                      {currentWeekDates.map((date) => {
                        const attended = records[member.id]?.[date] || false;
                        return (
                          <td
                            key={date}
                            style={{
                              padding: "12px",
                              textAlign: "center",
                            }}
                          >
                            <button
                              onClick={() => toggleAttendance(member.id, date)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 4,
                                border: "1px solid #e5e7eb",
                                background: attended ? "#10b981" : "#ffffff",
                                color: attended ? "#ffffff" : "#374151",
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                minWidth: 60,
                              }}
                              onMouseEnter={(e) => {
                                if (!attended) {
                                  e.currentTarget.style.background = "#f3f4f6";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!attended) {
                                  e.currentTarget.style.background = "#ffffff";
                                }
                              }}
                            >
                              {attended ? "출석" : "결석"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

