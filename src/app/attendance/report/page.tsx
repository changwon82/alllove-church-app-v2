"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AttendanceMember = {
  id: string;
  name: string;
  department: string | null;
};

type AttendanceRecord = {
  id: string;
  member_id: string;
  date: string; // YYYY-MM-DD
  attended: boolean;
};

const departments = ["유치부", "유초등부", "청소년부", "청년부"];

// 주일 날짜 계산 (해당 주의 일요일)
const getSundayForDate = (date: Date): Date => {
  const dayOfWeek = date.getDay();
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
};

// 특정 연도의 모든 주일 날짜 리스트 반환
const getSundaysForYear = (year: number): string[] => {
  const sundays: string[] = [];
  const startDate = new Date(year, 0, 1); // 1월 1일
  const endDate = new Date(year, 11, 31); // 12월 31일

  // 첫 번째 일요일 찾기
  let currentDate = new Date(startDate);
  const firstSunday = getSundayForDate(currentDate);
  if (firstSunday < startDate) {
    firstSunday.setDate(firstSunday.getDate() + 7);
  }

  // 모든 주일 수집
  let sunday = new Date(firstSunday);
  while (sunday <= endDate) {
    const year = sunday.getFullYear();
    const month = String(sunday.getMonth() + 1).padStart(2, "0");
    const day = String(sunday.getDate()).padStart(2, "0");
    sundays.push(`${year}-${month}-${day}`);
    sunday.setDate(sunday.getDate() + 7);
  }

  return sundays;
};

export default function AttendanceReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, boolean>>>({});
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isAdmin, setIsAdmin] = useState(false);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const fixedTableRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLDivElement>(null);

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
        setHasPermission(true);

        // 부서명 매핑
        const deptMapping: Record<string, string> = {
          "아동부": "유치부",
          "중고등부": "청소년부",
        };

        // 사용자의 부서 정보 설정
        if (!isAdminUser && profile?.department) {
          const mappedDept = deptMapping[profile.department] || profile.department;
          setUserDepartment(mappedDept);
          setSelectedDepartment(mappedDept);
        } else {
          setUserDepartment(null);
          setSelectedDepartment(departments[0]); // 기본값: 첫 번째 부서
        }

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

        setLoading(false);
      } catch (err: any) {
        // 리프레시 토큰 에러 처리
        if (
          err?.message?.includes("Invalid Refresh Token") ||
          err?.message?.includes("Refresh Token Not Found") ||
          err?.status === 401
        ) {
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }
        console.error("데이터 로드 에러:", err);
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 선택된 부서와 연도에 해당하는 출석 기록 로드
  useEffect(() => {
    if (!selectedDepartment || !hasPermission) return;

    const loadRecords = async () => {
      // 선택된 연도의 모든 주일 날짜
      const sundays = getSundaysForYear(selectedYear);

      // 부서명 매핑
      const deptMapping: Record<string, string> = {
        "아동부": "유치부",
        "중고등부": "청소년부",
      };

      // 해당 부서의 멤버 필터링
      const deptMembers = members.filter((m) => {
        const mappedDept = deptMapping[m.department || ""] || m.department;
        return mappedDept === selectedDepartment || m.department === selectedDepartment;
      });

      if (deptMembers.length === 0) {
        setRecords({});
        return;
      }

      const memberIds = deptMembers.map((m) => m.id);

      // 해당 연도의 모든 주일 날짜에 대한 출석 기록 조회
      const { data: recordsData, error: recordsError } = await supabase
        .from("attendance_records")
        .select("*")
        .in("member_id", memberIds)
        .in("date", sundays);

      if (recordsError) {
        console.error("출석 기록 조회 에러:", recordsError);
        setRecords({});
        return;
      }

      // 기록을 member_id와 date 기준으로 매핑
      const recordsMap: Record<string, Record<string, boolean>> = {};
      (recordsData as AttendanceRecord[]).forEach((record) => {
        if (!recordsMap[record.member_id]) {
          recordsMap[record.member_id] = {};
        }
        recordsMap[record.member_id][record.date] = record.attended;
      });

      setRecords(recordsMap);
    };

    loadRecords();
  }, [selectedDepartment, selectedYear, members, hasPermission]);

  // 스크롤 동기화
  useEffect(() => {
    const fixedTable = fixedTableRef.current;
    const scrollTable = scrollTableRef.current;

    if (!fixedTable || !scrollTable || !hasPermission || !selectedDepartment) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target === fixedTable) {
        scrollTable.scrollTop = fixedTable.scrollTop;
      } else if (target === scrollTable) {
        fixedTable.scrollTop = scrollTable.scrollTop;
      }
    };

    fixedTable.addEventListener("scroll", handleScroll);
    scrollTable.addEventListener("scroll", handleScroll);

    return () => {
      fixedTable.removeEventListener("scroll", handleScroll);
      scrollTable.removeEventListener("scroll", handleScroll);
    };
  }, [hasPermission, selectedDepartment, members.length]);

  // 부서명 매핑
  const deptMapping: Record<string, string> = {
    "아동부": "유치부",
    "중고등부": "청소년부",
  };

  // 표시할 부서 목록 (관리자가 아니면 해당 부서만)
  const availableDepartments = useMemo(() => {
    if (userDepartment) {
      return [userDepartment];
    }
    return departments;
  }, [userDepartment]);

  // 선택된 부서의 멤버 목록
  const deptMembers = useMemo(() => {
    if (!selectedDepartment) return [];
    return members
      .filter((m) => {
        const mappedDept = deptMapping[m.department || ""] || m.department;
        return mappedDept === selectedDepartment || m.department === selectedDepartment;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, selectedDepartment]);

  // 선택된 연도의 모든 주일 날짜
  const sundays = useMemo(() => {
    return getSundaysForYear(selectedYear);
  }, [selectedYear]);

  // 오늘 날짜 기준으로 스크롤 위치 설정
  const lastScrolledYearRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hasPermission || !selectedDepartment || sundays.length === 0) return;

    // 오늘 날짜의 주일 찾기
    const today = new Date();
    const todaySunday = getSundayForDate(today);
    
    // 선택된 연도와 오늘 연도가 같을 때만 스크롤
    if (selectedYear !== today.getFullYear()) return;
    
    // 이미 이 연도로 스크롤했으면 다시 하지 않음
    if (lastScrolledYearRef.current === selectedYear) return;
    
    const todaySundayStr = `${todaySunday.getFullYear()}-${String(todaySunday.getMonth() + 1).padStart(2, "0")}-${String(todaySunday.getDate()).padStart(2, "0")}`;

    // 현재 연도의 주일 목록에서 오늘 주일의 인덱스 찾기
    const todayIndex = sundays.findIndex((sunday) => sunday === todaySundayStr);

    if (todayIndex === -1) return;

    // 약간의 지연을 두고 스크롤 (DOM 렌더링 완료 후)
    const scrollToToday = () => {
      const scrollTable = scrollTableRef.current;
      if (!scrollTable) return;

      // 테이블이 렌더링되었는지 확인
      const firstCell = scrollTable.querySelector('thead th:first-child') as HTMLElement;
      if (!firstCell) {
        // 아직 렌더링되지 않았으면 다시 시도
        requestAnimationFrame(() => {
          setTimeout(scrollToToday, 100);
        });
        return;
      }

      // 실제 셀 요소의 너비 측정
      const cellWidth = firstCell.offsetWidth || 55;
      const scrollPosition = Math.max(0, todayIndex * cellWidth - 300); // 왼쪽에 약간의 여백
      
      scrollTable.scrollLeft = scrollPosition;
      lastScrolledYearRef.current = selectedYear;
    };

    // 첫 번째 시도: requestAnimationFrame 사용
    requestAnimationFrame(() => {
      // 추가로 약간의 지연을 두어 테이블이 완전히 렌더링될 때까지 기다림
      setTimeout(scrollToToday, 300);
    });
  }, [hasPermission, selectedDepartment, sundays, selectedYear]);

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  // 주일별 출석률 계산
  const getAttendanceRate = (sunday: string) => {
    if (deptMembers.length === 0) return 0;
    let total = 0;
    let attended = 0;
    deptMembers.forEach((member) => {
      if (records[member.id]?.[sunday] !== undefined) {
        total++;
        if (records[member.id][sunday]) {
          attended++;
        }
      }
    });
    return total > 0 ? Math.round((attended / deptMembers.length) * 100) : 0;
  };

  // 연도 옵션 생성 (현재 연도 기준 ±5년)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let i = -2; i <= 2; i++) {
      years.push(currentYear + i);
    }
    return years;
  }, []);

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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0, marginBottom: 8 }}>
          {userDepartment ? `${userDepartment} 출석리포트` : "출석리포트"}
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
          부서별 1년치 출석 현황을 한눈에 확인할 수 있습니다.
        </p>
      </div>

      {/* 필터 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: "20px",
          border: "1px solid #e5e7eb",
          marginBottom: 20,
          display: "flex",
          gap: isMobile ? 8 : 20,
          alignItems: "center",
          flexWrap: isMobile ? "nowrap" : "wrap",
          overflowX: isMobile ? "auto" : "visible",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>부서</label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            disabled={!isAdmin && userDepartment !== null}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
              backgroundColor: "#ffffff",
              cursor: isAdmin || userDepartment === null ? "pointer" : "not-allowed",
              minWidth: isMobile ? 100 : 120,
              fontWeight: 500,
              color: "#1f2937",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (isAdmin || userDepartment === null) {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>연도</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  minWidth: isMobile ? 90 : 100,
                  fontWeight: 500,
                  color: "#1f2937",
                  transition: "all 0.2s ease",
                }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
        </div>

            {deptMembers.length > 0 && (
              <div
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  marginLeft: isMobile ? 0 : "auto",
                  padding: "6px 12px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: 6,
                  fontWeight: 500,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                총 <span style={{ color: "#3b82f6", fontWeight: 600 }}>{deptMembers.length}</span>명
              </div>
            )}
      </div>

          {/* 리포트 테이블 */}
          {selectedDepartment && (
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                width: "100%",
                maxWidth: "100%",
              }}
            >
              <div style={{ display: "flex", position: "relative", maxHeight: "75vh", width: "100%" }}>
            {/* 고정 컬럼 (번호, 이름) */}
            <div
              ref={fixedTableRef}
              style={{
                flexShrink: 0,
                borderRight: "1px solid #e2e8f0",
                zIndex: 10,
                overflowY: "auto",
                maxHeight: "75vh",
              }}
            >
              <table style={{ borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed", borderSpacing: 0 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        fontWeight: 600,
                        color: "#6b7280",
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#f9fafb",
                        width: "50px",
                        fontSize: 12,
                      }}
                    >
                      번호
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#6b7280",
                        border: "1px solid #e5e7eb",
                        borderLeft: "none",
                        backgroundColor: "#f9fafb",
                        fontSize: 12,
                      }}
                    >
                      이름
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deptMembers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          padding: "40px 20px",
                          textAlign: "center",
                          color: "#9ca3af",
                          fontSize: 14,
                          border: "1px solid #e5e7eb",
                          borderTop: "none",
                        }}
                      >
                        해당 부서의 출석체크 대상자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* 출석률 행 */}
                      <tr style={{ backgroundColor: "#eff6ff" }}>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontWeight: 700,
                            color: "#1e40af",
                            border: "1px solid #e5e7eb",
                            borderTop: "none",
                            backgroundColor: "#eff6ff",
                            borderBottom: "2px solid #e5e7eb",
                            fontSize: 12,
                          }}
                        >
                          -
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: "#1e40af",
                            border: "1px solid #e5e7eb",
                            borderTop: "none",
                            borderLeft: "none",
                            backgroundColor: "#eff6ff",
                            borderBottom: "2px solid #e5e7eb",
                            fontSize: 12,
                          }}
                        >
                          출석률
                        </td>
                      </tr>
                      {/* 멤버별 행 */}
                      {deptMembers.map((member, index) => (
                        <tr
                          key={member.id}
                          style={{
                            transition: "background-color 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                          }}
                        >
                          <td
                            style={{
                              padding: "4px 8px",
                              textAlign: "center",
                              color: "#6b7280",
                              border: "1px solid #e5e7eb",
                              borderTop: "none",
                              backgroundColor: "inherit",
                              fontSize: 13,
                            }}
                          >
                            {index + 1}
                          </td>
                          <td
                            style={{
                              padding: "4px 8px",
                              color: "#1f2937",
                              border: "1px solid #e5e7eb",
                              borderTop: "none",
                              borderLeft: "none",
                              backgroundColor: "inherit",
                              fontSize: 13,
                            }}
                          >
                            {member.name}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* 스크롤 가능한 날짜 컬럼 */}
            <div
              ref={scrollTableRef}
              style={{
                overflowX: "auto",
                overflowY: "auto",
                flex: 1,
                maxHeight: "75vh",
                width: 0, // flex: 1과 함께 사용하여 남은 공간 차지
              }}
            >
              <table style={{ borderCollapse: "collapse", fontSize: 12, width: sundays.length > 0 ? `${sundays.length * 45}px` : "auto", tableLayout: "fixed", borderSpacing: 0 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    {sundays.map((sunday) => (
                      <th
                        key={sunday}
                        style={{
                          padding: "10px 8px",
                          textAlign: "center",
                          fontWeight: 600,
                          color: "#6b7280",
                          border: "1px solid #e5e7eb",
                          borderLeft: "none",
                          backgroundColor: "#f9fafb",
                          fontSize: 12,
                          minWidth: "45px",
                          whiteSpace: "nowrap",
                        }}
                        title={sunday}
                      >
                        {formatDate(sunday)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deptMembers.length === 0 ? null : (
                    <>
                      {/* 출석률 행 */}
                      <tr style={{ backgroundColor: "#eff6ff" }}>
                        {sundays.map((sunday) => {
                          const rate = getAttendanceRate(sunday);
                          const getColor = () => {
                            if (rate >= 80) return "#059669";
                            if (rate >= 60) return "#d97706";
                            return "#dc2626";
                          };
                          const getBgColor = () => {
                            if (rate >= 80) return "#d1fae5";
                            if (rate >= 60) return "#fef3c7";
                            return "#fee2e2";
                          };
                          return (
                            <td
                              key={sunday}
                              style={{
                                padding: "10px 8px",
                                textAlign: "center",
                                fontWeight: 700,
                                color: getColor(),
                                fontSize: 12,
                                border: "1px solid #e5e7eb",
                                borderTop: "none",
                                borderLeft: "none",
                                backgroundColor: getBgColor(),
                                borderBottom: "2px solid #e5e7eb",
                              }}
                            >
                              {rate}%
                            </td>
                          );
                        })}
                      </tr>
                      {/* 멤버별 행 */}
                      {deptMembers.map((member, index) => (
                        <tr
                          key={member.id}
                          style={{
                            transition: "background-color 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                          }}
                        >
                          {sundays.map((sunday) => {
                            const attended = records[member.id]?.[sunday] === true;
                            const checked = records[member.id]?.[sunday] !== undefined;
                            return (
                              <td
                                key={sunday}
                                style={{
                                  padding: "4px 5px",
                                  textAlign: "center",
                                  backgroundColor: attended
                                    ? "#d1fae5"
                                    : checked
                                    ? "#fee2e2"
                                    : "inherit",
                                  border: "1px solid #e5e7eb",
                                  borderTop: "none",
                                  borderLeft: "none",
                                  fontSize: 13,
                                  color: attended ? "#059669" : checked ? "#dc2626" : "#9ca3af",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  if (checked) {
                                    e.currentTarget.style.opacity = "0.8";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = "1";
                                }}
                              >
                                {checked ? (attended ? "✓" : "✗") : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

