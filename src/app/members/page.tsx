"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type FilterMode = "all" | "approved" | "pending";

export default function MembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; email: string; error: string }>;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const loadMembers = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // 현재 사용자의 권한 확인
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const userIsAdmin = myProfile?.role === "admin";
      setIsAdmin(userIsAdmin);

      // 프로필 데이터 로드
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, position, department, approved, phone, birth")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("회원 목록 조회 에러:", error);
        setLoading(false);
        return;
      }

      setProfiles((data ?? []) as Profile[]);
      setLoading(false);
    };

    loadMembers();
  }, [router]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterMode]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return profiles.filter((p) => {
      const okFilter =
        filterMode === "all"
          ? true
          : filterMode === "approved"
          ? p.approved === true
          : p.approved !== true;

      const okSearch =
        q.length === 0
          ? true
          : (p.full_name ?? "").toLowerCase().includes(q) ||
            (p.email ?? "").toLowerCase().includes(q) ||
            (p.phone ?? "").toLowerCase().includes(q) ||
            (p.department ?? "").toLowerCase().includes(q) ||
            (p.position ?? "").toLowerCase().includes(q) ||
            (p.role === "admin" ? "관리자" : p.role === "leader" ? "리더" : "멤버").toLowerCase().includes(q) ||
            (calculateAge(p.birth) !== null ? `${calculateAge(p.birth)}세` : "").includes(q) ||
            (p.birth ? (() => {
              try {
                const date = new Date(p.birth!);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  const month = date.getMonth() + 1;
                  const day = date.getDate();
                  return `${year}.${month}.${day}`;
                }
              } catch {}
              return "";
            })() : "").includes(q);

      const okDepartment = departmentFilter === "all" || p.department === departmentFilter;
      const okPosition = positionFilter === "all" || p.position === positionFilter;

      return okFilter && okSearch && okDepartment && okPosition;
    });
  }, [profiles, search, departmentFilter, positionFilter, filterMode]);

  const updateLocal = (id: string, patch: Partial<Profile>) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const saveProfile = async (p: Profile) => {
    const payload = {
      role: p.role,
      approved: p.approved,
      position: p.position,
      department: p.department,
      full_name: p.full_name,
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", p.id);

    if (error) {
      console.error("프로필 저장 에러:", error);
      alert("저장 실패: " + (error.message ?? "알 수 없는 오류"));
      return;
    }

    alert("저장 완료!");
    setEditingId(null);
    
    // 목록 다시 불러오기
    const { data, error: reloadError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, position, department, approved, phone, birth")
      .order("full_name", { ascending: true });
    
    if (!reloadError && data) {
      setProfiles(data as Profile[]);
    }
  };

  const parseCSV = (text: string): Array<{
    full_name: string;
    email: string;
    password: string;
    position?: string;
    department?: string;
    phone?: string;
    birth?: string;
    gender?: string;
    role?: string;
    approved?: boolean;
  }> => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const results: Array<{
      full_name: string;
      email: string;
      password: string;
      position?: string;
      department?: string;
      phone?: string;
      birth?: string;
      gender?: string;
      role?: string;
      approved?: boolean;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.includes("이름") || line.toLowerCase().includes("name"))) {
        continue;
      }

      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) continue;

      const full_name = parts[0];
      const email = parts[1];
      const password = parts[2] || `temp${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      const position = parts[3] || undefined;
      const department = parts[4] || undefined;
      const phone = parts[5] || undefined;
      const birth = parts[6] || undefined;
      const gender = parts[7] || undefined;
      const role = parts[8] || "member";
      const approved = parts[9]?.toLowerCase() === "true" || parts[9] === "1" || false;

      if (!full_name || !email) continue;

      results.push({
        full_name,
        email,
        password,
        position,
        department,
        phone,
        birth,
        gender,
        role,
        approved,
      });
    }

    return results;
  };

  const handleBulkImport = async () => {
    if (!bulkInput.trim()) {
      alert("입력 내용이 없습니다.");
      return;
    }

    setBulkProcessing(true);
    setBulkResults(null);

    const parsed = parseCSV(bulkInput);
    if (parsed.length === 0) {
      alert("유효한 데이터가 없습니다.");
      setBulkProcessing(false);
      return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; email: string; error: string }>,
    };

    for (let i = 0; i < parsed.length; i++) {
      const user = parsed[i];
      
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      try {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("email", user.email)
          .maybeSingle();
        
        let userId: string | null = null;
        
        if (existingProfile) {
          userId = existingProfile.id;
        } else {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: user.email,
            password: user.password,
          });

          if (authError) {
            if (authError.message.includes("already registered") || 
                authError.message.includes("already exists") ||
                authError.message.includes("rate limit")) {
              
              if (authError.message.includes("rate limit")) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const { data: retryProfile } = await supabase
                  .from("profiles")
                  .select("id, email")
                  .eq("email", user.email)
                  .maybeSingle();
                
                if (retryProfile) {
                  userId = retryProfile.id;
                } else {
                  results.failed++;
                  results.errors.push({
                    row: i + 1,
                    email: user.email,
                    error: "요청 속도 제한에 걸렸습니다.",
                  });
                  continue;
                }
              } else {
                results.failed++;
                results.errors.push({
                  row: i + 1,
                  email: user.email,
                  error: "이미 등록된 사용자입니다.",
                });
                continue;
              }
            } else {
              results.failed++;
              results.errors.push({
                row: i + 1,
                email: user.email,
                error: authError.message,
              });
              continue;
            }
          } else if (!authData?.user) {
            results.failed++;
            results.errors.push({
              row: i + 1,
              email: user.email,
              error: "사용자 생성 실패",
            });
            continue;
          } else {
            userId = authData.user.id;
          }
        }

        if (!userId) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            email: user.email,
            error: "사용자 ID를 찾을 수 없습니다.",
          });
          continue;
        }

        const profileData = {
          id: userId,
          email: user.email,
          full_name: user.full_name,
          role: user.role || "member",
          position: user.position || null,
          department: user.department || null,
          phone: user.phone || null,
          birth: user.birth || null,
          gender: user.gender || null,
          approved: user.approved || false,
        };

        if (existingProfile) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(profileData, { onConflict: "id" });

          if (profileError) {
            results.failed++;
            results.errors.push({
              row: i + 1,
              email: user.email,
              error: profileError.message,
            });
            continue;
          }
        } else {
          const { error: profileError } = await supabase.from("profiles").insert(profileData);

          if (profileError) {
            results.failed++;
            results.errors.push({
              row: i + 1,
              email: user.email,
              error: profileError.message,
            });
            continue;
          }
        }

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          email: user.email,
          error: err.message || "알 수 없는 오류",
        });
      }
    }

    setBulkResults(results);
    setBulkProcessing(false);

    if (results.success > 0) {
      // 목록 다시 불러오기
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, position, department, approved, phone, birth")
        .order("full_name", { ascending: true });
      
      if (!error && data) {
        setProfiles(data as Profile[]);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setBulkInput(text);
    };
    reader.readAsText(file);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      alert("승인할 회원을 선택해주세요.");
      return;
    }

    if (!confirm(`${selectedIds.size}명의 회원을 승인하시겠습니까?`)) {
      return;
    }

    const ids = Array.from(selectedIds);
    let success = 0;
    let failed = 0;

    for (const id of ids) {
      const { error } = await supabase.from("profiles").update({ approved: true }).eq("id", id);

      if (error) {
        console.error("승인 실패:", id, error);
        failed++;
      } else {
        success++;
        updateLocal(id, { approved: true });
      }
    }

    setSelectedIds(new Set());
    alert(`승인 완료: ${success}명 성공, ${failed}명 실패`);
    
    // 목록 다시 불러오기
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, position, department, approved, phone")
      .order("full_name", { ascending: true });
    
    if (!error && data) {
      setProfiles(data as Profile[]);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAllPending = () => {
    const pendingIds = filtered.filter((p) => p.approved !== true).map((p) => p.id);
    setSelectedIds(new Set(pendingIds));
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    // 목록 다시 불러오기
    const loadMembers = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, position, department, approved, phone, birth")
        .order("full_name", { ascending: true });
      
      if (!error && data) {
        setProfiles(data as Profile[]);
      }
    };
    loadMembers();
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
          회원조회
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          {isAdmin ? "회원 목록을 조회하고 관리합니다" : "회원 목록을 조회하고 검색합니다"}
        </p>
      </div>

      {/* 필터 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
          padding: "12px",
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="검색 (이름/이메일/전화번호/부서/직분/권한/나이/생년월일)"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            minWidth: 180,
            flex: 1,
          }}
        />

        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
          }}
        >
          <option value="all">전체 부서</option>
          <option value="유치부">유치부</option>
          <option value="유초등부">유초등부</option>
          <option value="청소년부">청소년부</option>
          <option value="청년부">청년부</option>
        </select>

        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
          }}
        >
          <option value="all">전체 직분</option>
          <option value="성도">성도</option>
          <option value="집사">집사</option>
          <option value="권사">권사</option>
          <option value="장로">장로</option>
          <option value="목사">목사</option>
        </select>

        {isAdmin && (
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              backgroundColor: "#ffffff",
              cursor: "pointer",
            }}
          >
            <option value="all">승인/미승인</option>
            <option value="approved">승인</option>
            <option value="pending">미승인</option>
          </select>
        )}

        {isAdmin && (
          <>
            <button
              onClick={() => setShowBulkImport(!showBulkImport)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: showBulkImport ? "#10b981" : "#3b82f6",
                color: "white",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {showBulkImport ? "닫기" : "일괄입력"}
            </button>

            {filterMode === "pending" && filtered.filter((p) => p.approved !== true).length > 0 && (
              <>
                <button
                  onClick={selectAllPending}
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
                  전체 선택
                </button>
                <button
                  onClick={handleBulkApprove}
                  disabled={selectedIds.size === 0}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: selectedIds.size === 0 ? "#d1d5db" : "#10b981",
                    color: "white",
                    fontWeight: 500,
                    fontSize: 13,
                    cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  선택한 {selectedIds.size}명 승인
                </button>
              </>
            )}
          </>
        )}

        <div
          style={{
            color: "#6b7280",
            fontSize: 12,
            padding: "8px 12px",
            backgroundColor: "#f3f4f6",
            borderRadius: 6,
            marginLeft: "auto",
          }}
        >
          {filtered.length}명
        </div>
      </div>

      {/* 일괄 입력 섹션 */}
      {isAdmin && showBulkImport && (
        <div
          style={{
            marginBottom: 12,
            padding: "16px",
            backgroundColor: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
            회원 일괄 입력
          </h2>

          <div
            style={{
              marginBottom: 12,
              padding: "12px",
              backgroundColor: "#f9fafb",
              borderRadius: 6,
              fontSize: 12,
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>입력 형식:</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 8 }}>
              이름,이메일,비밀번호,직분,부서,전화번호,생년월일,성별,권한,승인여부
            </div>
            <div style={{ fontSize: 11 }}>
              • 필수: 이름, 이메일 | 비밀번호 없으면 자동 생성 | 성별: 남/여 | 권한: member/leader/admin (기본: member) |
              승인여부: true/1 또는 false/0 (기본: false)
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              CSV 파일 업로드 (선택)
            </label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              style={{
                padding: "6px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 12,
                cursor: "pointer",
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              CSV 데이터 입력
            </label>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="이름,이메일,비밀번호,직분,부서,전화번호,생년월일,권한,승인여부&#10;홍길동,hong@example.com,password123,집사,유초등부,010-1234-5678,1990-01-01,member,true"
              style={{
                width: "100%",
                minHeight: "120px",
                padding: "10px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 12,
                fontFamily: "monospace",
                resize: "vertical",
              }}
              disabled={bulkProcessing}
            />
          </div>

          {bulkResults && (
            <div
              style={{
                marginBottom: 12,
                padding: "12px",
                borderRadius: 6,
                backgroundColor: bulkResults.failed > 0 ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${bulkResults.failed > 0 ? "#fecaca" : "#bbf7d0"}`,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: bulkResults.failed > 0 ? "#dc2626" : "#10b981",
                  marginBottom: 8,
                }}
              >
                처리 완료: 성공 {bulkResults.success}명, 실패 {bulkResults.failed}명
              </div>
              {bulkResults.errors.length > 0 && (
                <div style={{ maxHeight: "100px", overflowY: "auto", fontSize: 11, fontFamily: "monospace" }}>
                  {bulkResults.errors.map((err, idx) => (
                    <div key={idx} style={{ marginBottom: 4, color: "#991b1b" }}>
                      {err.row}행 ({err.email}): {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleBulkImport}
            disabled={bulkProcessing || !bulkInput.trim()}
            style={{
              padding: "10px 20px",
              borderRadius: 6,
              border: "none",
              background: bulkProcessing || !bulkInput.trim() ? "#d1d5db" : "#10b981",
              color: "white",
              fontWeight: 500,
              fontSize: 13,
              cursor: bulkProcessing || !bulkInput.trim() ? "not-allowed" : "pointer",
            }}
          >
            {bulkProcessing ? "처리 중..." : "일괄 등록"}
          </button>
        </div>
      )}

      {/* 회원 목록 테이블 */}
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
                {isAdmin && filterMode === "pending" && (
                  <th
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#374151",
                      fontSize: 12,
                      borderBottom: "1px solid #e5e7eb",
                      width: 40,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        filtered.filter((p) => p.approved !== true).length > 0 &&
                        filtered.filter((p) => p.approved !== true).every((p) => selectedIds.has(p.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllPending();
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      style={{
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                        accentColor: "#3b82f6",
                      }}
                    />
                  </th>
                )}
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: 12,
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  이름
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: 12,
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  나이
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: 12,
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  생년월일
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: 12,
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  전화번호
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: 12,
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  이메일
                </th>
                {isAdmin && (
                  <>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#374151",
                        fontSize: 12,
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      직분
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#374151",
                        fontSize: 12,
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      권한
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#374151",
                        fontSize: 12,
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      담당교육부서
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#374151",
                        fontSize: 12,
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      승인
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#374151",
                        fontSize: 12,
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      수정
                    </th>
                  </>
                )}
                {!isAdmin && (
                  <th
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#374151",
                      fontSize: 12,
                      borderBottom: "1px solid #e5e7eb",
                      whiteSpace: "nowrap",
                    }}
                  >
                    직분
                  </th>
                )}
                {!isAdmin && (
                  <th
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#374151",
                      fontSize: 12,
                      borderBottom: "1px solid #e5e7eb",
                      whiteSpace: "nowrap",
                    }}
                  >
                    담당교육부서
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    backgroundColor: selectedIds.has(p.id) ? "#f0fdf4" : "transparent",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIds.has(p.id)) {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedIds.has(p.id)) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {isAdmin && filterMode === "pending" && (
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        style={{
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                          accentColor: "#3b82f6",
                        }}
                      />
                    </td>
                  )}
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ color: "#1f2937", fontWeight: 500 }}>
                      {editingId === p.id ? (
                        <input
                          value={p.full_name ?? ""}
                          onChange={(e) => updateLocal(p.id, { full_name: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #e5e7eb",
                            fontSize: 13,
                          }}
                        />
                      ) : (
                        p.full_name || "-"
                      )}
                    </span>
                  </td>

                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {calculateAge(p.birth) !== null ? `${calculateAge(p.birth)}세` : "-"}
                  </td>

                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {(() => {
                      if (!p.birth) return "-";
                      try {
                        const dateStr = p.birth;
                        let date: Date;
                        
                        if (typeof dateStr === 'string') {
                          date = new Date(dateStr);
                        } else {
                          return "-";
                        }
                        
                        if (isNaN(date.getTime())) {
                          return "-";
                        }
                        
                        // 1982.9.30 형식으로 표시
                        const year = date.getFullYear();
                        const month = date.getMonth() + 1;
                        const day = date.getDate();
                        return `${year}.${month}.${day}`;
                      } catch (err) {
                        return "-";
                      }
                    })()}
                  </td>

                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {p.phone || "-"}
                  </td>

                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {p.email ?? "-"}
                  </td>

                  {isAdmin && (
                    <>
                      <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                        {editingId === p.id ? (
                          <input
                            value={p.position ?? ""}
                            onChange={(e) => updateLocal(p.id, { position: e.target.value })}
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: 4,
                              border: "1px solid #e5e7eb",
                              fontSize: 13,
                            }}
                          />
                        ) : (
                          p.position || "-"
                        )}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        {editingId === p.id ? (
                          <select
                            value={p.role ?? "member"}
                            onChange={(e) => updateLocal(p.id, { role: e.target.value })}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 4,
                              border: "1px solid #e5e7eb",
                              backgroundColor: "white",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            <option value="member">member</option>
                            <option value="leader">leader</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <span style={{ color: "#6b7280", fontSize: 12 }}>
                            {p.role === "admin" ? "관리자" : p.role === "leader" ? "리더" : "멤버"}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                        {editingId === p.id ? (
                          <select
                            value={p.department ?? ""}
                            onChange={(e) => updateLocal(p.id, { department: e.target.value || null })}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 4,
                              border: "1px solid #e5e7eb",
                              backgroundColor: "white",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            <option value="">없음</option>
                            <option value="유치부">유치부</option>
                            <option value="유초등부">유초등부</option>
                            <option value="청소년부">청소년부</option>
                            <option value="청년부">청년부</option>
                          </select>
                        ) : (
                          p.department || "-"
                        )}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        {editingId === p.id ? (
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={p.approved === true}
                              onChange={(e) => updateLocal(p.id, { approved: e.target.checked })}
                              style={{
                                width: 16,
                                height: 16,
                                cursor: "pointer",
                                accentColor: "#3b82f6",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                color: p.approved ? "#10b981" : "#ef4444",
                              }}
                            >
                              {p.approved ? "✓" : "✗"}
                            </span>
                          </label>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: p.approved ? "#10b981" : "#ef4444",
                            }}
                          >
                            {p.approved ? "✓" : "✗"}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "10px 12px" }}>
                        {editingId === p.id ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => saveProfile(p)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 4,
                                border: "none",
                                background: "#10b981",
                                color: "white",
                                fontWeight: 500,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              저장
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 4,
                                border: "1px solid #e5e7eb",
                                background: "#ffffff",
                                color: "#374151",
                                fontWeight: 500,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(p.id)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 4,
                              border: "1px solid #e5e7eb",
                              background: "transparent",
                              color: "#374151",
                              fontWeight: 500,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            수정
                          </button>
                        )}
                      </td>
                    </>
                  )}
                  {!isAdmin && (
                    <>
                      <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                        {p.position || "-"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                        {p.department || "-"}
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: "#9ca3af",
                      fontSize: 13,
                    }}
                    colSpan={isAdmin ? (filterMode === "pending" ? 11 : 10) : 7}
                  >
                    표시할 회원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
