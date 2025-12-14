"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type StatusPrayerItem = {
  id: string;
  date: string;
  member_id: string;
  member_name: string;
  department: string | null;
  status_prayer: string;
  created_at: string;
};

const departments = ["유치부", "유초등부", "청소년부", "청년부"];

export default function StatusPrayersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [statusPrayerList, setStatusPrayerList] = useState<StatusPrayerItem[]>([]);
  const [allStatusPrayerList, setAllStatusPrayerList] = useState<StatusPrayerItem[]>([]); // 필터링 전 전체 데이터
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

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
          .select("role, attendance_permission, department")
          .eq("id", user.id)
          .maybeSingle();

        const isAdminUser = profile?.role === "admin";
        const hasAttendancePermission = isAdminUser || profile?.attendance_permission === true;

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
        setLoading(false);
      } catch (err: any) {
        console.error("데이터 로드 에러:", err);
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 현황&기도제목 목록 로드
  useEffect(() => {
    if (!hasPermission) return;
    
    const loadStatusPrayerList = async () => {
    try {
      // status_prayer가 있는 레코드 조회
      const { data: recordsData, error: recordsError } = await supabase
        .from("attendance_records")
        .select("id, date, member_id, status_prayer, created_at")
        .not("status_prayer", "is", null)
        .neq("status_prayer", "")
        .order("created_at", { ascending: false });

      if (recordsError) {
        console.error("현황&기도제목 목록 조회 에러:", recordsError);
        return;
      }

      if (!recordsData || recordsData.length === 0) {
        setStatusPrayerList([]);
        return;
      }

      // member_id 목록 추출
      const memberIds = [...new Set(recordsData.map((r: any) => r.member_id))];
      
      // 멤버 이름 및 부서 조회
      const { data: membersData, error: membersError } = await supabase
        .from("attendance_members")
        .select("id, name, department")
        .in("id", memberIds);

      if (membersError) {
        console.error("멤버 이름 조회 에러:", membersError);
        return;
      }

      // member_id -> name, department 매핑 생성
      const memberNameMap = new Map<string, string>();
      const memberDeptMap = new Map<string, string | null>();
      (membersData || []).forEach((m: any) => {
        memberNameMap.set(m.id, m.name);
        memberDeptMap.set(m.id, m.department);
      });

      // 부서명 매핑
      const deptMapping: Record<string, string> = {
        "아동부": "유치부",
        "중고등부": "청소년부",
      };

      // 레코드와 멤버 정보 결합
      let items: StatusPrayerItem[] = recordsData.map((record: any) => {
        const dept = memberDeptMap.get(record.member_id);
        const mappedDept = dept ? (deptMapping[dept] || dept) : null;
        return {
          id: record.id,
          date: record.date,
          member_id: record.member_id,
          member_name: memberNameMap.get(record.member_id) || "",
          department: mappedDept,
          status_prayer: record.status_prayer,
          created_at: record.created_at,
        };
      });

      // 전체 데이터 저장 (배지 계산용)
      setAllStatusPrayerList(items);

      // 부서별 필터링
      const filterDepartment = isAdmin ? selectedDepartment : userDepartment;
      let filteredItems = items;
      if (filterDepartment) {
        filteredItems = items.filter((item) => item.department === filterDepartment);
      }

      setStatusPrayerList(filteredItems);
    } catch (err: any) {
      console.error("현황&기도제목 목록 로드 에러:", err);
    }
    };

    loadStatusPrayerList();
  }, [hasPermission, userDepartment, isAdmin, selectedDepartment]);

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

  const displayDepartment = isAdmin ? null : userDepartment;

  // 이번 주 날짜 범위 계산
  const getCurrentWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      weekDates.push(`${year}-${month}-${day}`);
    }
    return weekDates;
  };

  const currentWeekDates = getCurrentWeekDates();

  // 날짜가 이번 주인지 확인
  const isThisWeek = (dateStr: string) => {
    return currentWeekDates.includes(dateStr);
  };

  // 부서별 이번 주 작성 개수 계산 (전체 데이터 기반)
  const getThisWeekCountByDepartment = (dept: string | null) => {
    const filtered = dept 
      ? allStatusPrayerList.filter((item) => item.department === dept && isThisWeek(item.date))
      : allStatusPrayerList.filter((item) => isThisWeek(item.date));
    return filtered.length;
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", margin: 0 }}>
          {displayDepartment ? `${displayDepartment} 현황&기도제목` : "현황&기도제목"}
        </h1>
      </div>

      {/* 관리자용 부서 탭 */}
      {isAdmin && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, borderBottom: "2px solid #e5e7eb" }}>
          <button
            onClick={() => setSelectedDepartment(null)}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              color: selectedDepartment === null ? "#2563eb" : "#6b7280",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: selectedDepartment === null ? "2px solid #2563eb" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -2,
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            전체
            {(() => {
              const count = getThisWeekCountByDepartment(null);
              return count > 0 ? (
                <span
                  style={{
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "50%",
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>
              ) : null;
            })()}
          </button>
          {departments.map((dept) => {
            const count = getThisWeekCountByDepartment(dept);
            return (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: selectedDepartment === dept ? "#2563eb" : "#6b7280",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: selectedDepartment === dept ? "2px solid #2563eb" : "2px solid transparent",
                  cursor: "pointer",
                  marginBottom: -2,
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {dept}
                {count > 0 && (
                  <span
                    style={{
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          padding: 16,
        }}
      >
        {statusPrayerList.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            작성된 현황&기도제목이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <colgroup>
                <col style={{ width: "auto" }} />
                {isAdmin && <col style={{ width: "auto" }} />}
                <col style={{ width: "auto" }} />
                <col style={{ width: "100%" }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th
                    style={{
                      padding: "8px 6px",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#6b7280",
                      whiteSpace: "nowrap",
                    }}
                  >
                    날짜
                  </th>
                  {isAdmin && (
                    <th
                      style={{
                        padding: "8px 6px",
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#6b7280",
                        whiteSpace: "nowrap",
                      }}
                    >
                      부서
                    </th>
                  )}
                  <th
                    style={{
                      padding: "8px 6px",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#6b7280",
                      whiteSpace: "nowrap",
                    }}
                  >
                    이름
                  </th>
                  <th
                    style={{
                      padding: "8px 6px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#6b7280",
                    }}
                  >
                    내용
                  </th>
                </tr>
              </thead>
              <tbody>
                {statusPrayerList.map((item) => {
                  const isCurrentWeek = isThisWeek(item.date);
                  return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 6px",
                        color: "#374151",
                        whiteSpace: "nowrap",
                        textAlign: "center",
                      }}
                    >
                      {(() => {
                        const date = new Date(item.date);
                        const year = String(date.getFullYear()).slice(-2); // 마지막 2자리
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const day = String(date.getDate()).padStart(2, "0");
                        return `${year}${month}${day}`;
                      })()}
                    </td>
                    {isAdmin && (
                      <td
                        style={{
                          padding: "8px 6px",
                          color: "#374151",
                          whiteSpace: "nowrap",
                          textAlign: "center",
                        }}
                      >
                        {item.department || "-"}
                      </td>
                    )}
                    <td
                      style={{
                        padding: "8px 6px",
                        color: "#1f2937",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        textAlign: "center",
                      }}
                    >
                      {item.member_name}
                    </td>
                    <td
                      style={{
                        padding: "8px 6px",
                        color: isCurrentWeek ? "#2563eb" : "#374151",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        textAlign: "left",
                      }}
                    >
                      {item.status_prayer}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
