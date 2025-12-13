"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// 프로필 타입
type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  position: string | null;
  department: string | null;
  approved: boolean | null;
  phone: string | null;
  birth: string | null;
};

export default function EditMemberPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [approved, setApproved] = useState(false);
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!id) {
        setErrorMsg("사용자 ID가 없습니다.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, position, department, approved, phone, birth")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setErrorMsg("프로필 조회 중 오류가 발생했습니다.");
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg("회원 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      setProfile(data);
      setFullName(data.full_name || "");
      setEmail(data.email || "");
      setRole((data.role as "member" | "admin") || "member");
      setPosition(data.position || "");
      setDepartment(data.department || "");
      setApproved(data.approved === true);
      setPhone(data.phone || "");
      
      // birth를 YYYY-MM-DD 형식으로 변환
      if (data.birth) {
        try {
          const date = new Date(data.birth);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          setBirth(`${year}-${month}-${day}`);
        } catch {
          setBirth("");
        }
      } else {
        setBirth("");
      }

      setLoading(false);
    };

    loadProfile();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);

    try {
      const updateData: any = {
        full_name: fullName.trim() || null,
        email: email.trim() || null,
        role: role,
        position: position.trim() || null,
        department: department.trim() || null,
        approved: approved,
        phone: phone.trim() || null,
        birth: birth ? birth : null,
        // 부서가 선택되면 자동으로 출석체크 권한 부여
        attendance_permission: department.trim() !== "" ? true : null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", id);

      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }

      router.push("/admin");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message ?? "저장 중 오류가 발생했습니다.");
      setSaving(false);
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
          fontSize: 20,
        }}
      >
        로딩 중...
      </div>
    );
  }

  if (errorMsg && !profile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 20,
          color: "#b91c1c",
        }}
      >
        {errorMsg}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f4f4f5",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: "#fff",
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>회원 정보 편집</h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>
              이름
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>
              권한
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                backgroundColor: "#fff",
              }}
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>
              직분
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                backgroundColor: "#fff",
              }}
            >
              <option value="">선택 안 함</option>
              <option value="성도">성도</option>
              <option value="집사">집사</option>
              <option value="권사">권사</option>
              <option value="장로">장로</option>
              <option value="목사">목사</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>
              담당부서
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                backgroundColor: "#fff",
              }}
            >
              <option value="">선택 안 함</option>
              <option value="유초등부">유초등부</option>
              <option value="아동부">아동부</option>
              <option value="중고등부">중고등부</option>
              <option value="청년부">청년부</option>
              <option value="장년부">장년부</option>
              <option value="찬양팀">찬양팀</option>
              <option value="안내팀">안내팀</option>
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  cursor: "pointer",
                }}
              />
              승인 여부
            </label>
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>
              전화번호
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>
              생년월일
            </label>
            <input
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
              }}
            />
          </div>

          {errorMsg && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                color: "#374151",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: "none",
                backgroundColor: saving ? "#9ca3af" : "#111827",
                color: "#fff",
                fontWeight: 600,
                fontSize: 15,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
