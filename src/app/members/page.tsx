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
};

export default function MembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [approvedFilter, setApprovedFilter] = useState<string>("all");

  useEffect(() => {
    const loadMembers = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, position, department, approved, phone")
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return profiles.filter((p) => {
      const okSearch =
        q.length === 0
          ? true
          : (p.full_name ?? "").toLowerCase().includes(q) ||
            (p.email ?? "").toLowerCase().includes(q) ||
            (p.phone ?? "").toLowerCase().includes(q);

      const okDepartment = departmentFilter === "all" || p.department === departmentFilter;
      const okPosition = positionFilter === "all" || p.position === positionFilter;
      const okApproved =
        approvedFilter === "all"
          ? true
          : approvedFilter === "approved"
          ? p.approved === true
          : p.approved !== true;

      return okSearch && okDepartment && okPosition && okApproved;
    });
  }, [profiles, search, departmentFilter, positionFilter, approvedFilter]);

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
          회원 조회
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>회원 목록을 조회하고 검색합니다</p>
      </div>

      {/* 필터 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: "12px",
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름/이메일/전화번호 검색"
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
          <option value="유초등부">유초등부</option>
          <option value="아동부">아동부</option>
          <option value="중고등부">중고등부</option>
          <option value="청년부">청년부</option>
          <option value="장년부">장년부</option>
          <option value="찬양팀">찬양팀</option>
          <option value="안내팀">안내팀</option>
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

        <select
          value={approvedFilter}
          onChange={(e) => setApprovedFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
          }}
        >
          <option value="all">전체</option>
          <option value="approved">승인됨</option>
          <option value="pending">미승인</option>
        </select>

        <div
          style={{
            marginLeft: "auto",
            color: "#6b7280",
            fontSize: 12,
            padding: "8px 12px",
            backgroundColor: "#f3f4f6",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
          }}
        >
          {filtered.length}명
        </div>
      </div>

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
                  승인
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <td style={{ padding: "10px 12px", color: "#1f2937", fontWeight: 500 }}>
                    {p.full_name || "-"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {p.email || "-"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {p.phone || "-"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {p.position || "-"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {p.department || "-"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: p.approved ? "#10b981" : "#ef4444",
                      }}
                    >
                      {p.approved ? "✓" : "✗"}
                    </span>
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
                    colSpan={6}
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
