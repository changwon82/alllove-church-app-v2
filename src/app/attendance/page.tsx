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

const departments = ["유치부", "유초등부", "청소년부", "청년부"];

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, boolean>>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentWeekDates, setCurrentWeekDates] = useState<string[]>([]);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersForModal, setMembersForModal] = useState<AttendanceMember[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [singleFormData, setSingleFormData] = useState({
    name: "",
    gender: "",
    birth_date: "",
  });
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    gender: "",
    birth_date: "",
    department: "",
  });
  const [selectedDepartmentInModal, setSelectedDepartmentInModal] = useState<string | null>(null);
  const [managerSelectedSunday, setManagerSelectedSunday] = useState<string | null>(null);
  const [adminSelectedSunday, setAdminSelectedSunday] = useState<string | null>(null);

  // 날짜 계산 헬퍼 함수들
  const getSundayForDate = (date: Date): string => {
    const dayOfWeek = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - dayOfWeek);
    const year = sunday.getFullYear();
    const month = String(sunday.getMonth() + 1).padStart(2, "0");
    const day = String(sunday.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getWeekDatesForSunday = (sundayStr: string): string[] => {
    const sunday = new Date(sundayStr);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  };

  const getPreviousSunday = (currentSunday: string): string => {
    const date = new Date(currentSunday);
    date.setDate(date.getDate() - 7);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getNextSunday = (currentSunday: string): string => {
    const date = new Date(currentSunday);
    date.setDate(date.getDate() + 7);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isCurrentWeek = (sundayStr: string): boolean => {
    const today = new Date();
    const currentSundayStr = getSundayForDate(today);
    return sundayStr === currentSundayStr;
  };

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
        
        // 부서명 매핑 (데이터베이스에 저장된 이름 -> 화면에 표시할 이름)
        const deptMapping: Record<string, string> = {
          "아동부": "유치부",
          "중고등부": "청소년부",
        };
        
        // 사용자의 부서 정보 설정 (관리자가 아니면 해당 부서만 표시)
        if (!isAdminUser && profile?.department) {
          const mappedDept = deptMapping[profile.department] || profile.department;
          setUserDepartment(mappedDept);
        } else {
          setUserDepartment(null);
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

        // 출석 기록 불러오기 (최근 8주분 로드)
        const today = new Date();
        const currentSunday = getSundayForDate(today);
        const datesToLoad: string[] = [];
        
        // 최근 8주간의 날짜들 수집
        for (let weekOffset = 0; weekOffset < 8; weekOffset++) {
          const sunday = new Date(currentSunday);
          sunday.setDate(new Date(currentSunday).getDate() - (weekOffset * 7));
          const weekDates = getWeekDatesForSunday(getSundayForDate(sunday));
          datesToLoad.push(...weekDates);
        }

        // 중복 제거
        const uniqueDates = [...new Set(datesToLoad)];

        const { data: recordsData, error: recordsError } = await supabase
          .from("attendance_records")
          .select("*")
          .in("date", uniqueDates);

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

  // 통계 계산
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // 이번 주 평균 출석률
    let weekTotalAttended = 0;
    let weekTotalDays = 0;
    // 관리자는 선택한 날짜, 부서담당자는 선택한 날짜, 없으면 현재 주 일요일 사용
    const sundayDate = isAdmin 
      ? (adminSelectedSunday || currentWeekDates[0])
      : (!isAdmin && userDepartment && managerSelectedSunday) 
      ? managerSelectedSunday 
      : currentWeekDates[0];

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
  }, [members, records, currentWeekDates, profiles, isAdmin, userDepartment, managerSelectedSunday, adminSelectedSunday]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${month}/${day} (${weekday})`;
  };

  const toggleAttendance = async (memberId: string, date: string) => {
    const currentStatus = records[memberId]?.[date] || false;
    const newStatus = !currentStatus;

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
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
      console.error("출석 체크 에러:", err);
      alert("출석 체크 중 오류가 발생했습니다.");
    }
  };

  const loadMembersForModal = async () => {
    const { data: membersData, error: membersError } = await supabase
      .from("attendance_members")
      .select("*")
      .order("name", { ascending: true });

    if (membersError) {
      console.error("출석체크 대상자 조회 에러:", membersError);
    } else {
      setMembersForModal((membersData as AttendanceMember[]) || []);
    }
  };

  const handleSingleAdd = async () => {
    if (!singleFormData.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    setSavingMember(true);

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
        setSavingMember(false);
        return;
      }

      if (!user) {
        alert("로그인이 필요합니다.");
        setSavingMember(false);
        return;
      }

      const { error } = await supabase.from("attendance_members").insert({
        name: singleFormData.name.trim(),
        gender: singleFormData.gender || null,
        birth_date: singleFormData.birth_date || null,
        department: "청년부",
        created_by: user.id,
      });

      if (error) {
        console.error("추가 에러:", error);
        alert("추가 중 오류가 발생했습니다.");
        setSavingMember(false);
        return;
      }

      await loadMembersForModal();
      setSingleFormData({ name: "", gender: "", birth_date: "" });
      alert("추가되었습니다.");
    } catch (err: any) {
      // 리프레시 토큰 에러 처리
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found") ||
        err?.status === 401
      ) {
        await supabase.auth.signOut();
        router.push("/login");
        setSavingMember(false);
        return;
      }
      console.error("저장 에러:", err);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSavingMember(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    setSavingMember(true);

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
        setSavingMember(false);
        return;
      }

      if (!user) {
        alert("로그인이 필요합니다.");
        setSavingMember(false);
        return;
      }

      // 한 줄에 하나씩 이름 입력 (줄바꿈으로 구분)
      const names = bulkInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (names.length === 0) {
        alert("이름을 입력해주세요.");
        setSavingMember(false);
        return;
      }

      // 청년부로 자동 지정하여 일괄 추가
      const newMembers = names.map((name) => ({
        name,
        department: "청년부",
        created_by: user.id,
      }));

      const { error } = await supabase.from("attendance_members").insert(newMembers);

      if (error) {
        console.error("추가 에러:", error);
        alert("추가 중 오류가 발생했습니다.");
        setSavingMember(false);
        return;
      }

      await loadMembersForModal();
      setBulkInput("");
      setShowAddForm(false);
      alert(`${names.length}명이 추가되었습니다.`);
    } catch (err: any) {
      // 리프레시 토큰 에러 처리
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found") ||
        err?.status === 401
      ) {
        await supabase.auth.signOut();
        router.push("/login");
        setSavingMember(false);
        return;
      }
      console.error("저장 에러:", err);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSavingMember(false);
    }
  };

  const handleEditMember = (member: AttendanceMember) => {
    setEditingMemberId(member.id);
    setEditFormData({
      name: member.name,
      gender: member.gender || "",
      birth_date: member.birth_date || "",
      department: member.department || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setEditFormData({ name: "", gender: "", birth_date: "", department: "" });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editFormData.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    setSavingMember(true);

    try {
      const { error } = await supabase
        .from("attendance_members")
        .update({
          name: editFormData.name.trim(),
          gender: editFormData.gender || null,
          birth_date: editFormData.birth_date || null,
          department: editFormData.department || null,
        })
        .eq("id", id);

      if (error) {
        console.error("수정 에러:", error);
        alert("수정 중 오류가 발생했습니다.");
        setSavingMember(false);
        return;
      }

      await loadMembersForModal();
      handleCancelEdit();
      alert("수정되었습니다.");
    } catch (err: any) {
      console.error("수정 에러:", err);
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`"${name}"을(를) 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase.from("attendance_members").delete().eq("id", id);

      if (error) {
        console.error("삭제 에러:", error);
        alert("삭제 중 오류가 발생했습니다.");
        return;
      }

      await loadMembersForModal();
      alert("삭제되었습니다.");
    } catch (err: any) {
      console.error("삭제 에러:", err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleFillEmptyFields = async () => {
    if (!confirm("비어있는 값들을 임의로 채우시겠습니까?")) {
      return;
    }

    setSavingMember(true);

    try {
      // 부서명 매핑
      const deptMapping: Record<string, string> = {
        "아동부": "유치부",
        "중고등부": "청소년부",
      };

      // 비어있는 필드가 있는 명단 필터링
      const membersToUpdate = membersForModal.filter((m) => {
        const mappedDept = deptMapping[m.department || ""] || m.department;
        const displayDept = userDepartment
          ? mappedDept === userDepartment || m.department === userDepartment
          : true;
        return displayDept && (!m.gender || !m.birth_date || !m.department);
      });

      if (membersToUpdate.length === 0) {
        alert("채울 비어있는 값이 없습니다.");
        setSavingMember(false);
        return;
      }

      // 각 명단의 비어있는 필드 업데이트
      const updatePromises = membersToUpdate.map(async (member) => {
        const updates: {
          gender?: string;
          birth_date?: string;
          department?: string;
        } = {};

        // 성별이 비어있으면 랜덤 선택
        if (!member.gender) {
          updates.gender = Math.random() < 0.5 ? "남" : "여";
        }

        // 생년월일이 비어있으면 1990~2010 사이 랜덤 날짜
        if (!member.birth_date) {
          const year = Math.floor(Math.random() * 21) + 1990; // 1990~2010
          const month = Math.floor(Math.random() * 12) + 1;
          const day = Math.floor(Math.random() * 28) + 1; // 28일까지만
          updates.birth_date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }

        // 부서가 비어있으면 청년부로 설정
        if (!member.department) {
          updates.department = "청년부";
        }

        if (Object.keys(updates).length > 0) {
          return supabase.from("attendance_members").update(updates).eq("id", member.id);
        }
        return null;
      });

      await Promise.all(updatePromises.filter(Boolean));
      await loadMembersForModal();
      alert(`${membersToUpdate.length}명의 비어있는 값이 채워졌습니다.`);
    } catch (err: any) {
      console.error("업데이트 에러:", err);
      alert("업데이트 중 오류가 발생했습니다.");
    } finally {
      setSavingMember(false);
    }
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
  
  // 부서담당자용 선택된 일요일 (없으면 현재 주 일요일)
  const managerSundayDate = managerSelectedSunday || sundayDate;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {userDepartment ? (
            <>
              {userDepartment} 출석체크
              {(() => {
                const deptMapping: Record<string, string> = {
                  "아동부": "유치부",
                  "중고등부": "청소년부",
                };
                const deptStats = stats.byDepartment[userDepartment];
                if (deptStats?.manager) {
                  return (
                    <span style={{ fontSize: 14, fontWeight: 400, color: "#6b7280" }}>
                      (담당: {deptStats.manager.name}{deptStats.manager.position ? ` ${deptStats.manager.position}` : ""})
                    </span>
                  );
                }
                return null;
              })()}
            </>
          ) : (
            "출석체크"
          )}
        </h1>
      </div>

      {/* 관리자용 날짜 변경 */}
      {isAdmin && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <input
            type="date"
            id="admin-date-picker"
            max={(() => {
              const today = new Date();
              const currentSunday = getSundayForDate(today);
              return currentSunday;
            })()}
            style={{
              position: "absolute",
              opacity: 0,
              pointerEvents: "none",
              width: 0,
              height: 0,
            }}
            onChange={(e) => {
              if (e.target.value) {
                const selectedDate = new Date(e.target.value);
                const selectedSunday = getSundayForDate(selectedDate);
                setAdminSelectedSunday(selectedSunday);
                e.target.value = "";
              }
            }}
          />
          <button
            onClick={() => {
              const displayDate = adminSelectedSunday || sundayDate;
              if (displayDate) {
                setAdminSelectedSunday(getPreviousSunday(displayDate));
              }
            }}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#374151",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ◀
          </button>
          {(() => {
            const displayDate = adminSelectedSunday || sundayDate;
            if (!displayDate) return null;
            const date = new Date(displayDate);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return (
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1f2937",
                  margin: 0,
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 4,
                  transition: "background-color 0.2s ease",
                }}
                onClick={() => {
                  const dateInput = document.getElementById("admin-date-picker") as HTMLInputElement;
                  if (dateInput && dateInput.showPicker) {
                    dateInput.showPicker();
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {isCurrentWeek(displayDate) ? "이번 주일" : "주일"}({month}/{day})
              </h3>
            );
          })()}
          <button
            onClick={() => {
              const displayDate = adminSelectedSunday || sundayDate;
              if (displayDate) {
                const nextSunday = getNextSunday(displayDate);
                const today = new Date();
                if (new Date(nextSunday) <= today) {
                  setAdminSelectedSunday(nextSunday);
                }
              }
            }}
            disabled={(() => {
              const displayDate = adminSelectedSunday || sundayDate;
              return displayDate ? new Date(getNextSunday(displayDate)) > new Date() : false;
            })()}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: (() => {
                const displayDate = adminSelectedSunday || sundayDate;
                return displayDate && new Date(getNextSunday(displayDate)) > new Date() ? "#f3f4f6" : "#ffffff";
              })(),
              color: (() => {
                const displayDate = adminSelectedSunday || sundayDate;
                return displayDate && new Date(getNextSunday(displayDate)) > new Date() ? "#9ca3af" : "#374151";
              })(),
              fontSize: 14,
              cursor: (() => {
                const displayDate = adminSelectedSunday || sundayDate;
                return displayDate && new Date(getNextSunday(displayDate)) > new Date() ? "not-allowed" : "pointer";
              })(),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ▶
          </button>
          {adminSelectedSunday && !isCurrentWeek(adminSelectedSunday) && (
            <button
              onClick={() => {
                const today = new Date();
                setAdminSelectedSunday(getSundayForDate(today));
              }}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid #3b82f6",
                background: "#ffffff",
                color: "#3b82f6",
                fontSize: 12,
                cursor: "pointer",
                marginLeft: 8,
              }}
            >
              이번 주
            </button>
          )}
        </div>
      )}

      {/* 주요 통계 카드 (관리자만) */}
      {isAdmin && (
        <>
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

          {/* 부서별 이번 주 출석 현황 (관리자만) */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 8,
              padding: "16px",
              border: "1px solid #e5e7eb",
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", margin: 0, marginBottom: 16 }}>
              부서별 이번 주 출석 현황
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {departments.map((dept, index) => {
                const deptStats = stats.byDepartment[dept];
                const rate = deptStats && deptStats.total > 0 ? Math.round((deptStats.attended / deptStats.total) * 100) : 0;
                return (
                  <div
                    key={dept}
                    style={{
                      padding: "12px 16px",
                      borderBottom: index < departments.length - 1 ? "1px solid #e5e7eb" : "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 80 }}>
                      {dept}
                    </div>
                    {deptStats?.manager && (
                      <div style={{ fontSize: 13, color: "#6b7280", minWidth: 150 }}>
                        (담당: {deptStats.manager.name}{deptStats.manager.position ? ` ${deptStats.manager.position}` : ""})
                      </div>
                    )}
                    {deptStats ? (
                      <>
                        <div style={{ fontSize: 14, color: "#1f2937", marginLeft: "auto" }}>
                          {deptStats.attended}/{deptStats.total}명
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: rate >= 80 ? "#10b981" : rate >= 60 ? "#f59e0b" : "#ef4444", minWidth: 50, textAlign: "right" }}>
                          {rate}%
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 14, color: "#9ca3af", marginLeft: "auto" }}>데이터 없음</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 부서담당자용 출석체크 */}
      {!isAdmin && userDepartment && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "20px",
            border: "1px solid #e5e7eb",
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <input
                type="date"
                id="manager-date-picker"
                max={(() => {
                  const today = new Date();
                  const currentSunday = getSundayForDate(today);
                  return currentSunday;
                })()}
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "none",
                  width: 0,
                  height: 0,
                }}
                onChange={(e) => {
                  if (e.target.value) {
                    const selectedDate = new Date(e.target.value);
                    const selectedSunday = getSundayForDate(selectedDate);
                    setManagerSelectedSunday(selectedSunday);
                    e.target.value = "";
                  }
                }}
              />
              <button
                onClick={() => {
                  if (managerSundayDate) {
                    setManagerSelectedSunday(getPreviousSunday(managerSundayDate));
                  }
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ◀
              </button>
              {managerSundayDate && (() => {
                const date = new Date(managerSundayDate);
                const month = date.getMonth() + 1;
                const day = date.getDate();
                return (
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#1f2937",
                      margin: 0,
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: 4,
                      transition: "background-color 0.2s ease",
                    }}
                    onClick={() => {
                      const dateInput = document.getElementById("manager-date-picker") as HTMLInputElement;
                      if (dateInput && dateInput.showPicker) {
                        dateInput.showPicker();
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {isCurrentWeek(managerSundayDate) ? "이번 주일" : "주일"}({month}/{day})
                  </h2>
                );
              })()}
              <button
                onClick={() => {
                  if (managerSundayDate) {
                    const nextSunday = getNextSunday(managerSundayDate);
                    const today = new Date();
                    if (new Date(nextSunday) <= today) {
                      setManagerSelectedSunday(nextSunday);
                    }
                  }
                }}
                disabled={managerSundayDate ? new Date(getNextSunday(managerSundayDate)) > new Date() : false}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: managerSundayDate && new Date(getNextSunday(managerSundayDate)) > new Date() ? "#f3f4f6" : "#ffffff",
                  color: managerSundayDate && new Date(getNextSunday(managerSundayDate)) > new Date() ? "#9ca3af" : "#374151",
                  fontSize: 14,
                  cursor: managerSundayDate && new Date(getNextSunday(managerSundayDate)) > new Date() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ▶
              </button>
              {managerSundayDate && !isCurrentWeek(managerSundayDate) && (
                <button
                  onClick={() => {
                    const today = new Date();
                    setManagerSelectedSunday(getSundayForDate(today));
                  }}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "1px solid #3b82f6",
                    background: "#ffffff",
                    color: "#3b82f6",
                    fontSize: 12,
                    cursor: "pointer",
                    marginLeft: 8,
                  }}
                >
                  이번 주
                </button>
              )}
              {(() => {
                // 부서명 매핑
                const deptMapping: Record<string, string> = {
                  "아동부": "유치부",
                  "중고등부": "청소년부",
                };
                const deptStats = stats.byDepartment[userDepartment || ""];
                if (deptStats) {
                  const rate = deptStats.total > 0 ? Math.round((deptStats.attended / deptStats.total) * 100) : 0;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
                      <span style={{ fontSize: 14, color: "#1f2937" }}>{deptStats.attended}/{deptStats.total}명</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>{rate}%</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          {(() => {
            // 부서명 매핑
            const deptMapping: Record<string, string> = {
              "아동부": "유치부",
              "중고등부": "청소년부",
            };

            // 담당 부서의 명단 필터링 및 가나다순 정렬
            const deptMembers = members
              .filter((m) => {
                const mappedDept = deptMapping[m.department || ""] || m.department;
                return mappedDept === userDepartment || m.department === userDepartment;
              })
              .sort((a, b) => a.name.localeCompare(b.name));

            if (deptMembers.length === 0) {
              return (
                <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  출석체크 대상자가 없습니다. 명단 관리에서 추가해주세요.
                </div>
              );
            }

            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {deptMembers.map((member) => {
                  const attended = records[member.id]?.[managerSundayDate] === true;
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleAttendance(member.id, managerSundayDate)}
                      style={{
                        padding: "2px 2px",
                        borderRadius: 8,
                        border: `1px solid ${attended ? "#3b82f6" : "#e5e7eb"}`,
                        background: attended ? "#3b82f6" : "#ffffff",
                        color: attended ? "#ffffff" : "#1f2937",
                        fontSize: 15,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
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
            );
          })()}
        </div>
      )}

      {/* 교회학교 출석현황 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "16px",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          {(() => {
            // 부서명 매핑 (데이터베이스에 저장된 이름 -> 화면에 표시할 이름)
            const deptMapping: Record<string, string> = {
              "아동부": "유치부",
              "중고등부": "청소년부",
            };
            
            // 표시할 부서 목록 필터링 (관리자가 아니면 해당 부서만)
            const displayDepartments = userDepartment 
              ? departments.filter(dept => dept === userDepartment)
              : departments;
            
            return displayDepartments.map((dept, index) => {
              const deptStats = stats.byDepartment[dept];
              const rate = deptStats.total > 0 ? Math.round((deptStats.attended / deptStats.total) * 100) : 0;
              
              // 해당 부서의 명단 필터링
              const deptMembers = members.filter((m) => {
                const mappedDept = deptMapping[m.department || ""] || m.department;
                return mappedDept === dept || m.department === dept;
              }).sort((a, b) => a.name.localeCompare(b.name));

              // 관리자는 토글 가능, 부서 담당자는 항상 표시
              const isExpanded = isAdmin ? expandedDepartments.has(dept) : true;
              
              const handleToggle = (e: React.MouseEvent) => {
                if (!isAdmin) return;
                e.preventDefault();
                e.stopPropagation();
                const newExpanded = new Set(expandedDepartments);
                if (newExpanded.has(dept)) {
                  newExpanded.delete(dept);
                } else {
                  newExpanded.add(dept);
                }
                setExpandedDepartments(newExpanded);
              };

              return (
                <div key={dept}>
                  <div
                    onClick={handleToggle}
                    style={{
                      padding: "12px 16px",
                      backgroundColor: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      borderBottom: index < displayDepartments.length - 1 ? "1px solid #e5e7eb" : "none",
                      cursor: isAdmin ? "pointer" : "default",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (isAdmin) {
                        e.currentTarget.style.backgroundColor = "#f0f9ff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isAdmin) {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      }
                    }}
                  >
                  </div>
                  {isExpanded && (
                    <div style={{ backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb", padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, fontWeight: 500 }}>
                        명단 ({deptMembers.length}명)
                      </div>
                      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", backgroundColor: "#ffffff" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                              <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", width: 50 }}>
                                번호
                              </th>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                이름
                              </th>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                성별
                              </th>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                생년월일
                              </th>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                출석
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {deptMembers.map((member, idx) => {
                              // 부서담당자가 주일을 선택했으면 그것을 사용, 아니면 현재 주 일요일 사용
                              const displaySundayDate = (!isAdmin && userDepartment && managerSelectedSunday) ? managerSelectedSunday : currentWeekDates[0];
                              const isAttended = records[member.id]?.[displaySundayDate] === true;
                              return (
                                <tr
                                  key={member.id}
                                  style={{
                                    borderBottom: idx < deptMembers.length - 1 ? "1px solid #e5e7eb" : "none",
                                    backgroundColor: isAttended ? "#f0fdf4" : "#ffffff",
                                  }}
                                >
                                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280", textAlign: "center" }}>
                                    {idx + 1}
                                  </td>
                                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#1f2937" }}>
                                    {member.name}
                                  </td>
                                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280" }}>
                                    {member.gender || "-"}
                                  </td>
                                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280" }}>
                                    {member.birth_date ? new Date(member.birth_date).toLocaleDateString("ko-KR") : "-"}
                                  </td>
                                  <td style={{ padding: "10px 12px", fontSize: 13, color: isAttended ? "#10b981" : "#9ca3af" }}>
                                    {isAttended ? "출석" : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* 명단관리 팝업 */}
      {showMembersModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
          }}
          onClick={() => {
            setShowMembersModal(false);
            setShowAddForm(false);
            setBulkInput("");
            setSingleFormData({ name: "", gender: "", birth_date: "" });
            setAddMode("single");
            setSelectedDepartmentInModal(null);
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              padding: "24px",
              width: "100%",
              maxWidth: 800,
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", margin: 0 }}>명단관리</h2>
              <button
                onClick={() => {
                  setShowMembersModal(false);
                  setShowAddForm(false);
                  setBulkInput("");
                  setSingleFormData({ name: "", gender: "", birth_date: "" });
                  setAddMode("single");
                  setSelectedDepartmentInModal(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  color: "#6b7280",
                  cursor: "pointer",
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {(() => {
              // 부서명 매핑
              const deptMapping: Record<string, string> = {
                "아동부": "유치부",
                "중고등부": "청소년부",
              };

              // 담당 부서 필터링 또는 선택된 부서 필터링
              const targetDepartment = userDepartment || selectedDepartmentInModal;
              const filteredMembers = targetDepartment
                ? membersForModal.filter((m) => {
                    const mappedDept = deptMapping[m.department || ""] || m.department;
                    return mappedDept === targetDepartment || m.department === targetDepartment;
                  })
                : membersForModal;

              return (
                <>
                  {isAdmin && !userDepartment && (
                    <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => setSelectedDepartmentInModal(null)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                          background: selectedDepartmentInModal === null ? "#3b82f6" : "#ffffff",
                          color: selectedDepartmentInModal === null ? "#ffffff" : "#374151",
                          fontWeight: 500,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        전체
                      </button>
                      {departments.map((dept) => (
                        <button
                          key={dept}
                          onClick={() => setSelectedDepartmentInModal(dept)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #e5e7eb",
                            background: selectedDepartmentInModal === dept ? "#3b82f6" : "#ffffff",
                            color: selectedDepartmentInModal === dept ? "#ffffff" : "#374151",
                            fontWeight: 500,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, color: "#6b7280" }}>
                      총 {filteredMembers.length}명
                      {(userDepartment || selectedDepartmentInModal) && ` (${userDepartment || selectedDepartmentInModal})`}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {isAdmin && (
                        <button
                          onClick={handleFillEmptyFields}
                          disabled={savingMember}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 6,
                            border: "1px solid #e5e7eb",
                            background: savingMember ? "#f3f4f6" : "#ffffff",
                            color: savingMember ? "#9ca3af" : "#374151",
                            fontWeight: 500,
                            fontSize: 13,
                            cursor: savingMember ? "not-allowed" : "pointer",
                          }}
                        >
                          비어있는 값 채우기
                        </button>
                      )}
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                          background: "#ffffff",
                          color: "#374151",
                          fontWeight: 500,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        {showAddForm ? "취소" : "명단 추가"}
                      </button>
                    </div>
                  </div>

                  {showAddForm && (
                    <div style={{ marginBottom: 20, padding: 16, backgroundColor: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <button
                          onClick={() => setAddMode("single")}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #e5e7eb",
                            background: addMode === "single" ? "#3b82f6" : "#ffffff",
                            color: addMode === "single" ? "#ffffff" : "#374151",
                            fontWeight: 500,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          개별 추가
                        </button>
                        <button
                          onClick={() => setAddMode("bulk")}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #e5e7eb",
                            background: addMode === "bulk" ? "#3b82f6" : "#ffffff",
                            color: addMode === "bulk" ? "#ffffff" : "#374151",
                            fontWeight: 500,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          일괄 추가
                        </button>
                      </div>

                      {addMode === "single" ? (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
                            개별 추가 (청년부로 자동 지정)
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div>
                              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
                                이름 *
                              </label>
                              <input
                                type="text"
                                value={singleFormData.name}
                                onChange={(e) => setSingleFormData({ ...singleFormData, name: e.target.value })}
                                placeholder="이름을 입력하세요"
                                style={{
                                  width: "100%",
                                  padding: "10px",
                                  borderRadius: 6,
                                  border: "1px solid #e5e7eb",
                                  fontSize: 14,
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
                                성별
                              </label>
                              <select
                                value={singleFormData.gender}
                                onChange={(e) => setSingleFormData({ ...singleFormData, gender: e.target.value })}
                                style={{
                                  width: "100%",
                                  padding: "10px",
                                  borderRadius: 6,
                                  border: "1px solid #e5e7eb",
                                  fontSize: 14,
                                  backgroundColor: "#ffffff",
                                  cursor: "pointer",
                                }}
                              >
                                <option value="">선택 안 함</option>
                                <option value="남">남</option>
                                <option value="여">여</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
                                생년월일
                              </label>
                              <input
                                type="date"
                                value={singleFormData.birth_date}
                                onChange={(e) => setSingleFormData({ ...singleFormData, birth_date: e.target.value })}
                                style={{
                                  width: "100%",
                                  padding: "10px",
                                  borderRadius: 6,
                                  border: "1px solid #e5e7eb",
                                  fontSize: 14,
                                }}
                              />
                            </div>
                            <button
                              onClick={handleSingleAdd}
                              disabled={savingMember}
                              style={{
                                padding: "10px 16px",
                                borderRadius: 6,
                                border: "none",
                                background: savingMember ? "#9ca3af" : "#3b82f6",
                                color: "#ffffff",
                                fontWeight: 500,
                                fontSize: 14,
                                cursor: savingMember ? "not-allowed" : "pointer",
                              }}
                            >
                              {savingMember ? "저장 중..." : "추가"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                            일괄 추가 (청년부로 자동 지정)
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                            한 줄에 하나씩 이름을 입력하세요
                          </div>
                          <textarea
                            value={bulkInput}
                            onChange={(e) => setBulkInput(e.target.value)}
                            placeholder="홍길동&#10;김철수&#10;이영희"
                            style={{
                              width: "100%",
                              minHeight: 120,
                              padding: "10px",
                              borderRadius: 6,
                              border: "1px solid #e5e7eb",
                              fontSize: 14,
                              fontFamily: "inherit",
                              resize: "vertical",
                              marginBottom: 12,
                            }}
                          />
                          <button
                            onClick={handleBulkAdd}
                            disabled={savingMember}
                            style={{
                              padding: "8px 16px",
                              borderRadius: 6,
                              border: "none",
                              background: savingMember ? "#9ca3af" : "#3b82f6",
                              color: "#ffffff",
                              fontWeight: 500,
                              fontSize: 13,
                              cursor: savingMember ? "not-allowed" : "pointer",
                            }}
                          >
                            {savingMember ? "저장 중..." : "추가"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ maxHeight: "60vh", overflow: "auto" }}>
                      {filteredMembers.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                          명단이 없습니다.
                        </div>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                              <th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                이름
                              </th>
                              <th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                성별
                              </th>
                              <th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                생년월일
                              </th>
                              <th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                부서
                              </th>
                              {isAdmin && (
                                <>
                                  <th style={{ padding: "12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                    편집
                                  </th>
                                  <th style={{ padding: "12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                                    삭제
                                  </th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMembers.map((member, index) => {
                              const isEditing = editingMemberId === member.id;
                              return (
                                <tr
                                  key={member.id}
                                  style={{
                                    borderBottom: index < filteredMembers.length - 1 ? "1px solid #e5e7eb" : "none",
                                    backgroundColor: isEditing ? "#f0f9ff" : "#ffffff",
                                  }}
                                >
                                  {isEditing ? (
                                    <>
                                      <td style={{ padding: "12px" }}>
                                        <input
                                          type="text"
                                          value={editFormData.name}
                                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                          style={{
                                            width: "100%",
                                            padding: "6px 8px",
                                            borderRadius: 4,
                                            border: "1px solid #e5e7eb",
                                            fontSize: 13,
                                          }}
                                        />
                                      </td>
                                      <td style={{ padding: "12px" }}>
                                        <select
                                          value={editFormData.gender}
                                          onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                                          style={{
                                            width: "100%",
                                            padding: "6px 8px",
                                            borderRadius: 4,
                                            border: "1px solid #e5e7eb",
                                            fontSize: 13,
                                            backgroundColor: "#ffffff",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <option value="">선택 안 함</option>
                                          <option value="남">남</option>
                                          <option value="여">여</option>
                                        </select>
                                      </td>
                                      <td style={{ padding: "12px" }}>
                                        <input
                                          type="date"
                                          value={editFormData.birth_date}
                                          onChange={(e) => setEditFormData({ ...editFormData, birth_date: e.target.value })}
                                          style={{
                                            width: "100%",
                                            padding: "6px 8px",
                                            borderRadius: 4,
                                            border: "1px solid #e5e7eb",
                                            fontSize: 13,
                                          }}
                                        />
                                      </td>
                                      <td style={{ padding: "12px" }}>
                                        <select
                                          value={editFormData.department}
                                          onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                                          style={{
                                            width: "100%",
                                            padding: "6px 8px",
                                            borderRadius: 4,
                                            border: "1px solid #e5e7eb",
                                            fontSize: 13,
                                            backgroundColor: "#ffffff",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <option value="">선택 안 함</option>
                                          <option value="유치부">유치부</option>
                                          <option value="유초등부">유초등부</option>
                                          <option value="청소년부">청소년부</option>
                                          <option value="청년부">청년부</option>
                                        </select>
                                      </td>
                                      {isAdmin && (
                                        <td style={{ padding: "12px", textAlign: "center" }}>
                                          <button
                                            onClick={() => handleSaveEdit(member.id)}
                                            disabled={savingMember}
                                            style={{
                                              padding: "4px 12px",
                                              borderRadius: 4,
                                              border: "none",
                                              background: savingMember ? "#9ca3af" : "#10b981",
                                              color: "#ffffff",
                                              fontSize: 12,
                                              cursor: savingMember ? "not-allowed" : "pointer",
                                              marginRight: 4,
                                            }}
                                          >
                                            저장
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            disabled={savingMember}
                                            style={{
                                              padding: "4px 12px",
                                              borderRadius: 4,
                                              border: "1px solid #e5e7eb",
                                              background: "#ffffff",
                                              color: "#374151",
                                              fontSize: 12,
                                              cursor: savingMember ? "not-allowed" : "pointer",
                                            }}
                                          >
                                            취소
                                          </button>
                                        </td>
                                      )}
                                      {isAdmin && (
                                        <td style={{ padding: "12px", textAlign: "right" }}>
                                          <button
                                            onClick={() => handleDeleteMember(member.id, member.name)}
                                            disabled={savingMember}
                                            style={{
                                              padding: "4px 12px",
                                              borderRadius: 4,
                                              border: "1px solid #ef4444",
                                              background: "transparent",
                                              color: "#ef4444",
                                              fontSize: 12,
                                              cursor: savingMember ? "not-allowed" : "pointer",
                                            }}
                                          >
                                            삭제
                                          </button>
                                        </td>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <td style={{ padding: "12px", fontSize: 14, color: "#1f2937" }}>{member.name}</td>
                                      <td style={{ padding: "12px", fontSize: 14, color: "#6b7280" }}>
                                        {member.gender || "-"}
                                      </td>
                                      <td style={{ padding: "12px", fontSize: 14, color: "#6b7280" }}>
                                        {member.birth_date ? new Date(member.birth_date).toLocaleDateString("ko-KR") : "-"}
                                      </td>
                                      <td style={{ padding: "12px", fontSize: 14, color: "#6b7280" }}>
                                        {deptMapping[member.department || ""] || member.department || "-"}
                                      </td>
                                      {isAdmin && (
                                        <td style={{ padding: "12px", textAlign: "center" }}>
                                          <button
                                            onClick={() => handleEditMember(member)}
                                            style={{
                                              padding: "4px 12px",
                                              borderRadius: 4,
                                              border: "1px solid #3b82f6",
                                              background: "transparent",
                                              color: "#3b82f6",
                                              fontSize: 12,
                                              cursor: "pointer",
                                            }}
                                          >
                                            편집
                                          </button>
                                        </td>
                                      )}
                                      {isAdmin && (
                                        <td style={{ padding: "12px", textAlign: "right" }}>
                                          <button
                                            onClick={() => handleDeleteMember(member.id, member.name)}
                                            style={{
                                              padding: "4px 12px",
                                              borderRadius: 4,
                                              border: "1px solid #ef4444",
                                              background: "transparent",
                                              color: "#ef4444",
                                              fontSize: 12,
                                              cursor: "pointer",
                                            }}
                                          >
                                            삭제
                                          </button>
                                        </td>
                                      )}
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
