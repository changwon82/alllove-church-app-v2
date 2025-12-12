"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  department: string | null;
};

export default function ContactsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  useEffect(() => {
    const loadContacts = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, department")
        .not("phone", "is", null)
        .order("full_name", { ascending: true });

      if (error) {
        console.error("연락처 조회 에러:", error);
        setLoading(false);
        return;
      }

      setProfiles((data ?? []) as Profile[]);
      setLoading(false);
    };

    loadContacts();
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return profiles.filter((p) => {
      const okSearch =
        q.length === 0
          ? true
          : (p.full_name ?? "").toLowerCase().includes(q) ||
            (p.phone ?? "").toLowerCase().includes(q) ||
            (p.email ?? "").toLowerCase().includes(q);

      const okDepartment = departmentFilter === "all" || p.department === departmentFilter;

      return okSearch && okDepartment;
    });
  }, [profiles, search, departmentFilter]);

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
          연락처 관리
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>회원 연락처를 확인합니다</p>
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
          placeholder="이름/전화번호/이메일 검색"
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

      {/* 연락처 목록 - 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {filtered.map((p) => (
          <div
            key={p.id}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 8,
              padding: "16px",
              border: "1px solid #e5e7eb",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(59, 130, 246, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
              {p.full_name || "-"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>전화:</span> {p.phone || "-"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>이메일:</span> {p.email || "-"}
            </div>
            {p.department && (
              <div
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px solid #f3f4f6",
                }}
              >
                {p.department}
              </div>
            )}
            {p.phone && (
              <a
                href={`tel:${p.phone}`}
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "#3b82f6",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                전화 걸기
              </a>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "32px",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            표시할 연락처가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
