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
  attendance_permission: boolean | null;
};

type FilterMode = "all" | "approved" | "pending";

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; email: string; error: string }>;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadAll = async () => {
    setLoading(true);
    try {
      setStatus("관리자 권한 확인 중...");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setStatus("로그인이 필요합니다.");
        router.push("/login");
        return;
      }

      setCurrentUserEmail(user.email ?? null);

      const { data: myProfile, error: myErr } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (myErr) {
        console.error("내 프로필 조회 에러:", myErr);
        setStatus("프로필 조회 중 오류가 발생했습니다.");
        return;
      }
      if (!myProfile) {
        setStatus("내 프로필이 없습니다. 관리자에게 문의하세요.");
        return;
      }
      if (myProfile.role !== "admin") {
        setStatus("관리자만 접근할 수 있습니다.");
        router.push("/");
        return;
      }

      setStatus("회원 목록 불러오는 중...");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, position, department, approved, attendance_permission")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("전체 프로필 조회 에러:", error);
        setStatus("회원 목록을 불러오는 중 오류가 발생했습니다.");
        return;
      }

      setProfiles((data ?? []) as Profile[]);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterMode]);

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
            (p.department ?? "").toLowerCase().includes(q);

      return okFilter && okSearch;
    });
  }, [profiles, filterMode, search]);

  const updateLocal = (id: string, patch: Partial<Profile>) => {
    // 부서가 선택되면 자동으로 출석체크 권한 부여
    if (patch.department && patch.department.trim() !== "") {
      patch.attendance_permission = true;
    }
    
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
      attendance_permission: p.attendance_permission,
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", p.id);

    if (error) {
      console.error("프로필 저장 에러:", error);
      alert("저장 실패: " + (error.message ?? "알 수 없는 오류"));
      return;
    }

    alert("저장 완료!");
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
      
      // 요청 속도 제한을 피하기 위해 각 요청 사이에 지연 추가 (200ms)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      try {
        // 먼저 profiles 테이블에서 이메일로 기존 사용자 확인
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("email", user.email)
          .maybeSingle();
        
        let userId: string | null = null;
        
        if (existingProfile) {
          // 이미 등록된 사용자 - 프로필만 업데이트
          userId = existingProfile.id;
        } else {
          // 새 사용자 생성 시도
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: user.email,
            password: user.password,
          });

          if (authError) {
            // "User already registered" 에러인 경우 profiles 테이블 다시 확인
            if (authError.message.includes("already registered") || 
                authError.message.includes("already exists") ||
                authError.message.includes("rate limit")) {
              
              // rate limit 에러인 경우 잠시 대기 후 다시 시도
              if (authError.message.includes("rate limit")) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                // profiles 테이블에서 확인
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
                    error: "요청 속도 제한에 걸렸습니다. 나중에 다시 시도해주세요.",
                  });
                  continue;
                }
              } else {
                // 이미 등록된 사용자지만 profiles에 없는 경우 (드문 경우)
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

        // 프로필 데이터 준비
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
          // 프로필 업데이트 (upsert 사용)
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
          // 새 프로필 생성
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
      await loadAll();
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
    await loadAll();
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

  if (status) {
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
        {status}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
          관리자 페이지
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>회원 관리 및 시스템 설정</p>
      </div>

      {/* 필터/검색 */}
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
          <option value="all">전체</option>
          <option value="approved">승인됨</option>
          <option value="pending">미승인</option>
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름/이메일/부서 검색"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            minWidth: 180,
            flex: 1,
          }}
        />

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
          {showBulkImport ? "닫기" : "일괄 입력"}
        </button>

        <button
          onClick={loadAll}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#6b7280",
            color: "white",
            fontWeight: 500,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          새로고침
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

        <div
          style={{
            marginLeft: "auto",
            color: "#6b7280",
            fontSize: 12,
            padding: "8px 12px",
            backgroundColor: "#f3f4f6",
            borderRadius: 6,
          }}
        >
          {filtered.length}명
        </div>
      </div>

      {/* 일괄 입력 섹션 */}
      {showBulkImport && (
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

      {/* 테이블 */}
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
                {filterMode === "pending" && (
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
                  이메일
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
                  출석체크 권한
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
                  부서
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
                  저장
                </th>
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
                  {filterMode === "pending" && (
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
                  </td>

                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {p.email ?? "-"}
                  </td>

                  <td style={{ padding: "10px 12px" }}>
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
                  </td>

                  <td style={{ padding: "10px 12px" }}>
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
                  </td>

                  <td style={{ padding: "10px 12px" }}>
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
                        checked={p.attendance_permission === true}
                        onChange={(e) => updateLocal(p.id, { attendance_permission: e.target.checked })}
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
                          color: p.attendance_permission ? "#10b981" : "#9ca3af",
                        }}
                      >
                        {p.attendance_permission ? "✓" : "✗"}
                      </span>
                    </label>
                  </td>

                  <td style={{ padding: "10px 12px" }}>
                    <input
                      value={p.position ?? ""}
                      onChange={(e) => updateLocal(p.id, { position: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                      }}
                      placeholder="직분"
                    />
                  </td>

                  <td style={{ padding: "10px 12px" }}>
                    <select
                      value={p.department ?? ""}
                      onChange={(e) => {
                        const newDepartment = e.target.value;
                        updateLocal(p.id, { 
                          department: newDepartment,
                          // 부서가 선택되면 자동으로 출석체크 권한 부여
                          attendance_permission: newDepartment.trim() !== "" ? true : p.attendance_permission
                        });
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                        backgroundColor: "white",
                        cursor: "pointer",
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
                  </td>

                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => saveProfile(p)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 4,
                        border: "none",
                        background: "#3b82f6",
                        color: "white",
                        fontWeight: 500,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      저장
                    </button>
                  </td>
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
                    colSpan={filterMode === "pending" ? 8 : 7}
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
