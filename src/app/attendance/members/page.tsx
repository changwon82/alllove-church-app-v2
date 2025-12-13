"use client";

import { useEffect, useState } from "react";
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

const departments = ["유초등부", "아동부", "중고등부", "청년부", "장년부", "찬양팀", "안내팀"];

export default function AttendanceMembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    birth_date: "",
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
        await loadMembers();

        setLoading(false);
      } catch (err: any) {
        console.error("데이터 로드 에러:", err);
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const loadMembers = async () => {
    const { data: membersData, error: membersError } = await supabase
      .from("attendance_members")
      .select("*")
      .order("name", { ascending: true });

    if (membersError) {
      console.error("출석체크 대상자 조회 에러:", membersError);
    } else {
      setMembers((membersData as AttendanceMember[]) || []);
    }
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

      await loadMembers();
      handleCancel();
      alert(editingId ? "수정되었습니다." : "추가되었습니다.");
    } catch (err: any) {
      console.error("저장 에러:", err);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
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

      await loadMembers();
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
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
            출석체크 대상자 관리
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>출석체크할 대상자를 추가, 수정, 삭제합니다</p>
        </div>
        <button
          onClick={handleAdd}
          disabled={showAddForm}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: showAddForm ? "#d1d5db" : "#3b82f6",
            color: "#ffffff",
            fontWeight: 500,
            fontSize: 13,
            cursor: showAddForm ? "not-allowed" : "pointer",
          }}
        >
          추가
        </button>
      </div>

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
                  }}
                >
                  나이
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  부서
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
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
                members.map((member) => {
                  const age = calculateAge(member.birth_date);
                  return (
                    <tr key={member.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "12px", fontWeight: 500, color: "#1f2937" }}>{member.name}</td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#374151" }}>
                        {member.gender || "-"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#374151" }}>
                        {member.birth_date ? new Date(member.birth_date).toLocaleDateString("ko-KR") : "-"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#374151" }}>
                        {age !== null ? `${age}세` : "-"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#374151" }}>
                        {member.department || "-"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <button
                            onClick={() => handleEdit(member)}
                            disabled={showAddForm}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: "1px solid #e5e7eb",
                              background: "#ffffff",
                              color: "#374151",
                              fontSize: 12,
                              cursor: showAddForm ? "not-allowed" : "pointer",
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(member.id, member.name)}
                            disabled={showAddForm}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: "1px solid #e5e7eb",
                              background: "#ffffff",
                              color: "#ef4444",
                              fontSize: 12,
                              cursor: showAddForm ? "not-allowed" : "pointer",
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
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

