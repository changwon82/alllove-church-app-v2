"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AttendanceMember = {
  id: string;
  name: string;
  gender: string | null;
  birth_date: string | null;
  department: string | null;
  created_at: string;
};

const departments = ["유치부", "유초등부", "청소년부", "청년부"];

export default function AttendanceMembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [allMembers, setAllMembers] = useState<AttendanceMember[]>([]); // 전체 멤버 목록 (카운트용)
  const [inactiveMembers, setInactiveMembers] = useState<AttendanceMember[]>([]); // 비활성화된 멤버 목록
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 동적 추가 행 관리
  type PendingMember = {
    id: string; // 임시 ID
    name: string;
    gender: string;
    birth_date: string;
    department: string;
  };
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [isSavingPending, setIsSavingPending] = useState(false);
  const [justSavedIds, setJustSavedIds] = useState<Set<string>>(new Set());
  
  // 삭제 모드 관리
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    birth_date: "",
    department: "",
  });

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

        // 부서명 매핑 (데이터베이스에 저장된 이름 -> 화면에 표시할 이름)
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

        // 출석체크 대상자 목록 불러오기
        const userDept = !isAdminUser && profile?.department 
          ? (deptMapping[profile.department] || profile.department)
          : null;
        await loadMembers(isAdminUser, userDept);

        setLoading(false);
      } catch (err: any) {
        console.error("데이터 로드 에러:", err);
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 부서 탭 변경 시 멤버 목록 다시 로드
  useEffect(() => {
    if (!loading && hasPermission) {
      const department = isAdmin ? selectedDepartment : userDepartment;
      loadMembers(isAdmin, department);
      setPendingMembers([]);
      setJustSavedIds(new Set());
      setIsDeleteMode(false);
      setSelectedDeleteIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment]);

  const loadMembers = async (isAdminUser: boolean = isAdmin, department: string | null = null) => {
    // 전체 멤버 로드 (활성화/비활성화 모두)
    const { data: membersData, error: membersError } = await supabase
      .from("attendance_members")
      .select("*")
      .order("name", { ascending: true });

    if (membersError) {
      console.error("출석체크 대상자 조회 에러:", membersError);
      setMembers([]);
      setAllMembers([]);
      setInactiveMembers([]);
      return;
    }

    const allData = (membersData as any[]) || [];
    console.log("로드된 멤버 데이터:", allData.length, "명");
    console.log("첫 번째 멤버 샘플:", allData[0]);
    
    // is_active 필드가 있는지 확인하고, 활성화/비활성화 분리
    let activeMembers: AttendanceMember[] = [];
    let inactiveMembersList: AttendanceMember[] = [];
    
    if (allData.length > 0) {
      // is_active 필드가 있는지 확인 (undefined가 아닌 경우 필드가 존재하는 것으로 간주)
      const sampleMember = allData[0] as any;
      const hasIsActiveField = sampleMember.is_active !== undefined;
      
      console.log("is_active 필드 존재 여부:", hasIsActiveField, "샘플 데이터:", sampleMember);
      
      if (hasIsActiveField) {
        // is_active가 명시적으로 false인 경우만 비활성으로 처리
        activeMembers = allData.filter((m: any) => m.is_active === true || m.is_active === null || m.is_active === undefined) as AttendanceMember[];
        inactiveMembersList = allData.filter((m: any) => m.is_active === false) as AttendanceMember[];
        console.log("활성 멤버:", activeMembers.length, "명");
        console.log("비활성 멤버:", inactiveMembersList.length, "명");
        if (inactiveMembersList.length > 0) {
          console.log("비활성 멤버 목록:", inactiveMembersList.map(m => ({ id: m.id, name: m.name, is_active: (m as any).is_active })));
        }
      } else {
        // is_active 필드가 없으면 모두 활성으로 처리
        activeMembers = allData as AttendanceMember[];
        inactiveMembersList = [];
        console.log("is_active 필드가 없어 모든 멤버를 활성으로 처리");
      }
    }
    
    // 전체 활성 멤버 목록 저장 (부서별 카운트 계산용)
    setAllMembers(activeMembers);
    setInactiveMembers(inactiveMembersList);

    // 필터링할 부서 결정 (부서 담당자는 userDepartment, 관리자는 selectedDepartment 또는 null)
    const filterDepartment = isAdminUser ? department : (userDepartment || department);

    // 부서명 매핑
    const deptMapping: Record<string, string> = {
      "아동부": "유치부",
      "중고등부": "청소년부",
    };

    // 활성 멤버 필터링
    let filteredMembers = activeMembers;
    if (filterDepartment) {
      filteredMembers = activeMembers.filter((m) => {
        const mappedDept = deptMapping[m.department || ""] || m.department;
        return mappedDept === filterDepartment || m.department === filterDepartment;
      });
    }
    
    // 비활성 멤버 필터링 (부서 필터링 + 연도 필터링)
    let filteredInactiveMembers = inactiveMembersList.filter((m) => {
      // 부서 필터링
      if (filterDepartment) {
        const mappedDept = deptMapping[m.department || ""] || m.department;
        const deptMatches = mappedDept === filterDepartment || m.department === filterDepartment;
        if (!deptMatches) return false;
      }
      
      // 이전 연도에 삭제된 멤버는 숨기기 (다음 해가 지나면 보이지 않음)
      const currentYear = new Date().getFullYear();
      const memberYear = m.created_at ? new Date(m.created_at).getFullYear() : currentYear;
      // 현재 연도보다 1년 이상 이전 연도 멤버는 숨김 (예: 2024년 멤버는 2026년부터 숨김)
      return memberYear >= currentYear - 1;
    });

    setMembers(filteredMembers);
    setInactiveMembers(filteredInactiveMembers);
  };

  const handleAdd = () => {
    setFormData({ name: "", gender: "", birth_date: "", department: "" });
    setEditingId(null);
    setShowAddForm(true);
  };

  const handleEdit = (member: AttendanceMember) => {
    setFormData({
      name: member.name,
      gender: member.gender || "",
      birth_date: member.birth_date || "",
      department: member.department || "",
    });
    setEditingId(member.id);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({ name: "", gender: "", birth_date: "", department: "" });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다.");
        setSaving(false);
        return;
      }

      if (editingId) {
        // 수정
        const { error } = await supabase
          .from("attendance_members")
          .update({
            name: formData.name.trim(),
            gender: formData.gender || null,
            birth_date: formData.birth_date || null,
            department: formData.department || null,
          })
          .eq("id", editingId);

        if (error) {
          console.error("수정 에러:", error);
          alert("수정 중 오류가 발생했습니다.");
          setSaving(false);
          return;
        }
      } else {
        // 추가
        const { error } = await supabase.from("attendance_members").insert({
          name: formData.name.trim(),
          gender: formData.gender || null,
          birth_date: formData.birth_date || null,
          department: formData.department || null,
          created_by: user.id,
        });

        if (error) {
          console.error("추가 에러:", error);
          alert("추가 중 오류가 발생했습니다.");
          setSaving(false);
          return;
        }
      }

      await loadMembers(isAdmin, isAdmin ? selectedDepartment : userDepartment);
      handleCancel();
      alert(editingId ? "수정되었습니다." : "추가되었습니다.");
    } catch (err: any) {
      console.error("저장 에러:", err);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 플러스 버튼으로 새 입력 행 추가
  const handleAddPendingRow = () => {
    const targetDepartment = isAdmin ? (selectedDepartment || null) : (userDepartment || null);
    const newPending: PendingMember = {
      id: `pending-${Date.now()}-${Math.random()}`,
      name: "",
      gender: "",
      birth_date: "",
      department: targetDepartment || "",
    };
    setPendingMembers([...pendingMembers, newPending]);
  };

  // 임시 행의 필드 업데이트
  const handlePendingFieldChange = (id: string, field: keyof PendingMember, value: string) => {
    setPendingMembers(
      pendingMembers.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  // 임시 행 삭제
  const handleRemovePendingRow = (id: string) => {
    setPendingMembers(pendingMembers.filter((m) => m.id !== id));
  };

  // 모든 입력 행 취소 (첫 번째 행의 - 버튼용)
  const handleCancelAllPending = () => {
    setPendingMembers([]);
  };

  // 모든 임시 행 저장
  const handleSavePendingMembers = async () => {
    if (pendingMembers.length === 0) return;

    // 유효성 검사: 이름이 있는 행만 저장
    const validMembers = pendingMembers.filter((m) => m.name.trim());
    if (validMembers.length === 0) {
      alert("저장할 이름이 없습니다.");
      return;
    }

    setIsSavingPending(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다.");
        setIsSavingPending(false);
        return;
      }

      const membersToInsert = validMembers.map((m) => ({
        name: m.name.trim(),
        gender: m.gender || null,
        birth_date: m.birth_date || null,
        department: m.department || null,
        created_by: user.id,
      }));

      const { error } = await supabase.from("attendance_members").insert(membersToInsert);

      if (error) {
        console.error("추가 에러:", error);
        alert("추가 중 오류가 발생했습니다.");
        setIsSavingPending(false);
        return;
      }

      // 저장된 멤버들의 이름 목록 저장 (나중에 ID 매칭용)
      const savedNames = validMembers.map((m) => m.name.trim());
      
      // 목록 다시 불러오기
      await loadMembers(isAdmin, isAdmin ? selectedDepartment : userDepartment);
      
      // 저장된 멤버들의 ID 찾기 (이름으로 매칭)
      // 잠시 후 업데이트된 멤버 목록에서 ID 찾기
      setTimeout(async () => {
        const { data: allMembers } = await supabase
          .from("attendance_members")
          .select("id, name");
        
        if (allMembers) {
          // 저장한 이름들과 일치하는 멤버들의 ID 찾기
          const newIds = allMembers
            .filter((m) => savedNames.includes(m.name))
            .slice(-validMembers.length) // 최근 추가된 것들만
            .map((m) => m.id);
          
          setJustSavedIds(new Set(newIds));
        }
      }, 200);
      
      // 임시 행 초기화
      setPendingMembers([]);
    } catch (err: any) {
      console.error("저장 에러:", err);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingPending(false);
    }
  };


  // 선택된 멤버들의 출석 기록 확인
  const checkAttendanceRecords = async (memberIds: string[]): Promise<number> => {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .in("member_id", memberIds);

    if (error) {
      console.error("출석 기록 확인 에러:", error);
      return 0;
    }
    return data?.length || 0;
  };

  // 선택된 멤버들 삭제 (비활성화)
  const handleDeleteSelected = async () => {
    if (selectedDeleteIds.size === 0) {
      alert("삭제할 항목을 선택해주세요.");
      return;
    }

    const selectedArray = Array.from(selectedDeleteIds);
    const selectedMembers = members.filter((m) => selectedDeleteIds.has(m.id));
    const memberNames = selectedMembers.map((m) => m.name).join(", ");

    // 출석 기록 확인
    const recordCount = await checkAttendanceRecords(selectedArray);
    const hasRecords = recordCount > 0;

    let confirmMessage = `"${memberNames}"을(를) 삭제하시겠습니까?`;
    if (hasRecords) {
      confirmMessage += `\n\n주의: 이(들) 멤버에게는 ${recordCount}개의 출석 기록이 있습니다. 삭제 후에도 출석 기록은 보관되며, 나중에 복권 시 다시 확인할 수 있습니다.`;
    }
    confirmMessage += "\n\n삭제된 멤버는 목록에서 사라지지만 출석 기록은 유지됩니다.";

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // 먼저 is_active 필드로 비활성화 시도
      const { error: updateError } = await supabase
        .from("attendance_members")
        .update({ is_active: false })
        .in("id", selectedArray);

      // is_active 필드가 없거나 에러가 발생하면 직접 삭제 시도
      if (updateError) {
        const errorCode = updateError.code;
        const errorMessage = updateError.message || "";
        
        // 컬럼이 없는 에러인 경우에만 직접 삭제
        const isColumnNotFoundError = 
          errorCode === "42703" || 
          errorCode === "PGRST116" ||
          (typeof errorMessage === "string" && (
            errorMessage.toLowerCase().includes("column") && 
            errorMessage.toLowerCase().includes("does not exist")
          ));

        if (isColumnNotFoundError) {
          // is_active 필드가 없으므로 직접 삭제 사용
          // 출석 기록은 외래키 제약으로 자동 유지됨
          const { error: deleteError } = await supabase
            .from("attendance_members")
            .delete()
            .in("id", selectedArray);

          if (deleteError) {
            console.error("삭제 에러:", deleteError);
            alert("삭제 중 오류가 발생했습니다.");
            return;
          }
          alert(`${selectedArray.length}명이 삭제되었습니다. (is_active 필드가 없어 완전 삭제되었습니다. 데이터베이스에 is_active 필드를 추가하려면 add_is_active_to_attendance_members.sql 파일을 실행하세요.)`);
        } else {
          // 다른 종류의 에러
          console.error("비활성화 에러:", updateError);
          alert(`삭제 중 오류가 발생했습니다: ${errorMessage || JSON.stringify(updateError)}`);
          return;
        }
      }

      await loadMembers(isAdmin, isAdmin ? selectedDepartment : userDepartment);
      setIsDeleteMode(false);
      setSelectedDeleteIds(new Set());
      alert(`${selectedDeleteIds.size}명이 삭제되었습니다.${hasRecords ? " 출석 기록은 보관되었습니다." : ""}`);
    } catch (err: any) {
      console.error("삭제 에러:", err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // 비활성 멤버 완전 삭제 (실제 DELETE)
  const handlePermanentDelete = async (memberId: string, memberName: string) => {
    // 1차 확인
    const firstConfirm = confirm(
      `"${memberName}"을(를) 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다. 모든 데이터가 영구적으로 삭제됩니다.`
    );
    
    if (!firstConfirm) {
      return;
    }

    // 2차 확인
    const secondConfirm = confirm(
      `정말로 "${memberName}"을(를) 완전히 삭제하시겠습니까?\n\n마지막 확인입니다. 이 작업은 되돌릴 수 없습니다.`
    );
    
    if (!secondConfirm) {
      return;
    }

    try {
      // 출석 기록 확인
      const recordCount = await checkAttendanceRecords([memberId]);
      
      if (recordCount > 0) {
        const finalConfirm = confirm(
          `주의: "${memberName}"에게는 ${recordCount}개의 출석 기록이 있습니다.\n\n완전 삭제하면 멤버 정보와 연결된 모든 데이터가 삭제됩니다. 그래도 계속하시겠습니까?`
        );
        
        if (!finalConfirm) {
          return;
        }
      }

      // 실제 DELETE 실행
      const { error: deleteError } = await supabase
        .from("attendance_members")
        .delete()
        .eq("id", memberId);

      if (deleteError) {
        console.error("완전 삭제 에러:", deleteError);
        alert("삭제 중 오류가 발생했습니다.");
        return;
      }

      alert(`"${memberName}"이(가) 완전히 삭제되었습니다.`);
      await loadMembers(isAdmin, isAdmin ? selectedDepartment : userDepartment);
    } catch (err: any) {
      console.error("완전 삭제 에러:", err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // 비활성 멤버 복원 (is_active를 true로 변경)
  const handleRestoreMember = async (memberId: string, memberName: string) => {
    if (!confirm(`"${memberName}"을(를) 복원하시겠습니까?`)) {
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("attendance_members")
        .update({ is_active: true })
        .eq("id", memberId);

      if (updateError) {
        console.error("복원 에러:", updateError);
        alert("복원 중 오류가 발생했습니다.");
        return;
      }

      alert(`"${memberName}"이(가) 복원되었습니다.`);
      await loadMembers(isAdmin, isAdmin ? selectedDepartment : userDepartment);
    } catch (err: any) {
      console.error("복원 에러:", err);
      alert("복원 중 오류가 발생했습니다.");
    }
  };

  // 삭제 모드 토글
  const toggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
    setSelectedDeleteIds(new Set());
  };

  // 체크박스 토글
  const toggleSelectDelete = (id: string) => {
    const newSelected = new Set(selectedDeleteIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDeleteIds(newSelected);
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedDeleteIds.size === members.length) {
      // 모두 선택되어 있으면 전체 해제
      setSelectedDeleteIds(new Set());
    } else {
      // 일부만 선택되어 있거나 선택된 것이 없으면 전체 선택
      setSelectedDeleteIds(new Set(members.map(m => m.id)));
    }
  };

  const handleDelete = async (id: string, name: string) => {
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

      await loadMembers(isAdmin, isAdmin ? selectedDepartment : userDepartment);
      alert("삭제되었습니다.");
    } catch (err: any) {
      console.error("삭제 에러:", err);
      alert("삭제 중 오류가 발생했습니다.");
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
      <div style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
            {isAdmin 
              ? (selectedDepartment ? `${selectedDepartment} 명단관리` : "전체 명단관리")
              : (userDepartment ? `${userDepartment} 명단관리` : "명단관리")
            }
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            출석체크할 대상자를 추가, 수정, 삭제합니다
          </p>
        </div>
      </div>

      {/* 관리자용 부서별 탭 */}
      {isAdmin && (() => {
        // 부서별 멤버 수 계산 (전체 멤버 목록 사용)
        const deptMapping: Record<string, string> = {
          "아동부": "유치부",
          "중고등부": "청소년부",
        };
        
        const getDepartmentMemberCount = (dept: string | null) => {
          if (!dept) {
            return allMembers.length;
          }
          return allMembers.filter((m) => {
            const mappedDept = deptMapping[m.department || ""] || m.department;
            return mappedDept === dept || m.department === dept;
          }).length;
        };
        
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button
              onClick={() => setSelectedDepartment(null)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: selectedDepartment === null ? "#3b82f6" : "#ffffff",
                color: selectedDepartment === null ? "#ffffff" : "#374151",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              전체 ({getDepartmentMemberCount(null)})
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: selectedDepartment === dept ? "#3b82f6" : "#ffffff",
                  color: selectedDepartment === dept ? "#ffffff" : "#374151",
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {dept} ({getDepartmentMemberCount(dept)})
              </button>
            ))}
          </div>
        );
      })()}

      {/* 추가/수정 폼 */}
      {showAddForm && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "20px",
            border: "1px solid #e5e7eb",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 16 }}>
            {editingId ? "수정" : "추가"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
                이름 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
                placeholder="이름"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
                성별
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              >
                <option value="">선택 안 함</option>
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
                생년월일
              </label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
                부서
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              >
                <option value="">선택 안 함</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: saving || !formData.name.trim() ? "#d1d5db" : "#10b981",
                color: "#ffffff",
                fontWeight: 500,
                fontSize: 13,
                cursor: saving || !formData.name.trim() ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#374151",
                fontWeight: 500,
                fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          display: "inline-block",
          width: "auto",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "auto", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                <th
                  style={{
                    padding: "6px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isDeleteMode && members.length > 0 ? (
                    <input
                      type="checkbox"
                      checked={selectedDeleteIds.size === members.length && members.length > 0}
                      onChange={toggleSelectAll}
                      style={{
                        marginRight: 8,
                        cursor: "pointer",
                      }}
                    />
                  ) : null}
                  번호
                </th>
                <th
                  style={{
                    padding: "6px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  부서
                </th>
                <th
                  style={{
                    padding: "6px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  이름
                </th>
                <th
                  style={{
                    padding: "6px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  생년월일
                </th>
                <th
                  style={{
                    padding: "6px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pendingMembers.length === 0 && !isDeleteMode && (
                    <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
                      <button
                        onClick={handleAddPendingRow}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          background: "#ffffff",
                          color: "#374151",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "28px",
                          height: "28px",
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={toggleDeleteMode}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid #e5e7eb",
                          background: "#ffffff",
                          color: "#ef4444",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "28px",
                          height: "28px",
                        }}
                      >
                        -
                      </button>
                    </div>
                  )}
                  {isDeleteMode && (
                    <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
                      <button
                        onClick={toggleDeleteMode}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 4,
                          border: "1px solid #e5e7eb",
                          background: "#ffffff",
                          color: "#374151",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        disabled={selectedDeleteIds.size === 0}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 4,
                          border: "none",
                          background: selectedDeleteIds.size === 0 ? "#d1d5db" : "#ef4444",
                          color: "#ffffff",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: selectedDeleteIds.size === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        삭제 ({selectedDeleteIds.size})
                      </button>
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 추가 입력 행들 */}
              {pendingMembers.map((pending, idx) => (
                <tr key={pending.id} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#fef3c7" }}>
                  <td style={{ padding: "6px", textAlign: "center", color: "#6b7280", fontSize: 13, whiteSpace: "nowrap" }}>
                    {members.length + idx + 1}
                  </td>
                  <td style={{ padding: "6px", textAlign: "center", whiteSpace: "nowrap" }}>
                    <select
                      value={pending.department}
                      onChange={(e) => handlePendingFieldChange(pending.id, "department", e.target.value)}
                      style={{
                        padding: "4px 6px",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        fontSize: 12,
                        width: "100%",
                        minWidth: "80px",
                      }}
                    >
                      <option value="">선택 안 함</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-start" }}>
                      <input
                        type="text"
                        value={pending.name}
                        onChange={(e) => handlePendingFieldChange(pending.id, "name", e.target.value)}
                        placeholder="이름"
                        style={{
                          padding: "4px 6px",
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          fontSize: 12,
                          width: "80px",
                        }}
                      />
                      <select
                        value={pending.gender}
                        onChange={(e) => handlePendingFieldChange(pending.id, "gender", e.target.value)}
                        style={{
                          padding: "4px 6px",
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          fontSize: 12,
                          width: "50px",
                        }}
                      >
                        <option value="">-</option>
                        <option value="남">남</option>
                        <option value="여">여</option>
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>
                    <input
                      type="date"
                      value={pending.birth_date}
                      onChange={(e) => handlePendingFieldChange(pending.id, "birth_date", e.target.value)}
                      style={{
                        padding: "4px 6px",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        fontSize: 12,
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px", textAlign: "center", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
                      <button
                        onClick={() => {
                          if (idx === 0 && pendingMembers.length === 1) {
                            // 첫 번째 행이고 행이 하나만 있을 때는 모든 입력 취소
                            handleCancelAllPending();
                          } else if (pendingMembers.length > 1) {
                            // 여러 행이 있을 때는 해당 행만 삭제
                            handleRemovePendingRow(pending.id);
                          }
                        }}
                        disabled={isSavingPending}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid #e5e7eb",
                          background: "#ffffff",
                          color: "#ef4444",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: isSavingPending ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "28px",
                          height: "28px",
                        }}
                      >
                        -
                      </button>
                      <button
                        onClick={handleAddPendingRow}
                        disabled={isSavingPending}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          background: "#ffffff",
                          color: "#374151",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: isSavingPending ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "28px",
                          height: "28px",
                        }}
                      >
                        +
                      </button>
                      {idx === pendingMembers.length - 1 && (
                        <button
                          onClick={handleSavePendingMembers}
                          disabled={isSavingPending || pendingMembers.every((p) => !p.name.trim())}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 4,
                            border: "none",
                            background: isSavingPending || pendingMembers.every((p) => !p.name.trim()) ? "#d1d5db" : "#10b981",
                            color: "#ffffff",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: isSavingPending || pendingMembers.every((p) => !p.name.trim()) ? "not-allowed" : "pointer",
                          }}
                        >
                          입력
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && pendingMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "#9ca3af",
                      fontSize: 14,
                    }}
                  >
                    출석체크 대상자가 없습니다.
                  </td>
                </tr>
              ) : (
                members.map((member, index) => {
                  const age = calculateAge(member.birth_date);
                  // 부서명 매핑
                  const deptMapping: Record<string, string> = {
                    "아동부": "유치부",
                    "중고등부": "청소년부",
                  };
                  const displayDepartment = member.department 
                    ? (deptMapping[member.department] || member.department)
                    : null;
                  const isJustSaved = justSavedIds.has(member.id);
                  return (
                    <tr 
                      key={member.id} 
                      style={{ 
                        borderBottom: "1px solid #e5e7eb",
                        backgroundColor: isJustSaved ? "#fef3c7" : "transparent",
                      }}
                    >
                      <td style={{ padding: "6px", textAlign: "center", color: "#6b7280", fontSize: 13, whiteSpace: "nowrap" }}>
                        {isDeleteMode && (
                          <input
                            type="checkbox"
                            checked={selectedDeleteIds.has(member.id)}
                            onChange={() => toggleSelectDelete(member.id)}
                            style={{
                              marginRight: 8,
                              cursor: "pointer",
                            }}
                          />
                        )}
                        {index + 1}
                      </td>
                      <td style={{ padding: "6px", textAlign: "center", color: "#374151", whiteSpace: "nowrap" }}>
                        {displayDepartment || "-"}
                      </td>
                      <td style={{ padding: "6px", textAlign: "left", fontWeight: 500, color: "#1f2937", whiteSpace: "nowrap" }}>
                        {member.name}
                        {member.gender || age !== null ? ` (${member.gender || "?"}/${age !== null ? age : "?"})` : ""}
                      </td>
                      <td style={{ padding: "6px", textAlign: "left", color: "#374151", whiteSpace: "nowrap" }}>
                        {member.birth_date ? new Date(member.birth_date).toLocaleDateString("ko-KR") : "-"}
                      </td>
                      <td style={{ padding: "6px", textAlign: "center", whiteSpace: "nowrap" }}>
                      </td>
                    </tr>
                  );
                })
              )}
              {/* 비활성화된 멤버 (제적 처리) */}
              {inactiveMembers.length > 0 && (
                <>
                  <tr>
                    <td colSpan={5} style={{ padding: "12px", borderTop: "2px solid #9ca3af", backgroundColor: "#f3f4f6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                          제적 처리된 멤버
                        </div>
                      </div>
                    </td>
                  </tr>
                  {inactiveMembers.map((member, index) => {
                    const age = calculateAge(member.birth_date);
                    // 부서명 매핑
                    const deptMapping: Record<string, string> = {
                      "아동부": "유치부",
                      "중고등부": "청소년부",
                    };
                    const displayDepartment = member.department 
                      ? (deptMapping[member.department] || member.department)
                      : null;
                    // 비활성 멤버는 활성 멤버 수 이후부터 새롭게 번호 매기기
                    const inactiveNumber = members.length + index + 1;
                    return (
                      <tr 
                        key={member.id} 
                        style={{ 
                          borderBottom: "1px solid #d1d5db",
                          backgroundColor: "#f9fafb",
                        }}
                      >
                        <td style={{ padding: "6px", textAlign: "center", color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>
                          {inactiveNumber}
                        </td>
                        <td style={{ padding: "6px", textAlign: "center", color: "#9ca3af", whiteSpace: "nowrap" }}>
                          {displayDepartment || "-"}
                        </td>
                        <td style={{ padding: "6px", textAlign: "left", fontWeight: 500, color: "#6b7280", whiteSpace: "nowrap" }}>
                          {member.name}
                          {member.gender || age !== null ? ` (${member.gender || "?"}/${age !== null ? age : "?"})` : ""}
                        </td>
                        <td style={{ padding: "6px", textAlign: "left", color: "#9ca3af", whiteSpace: "nowrap" }}>
                          {member.birth_date ? new Date(member.birth_date).toLocaleDateString("ko-KR") : "-"}
                        </td>
                        <td style={{ padding: "6px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
                            <button
                              onClick={() => handleRestoreMember(member.id, member.name)}
                              style={{
                                padding: "4px 12px",
                                fontSize: 11,
                                fontWeight: 500,
                                color: "#059669",
                                backgroundColor: "transparent",
                                border: "1px solid #059669",
                                borderRadius: 4,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#059669";
                                e.currentTarget.style.color = "#ffffff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.color = "#059669";
                              }}
                            >
                              복원
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(member.id, member.name)}
                              style={{
                                padding: "4px 12px",
                                fontSize: 11,
                                fontWeight: 500,
                                color: "#dc2626",
                                backgroundColor: "transparent",
                                border: "1px solid #dc2626",
                                borderRadius: 4,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#dc2626";
                                e.currentTarget.style.color = "#ffffff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.color = "#dc2626";
                              }}
                            >
                              완전 삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

