"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  gender: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [gender, setGender] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg("프로필을 불러올 수 없습니다.");
        setLoading(false);
        return;
      }

      setProfile(data);
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      setPosition(data.position || "");
      setDepartment(data.department || "");
      setGender(data.gender || "");

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
      }

      setLoading(false);
    };

    loadProfile();
  }, [router]);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          birth: birth || null,
          position: position.trim() || null,
          department: department.trim() || null,
          gender: gender || null,
        })
        .eq("id", profile.id);

      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }

      setEditing(false);
      await loadProfile();
      alert("저장되었습니다!");
    } catch (err: any) {
      setErrorMsg(err.message ?? "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setChangingPassword(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMsg(error.message);
        setChangingPassword(false);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      alert("비밀번호가 변경되었습니다!");
    } catch (err: any) {
      setErrorMsg(err.message ?? "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setChangingPassword(false);
    }
  };

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
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

  if (!profile) {
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
        {errorMsg || "프로필을 불러올 수 없습니다."}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
          내 프로필
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>내 정보를 확인하고 수정합니다</p>
      </div>

      {/* 프로필 정보 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "20px",
          border: "1px solid #e5e7eb",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>기본 정보</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: "#3b82f6",
                color: "white",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              수정
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setEditing(false);
                  loadProfile();
                }}
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
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: saving ? "#d1d5db" : "#10b981",
                  color: "white",
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px",
              backgroundColor: "#fef2f2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              이메일
            </label>
            <input
              type="email"
              value={profile.email || ""}
              disabled
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 13,
                backgroundColor: "#f9fafb",
                color: "#6b7280",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              이름
            </label>
            {editing ? (
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              />
            ) : (
              <div style={{ padding: "8px 10px", fontSize: 13, color: "#1f2937" }}>
                {profile.full_name || "-"}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              전화번호
            </label>
            {editing ? (
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              />
            ) : (
              <div style={{ padding: "8px 10px", fontSize: 13, color: "#1f2937" }}>
                {profile.phone || "-"}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              생년월일
            </label>
            {editing ? (
              <input
                type="date"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              />
            ) : (
              <div style={{ padding: "8px 10px", fontSize: 13, color: "#1f2937" }}>
                {profile.birth ? new Date(profile.birth).toLocaleDateString("ko-KR") : "-"}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              성별
            </label>
            {editing ? (
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
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
            ) : (
              <div style={{ padding: "8px 10px", fontSize: 13, color: "#1f2937" }}>
                {profile.gender || "-"}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              직분
            </label>
            {editing ? (
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              >
                <option value="">선택 안 함</option>
                <option value="성도">성도</option>
                <option value="집사">집사</option>
                <option value="권사">권사</option>
                <option value="장로">장로</option>
                <option value="목사">목사</option>
              </select>
            ) : (
              <div style={{ padding: "8px 10px", fontSize: 13, color: "#1f2937" }}>
                {profile.position || "-"}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              담당부서
            </label>
            {editing ? (
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
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
            ) : (
              <div style={{ padding: "8px 10px", fontSize: 13, color: "#1f2937" }}>
                {profile.department || "-"}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              권한
            </label>
            <div style={{ padding: "8px 10px", fontSize: 13, color: "#1f2937" }}>
              {profile.role || "member"}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              승인 상태
            </label>
            <div style={{ padding: "8px 10px", fontSize: 13, color: profile.approved ? "#10b981" : "#ef4444" }}>
              {profile.approved ? "✓ 승인됨" : "✗ 미승인"}
            </div>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "20px",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 16 }}>비밀번호 변경</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              새 비밀번호
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6자 이상"
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
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 재입력"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <button
          onClick={handleChangePassword}
          disabled={changingPassword || !newPassword || !confirmPassword}
          style={{
            marginTop: 16,
            padding: "10px 20px",
            borderRadius: 6,
            border: "none",
            background: changingPassword || !newPassword || !confirmPassword ? "#d1d5db" : "#3b82f6",
            color: "white",
            fontWeight: 500,
            fontSize: 13,
            cursor: changingPassword || !newPassword || !confirmPassword ? "not-allowed" : "pointer",
          }}
        >
          {changingPassword ? "변경 중..." : "비밀번호 변경"}
        </button>
      </div>
    </div>
  );
}
