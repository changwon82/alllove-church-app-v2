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
  created_at: string | null;
};

type Stats = {
  total: number;
  approved: number;
  pending: number;
  byDepartment: Record<string, number>;
  byPosition: Record<string, number>;
  recentMembers: Profile[];
};

export default function StatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (myProfile?.role !== "admin") {
        router.push("/");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, position, department, approved, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("통계 조회 에러:", error);
        setLoading(false);
        return;
      }

      const profiles = (data ?? []) as Profile[];

      const statsData: Stats = {
        total: profiles.length,
        approved: profiles.filter((p) => p.approved === true).length,
        pending: profiles.filter((p) => p.approved !== true).length,
        byDepartment: {},
        byPosition: {},
        recentMembers: profiles.slice(0, 10),
      };

      profiles.forEach((p) => {
        if (p.department) {
          statsData.byDepartment[p.department] = (statsData.byDepartment[p.department] || 0) + 1;
        }
        if (p.position) {
          statsData.byPosition[p.position] = (statsData.byPosition[p.position] || 0) + 1;
        }
      });

      setStats(statsData);
      setLoading(false);
    };

    loadStats();
  }, [router]);

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

  if (!stats) {
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
        통계를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
          통계 대시보드
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>회원 통계 및 현황을 확인합니다</p>
      </div>

      {/* 전체 통계 카드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>전체 회원</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1f2937" }}>{stats.total}</div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>승인됨</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{stats.approved}</div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>미승인</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444" }}>{stats.pending}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
        {/* 부서별 통계 */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>부서별 회원 수</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(stats.byDepartment).length > 0 ? (
              Object.entries(stats.byDepartment)
                .sort((a, b) => b[1] - a[1])
                .map(([dept, count]) => (
                  <div key={dept} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{dept}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{count}명</span>
                  </div>
                ))
            ) : (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>부서 정보가 없습니다.</div>
            )}
          </div>
        </div>

        {/* 직분별 통계 */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>직분별 회원 수</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(stats.byPosition).length > 0 ? (
              Object.entries(stats.byPosition)
                .sort((a, b) => b[1] - a[1])
                .map(([pos, count]) => (
                  <div key={pos} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{pos}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{count}명</span>
                  </div>
                ))
            ) : (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>직분 정보가 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      {/* 최근 가입 회원 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "16px",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>최근 가입 회원</h2>
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
                  }}
                >
                  가입일
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: 12,
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  승인
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recentMembers.map((member) => (
                <tr key={member.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", color: "#1f2937", fontWeight: 500 }}>
                    {member.full_name || "-"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>{member.email || "-"}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                    {member.created_at ? new Date(member.created_at).toLocaleDateString("ko-KR") : "-"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: member.approved ? "#10b981" : "#ef4444",
                      }}
                    >
                      {member.approved ? "✓" : "✗"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
