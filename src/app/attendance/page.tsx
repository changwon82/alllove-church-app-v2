"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
  status_prayer: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  department: string | null;
  position: string | null;
};

const departments = ["유치부", "유초등부", "청소년부", "청년부"];

// 현황&기도제목 알림 배지 컴포넌트 (깜빡이는 효과)
function StatusPrayerBadge({ count }: { count: number }) {
  const [isBlinking, setIsBlinking] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking((prev) => !prev);
    }, 800); // 0.8초마다 깜빡임

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        backgroundColor: "#ef4444",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 600,
        opacity: isBlinking ? 1 : 0.5,
        transition: "opacity 0.3s ease",
      }}
    >
      {count}
    </div>
  );
}

// 부서별 명단 테이블 컴포넌트
function DepartmentMembersTable({
  deptMembers,
  records,
  statusPrayers,
  sundayDate,
  onStatusPrayerClick,
  onSaveStatusPrayer,
  isReported,
}: {
  deptMembers: AttendanceMember[];
  records: Record<string, Record<string, boolean>>;
  statusPrayers: Record<string, Record<string, string>>;
  sundayDate: string;
  onStatusPrayerClick: (memberId: string, date: string, currentText: string) => void;
  onSaveStatusPrayer?: (memberId: string, date: string, text: string) => Promise<void>;
  isReported?: boolean;
}) {
  const [editingMemberIds, setEditingMemberIds] = useState<Set<string>>(new Set());
  const [editTexts, setEditTexts] = useState<Record<string, string>>({});

  const handleStartEdit = (memberId: string, currentText: string) => {
    if (isReported) return; // 보고완료 상태면 편집 불가
    setEditingMemberIds((prev) => new Set(prev).add(memberId));
    setEditTexts((prev) => ({ ...prev, [memberId]: currentText }));
  };

  const handleUpdateText = (memberId: string, text: string) => {
    setEditTexts((prev) => ({ ...prev, [memberId]: text }));
  };

  const handleCancelEdit = (memberId: string) => {
    setEditingMemberIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(memberId);
      return newSet;
    });
    setEditTexts((prev) => {
      const newTexts = { ...prev };
      delete newTexts[memberId];
      return newTexts;
    });
  };

  const handleSaveAll = async () => {
    if (!onSaveStatusPrayer) {
      // onSaveStatusPrayer가 없으면 기존 방식 사용
      editingMemberIds.forEach((memberId) => {
        const text = editTexts[memberId] || "";
        onStatusPrayerClick(memberId, sundayDate, text);
      });
      setEditingMemberIds(new Set());
      setEditTexts({});
      return;
    }

    // 여러 개를 한 번에 저장
    const savePromises = Array.from(editingMemberIds).map(async (memberId) => {
      const text = editTexts[memberId] || "";
      await onSaveStatusPrayer(memberId, sundayDate, text);
    });

    try {
      await Promise.all(savePromises);
      setEditingMemberIds(new Set());
      setEditTexts({});
    } catch (error) {
      console.error("저장 중 오류:", error);
    }
  };

  const hasEditingItems = editingMemberIds.size > 0;

  return (
    <div>
      {hasEditingItems && (
        <div style={{ 
          marginTop: 12, 
          marginBottom: 12, 
          marginRight: 12,
          display: "flex", 
          justifyContent: "flex-end", 
          gap: 10,
        }}>
          <button
            onClick={() => {
              setEditingMemberIds(new Set());
              setEditTexts({});
            }}
            style={{
              padding: "5px 20px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#6b7280",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f9fafb";
              e.currentTarget.style.borderColor = "#d1d5db";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "#e5e7eb";
            }}
          >
            모두 취소
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isReported}
            style={{
              padding: "5px 20px",
              borderRadius: 8,
              border: "none",
              background: isReported ? "#9ca3af" : "#3b82f6",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 500,
              cursor: isReported ? "not-allowed" : "pointer",
              opacity: isReported ? 0.6 : 1,
              transition: "all 0.2s ease",
              boxShadow: isReported ? "none" : "0 2px 4px rgba(59, 130, 246, 0.3)",
            }}
            onMouseEnter={(e) => {
              if (!isReported) {
                e.currentTarget.style.background = "#2563eb";
                e.currentTarget.style.boxShadow = "0 4px 6px rgba(59, 130, 246, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isReported) {
                e.currentTarget.style.background = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(59, 130, 246, 0.3)";
              }
            }}
          >
            모두 저장 ({editingMemberIds.size})
          </button>
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ padding: "10px 6px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", width: "35px" }}>
              번호
            </th>
            <th style={{ padding: "10px 6px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", width: "100px" }}>
              이름
            </th>
            <th style={{ padding: "10px 6px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", width: "45px" }}>
              출석
            </th>
          <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
            현황&기도제목
          </th>
          </tr>
        </thead>
      <tbody>
        {deptMembers.map((member, idx) => {
          const isAttended = records[member.id]?.[sundayDate] === true;
          const statusPrayer = statusPrayers[member.id]?.[sundayDate] || "";
          
          // 나이 계산
          let age = null;
          if (member.birth_date) {
            const birthYear = new Date(member.birth_date).getFullYear();
            const currentYear = new Date().getFullYear();
            age = currentYear - birthYear + 1; // 한국식 나이
          }
          
          return (
            <tr
              key={member.id}
              style={{
                borderBottom: idx < deptMembers.length - 1 ? "1px solid #e5e7eb" : "none",
                backgroundColor: isAttended ? "#f0fdf4" : "#ffffff",
              }}
            >
              <td style={{ padding: "5px 6px", fontSize: 13, color: "#6b7280", textAlign: "center", whiteSpace: "nowrap", backgroundColor: "#f3f4f6" }}>
                {idx + 1}
              </td>
              <td style={{ padding: "5px 6px", fontSize: 13, color: "#1f2937", textAlign: "center", whiteSpace: "nowrap", backgroundColor: "#f3f4f6" }}>
                {member.name}
                {member.gender && age && (
                  <span style={{ fontSize: 12 }}>
                    {' '}(
                    <span style={{ color: member.gender === "여" ? "#ef4444" : "#3b82f6" }}>
                      {member.gender}
                    </span>
                    /{age})
                  </span>
                )}
              </td>
              <td style={{ padding: "5px 6px", fontSize: 13, color: "#9ca3af", textAlign: "center", whiteSpace: "nowrap", backgroundColor: "#f3f4f6" }}>
                {isAttended ? (
                  <span
                    style={{
                      display: "inline-block",
                      backgroundColor: "#10b981",
                      color: "#ffffff",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    출석
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td style={{ padding: "5px 12px", fontSize: 13, textAlign: "left", backgroundColor: "#f9fafb" }}>
                {editingMemberIds.has(member.id) ? (
                  <textarea
                    value={editTexts[member.id] || ""}
                    onChange={(e) => handleUpdateText(member.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        handleCancelEdit(member.id);
                      }
                    }}
                    style={{
                      width: "100%",
                      minHeight: 60,
                      padding: "8px",
                      borderRadius: 4,
                      border: "1px solid #e5e7eb",
                      fontSize: 13,
                      fontFamily: "inherit",
                      resize: "vertical",
                      outline: "none",
                    }}
                    autoFocus
                  />
                ) : statusPrayer ? (
                  <div
                    onClick={() => handleStartEdit(member.id, statusPrayer)}
                    style={{
                      color: "#1f2937",
                      cursor: isReported ? "not-allowed" : "pointer",
                      whiteSpace: "pre-wrap",
                      textAlign: "left",
                      wordBreak: "break-word",
                    }}
                    title={isReported ? "보고완료 상태로 편집할 수 없습니다" : statusPrayer}
                  >
                    {isReported && (
                      <span style={{ 
                        marginRight: "6px",
                        color: "#9ca3af",
                        fontSize: "12px",
                      }}>
                        🔒
                      </span>
                    )}
                    {statusPrayer}
                  </div>
                ) : !isReported && (
                  <button
                    onClick={() => handleStartEdit(member.id, "")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 4,
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      color: "#6b7280",
                      fontSize: 12,
                      cursor: "pointer",
                      marginLeft: "auto",
                      display: "block",
                    }}
                  >
                    입력
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, boolean>>>({});
  const [statusPrayers, setStatusPrayers] = useState<Record<string, Record<string, string>>>({}); // member_id -> date -> status_prayer
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
  const [showAdminCalendar, setShowAdminCalendar] = useState(false);
  const [showManagerCalendar, setShowManagerCalendar] = useState(false);
  const adminCalendarAnchorRef = useRef<HTMLHeadingElement | null>(null);
  const managerCalendarAnchorRef = useRef<HTMLHeadingElement | null>(null);
  const [reports, setReports] = useState<Record<string, Record<string, boolean>>>({}); // department -> sunday_date -> true
  const [showStatusPrayerModal, setShowStatusPrayerModal] = useState(false);
  const [editingStatusPrayer, setEditingStatusPrayer] = useState<{ memberId: string; date: string; currentText: string } | null>(null);
  const [statusPrayerInput, setStatusPrayerInput] = useState("");

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

  // 달력 컴포넌트를 위한 헬퍼 함수
  const getDaysInMonth = (year: number, month: number): Date[] => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    
    // 이번 달 첫 날의 요일 (0=일요일, 1=월요일, ...)
    const firstDayOfWeek = firstDay.getDay();
    
    // 이번 달 이전의 빈 칸 추가 (일요일이 0이므로 0부터 시작)
    for (let i = 0; i < firstDayOfWeek; i++) {
      const date = new Date(year, month, 1 - firstDayOfWeek + i);
      days.push(date);
    }
    
    // 이번 달의 모든 날짜 추가
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  // 커스텀 달력 컴포넌트
  const CustomCalendar = ({
    selectedSunday,
    onSelect,
    onClose,
    maxSunday,
    anchorElement,
  }: {
    selectedSunday: string | null;
    onSelect: (sunday: string) => void;
    onClose: () => void;
    maxSunday: string;
    anchorElement?: HTMLElement | HTMLHeadingElement | null;
  }) => {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    const days = getDaysInMonth(year, month);
    
    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
    
    const handleDateClick = (date: Date) => {
      const selectedSunday = getSundayForDate(date);
      const maxSundayDate = new Date(maxSunday);
      const selectedSundayDate = new Date(selectedSunday);
      
      if (selectedSundayDate <= maxSundayDate) {
        onSelect(selectedSunday);
        onClose();
      }
    };
    
    const isDateDisabled = (date: Date): boolean => {
      const sunday = getSundayForDate(date);
      const maxSundayDate = new Date(maxSunday);
      const sundayDate = new Date(sunday);
      return sundayDate > maxSundayDate;
    };
    
    const isDateSelected = (date: Date): boolean => {
      if (!selectedSunday) return false;
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return dateStr === selectedSunday;
    };
    
    const isDateSunday = (date: Date): boolean => {
      return date.getDay() === 0;
    };
    
    const prevMonth = () => {
      setCurrentMonth(new Date(year, month - 1, 1));
    };
    
    const nextMonth = () => {
      const maxDate = new Date(maxSunday);
      const nextMonthDate = new Date(year, month + 1, 1);
      if (nextMonthDate <= new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1)) {
        setCurrentMonth(nextMonthDate);
      }
    };

    // 클릭한 요소의 위치 계산
    const [calendarPosition, setCalendarPosition] = useState<{ top: number; left: number } | null>(null);
    
    useEffect(() => {
      if (anchorElement) {
        const rect = anchorElement.getBoundingClientRect();
        const calendarWidth = 240; // 320 * 0.75
        const calendarHeight = 300; // 400 * 0.75
        const padding = 10;
        
        let top = rect.bottom + padding;
        let left = rect.left + (rect.width / 2) - (calendarWidth / 2);
        
        // 화면 밖으로 나가지 않도록 조정
        if (left < padding) {
          left = padding;
        } else if (left + calendarWidth > window.innerWidth - padding) {
          left = window.innerWidth - calendarWidth - padding;
        }
        
        // 아래쪽 공간이 부족하면 위쪽에 표시
        if (top + calendarHeight > window.innerHeight - padding) {
          top = rect.top - calendarHeight - padding;
          if (top < padding) {
            top = padding;
          }
        }
        
        setCalendarPosition({ top, left });
      } else {
        // anchorElement가 없으면 중앙에 표시
        setCalendarPosition(null);
      }
    }, [anchorElement]);
    
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          zIndex: 2000,
          display: "flex",
          justifyContent: calendarPosition ? "flex-start" : "center",
          alignItems: calendarPosition ? "flex-start" : "center",
          padding: "20px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: "16px", // 20px * 0.8 (약간만 줄임)
            width: "100%",
            maxWidth: 240, // 320 * 0.75
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            position: calendarPosition ? "absolute" : "relative",
            top: calendarPosition ? `${calendarPosition.top}px` : "auto",
            left: calendarPosition ? `${calendarPosition.left}px` : "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button
              onClick={prevMonth}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#374151",
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f9fafb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
              }}
            >
              ◀
            </button>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
              {year}년 {monthNames[month]}
            </div>
            <button
              onClick={nextMonth}
              disabled={
                year > today.getFullYear() ||
                (year === today.getFullYear() && month >= today.getMonth())
              }
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background:
                  year > today.getFullYear() ||
                  (year === today.getFullYear() && month >= today.getMonth())
                    ? "#f9fafb"
                    : "#ffffff",
                color:
                  year > today.getFullYear() ||
                  (year === today.getFullYear() && month >= today.getMonth())
                    ? "#9ca3af"
                    : "#374151",
                fontSize: 14,
                cursor:
                  year > today.getFullYear() ||
                  (year === today.getFullYear() && month >= today.getMonth())
                    ? "not-allowed"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                if (
                  !(
                    year > today.getFullYear() ||
                    (year === today.getFullYear() && month >= today.getMonth())
                  )
                ) {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  year > today.getFullYear() ||
                  (year === today.getFullYear() && month >= today.getMonth())
                    ? "#f9fafb"
                    : "#ffffff";
              }}
            >
              ▶
            </button>
          </div>
          
          {/* 요일 헤더 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
            {weekDays.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: day === "일" ? "#ef4444" : day === "토" ? "#3b82f6" : "#6b7280",
                  padding: "6px 3px",
                }}
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* 날짜 그리드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {days.map((date, index) => {
              const isDisabled = isDateDisabled(date);
              const isSelected = isDateSelected(date);
              const isSunday = isDateSunday(date);
              const isCurrentMonthDate = date.getMonth() === month;
              const isToday = date.toDateString() === today.toDateString() && isCurrentMonthDate;
              
              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(date)}
                  disabled={isDisabled}
                  style={{
                    aspectRatio: "1",
                    padding: 0,
                    borderRadius: 8,
                    border: "none",
                    background: isSelected
                      ? "#3b82f6"
                      : isToday
                      ? "#f0f9ff"
                      : "transparent",
                    color: !isCurrentMonthDate
                      ? "#d1d5db"
                      : isDisabled
                      ? "#d1d5db"
                      : isSelected
                      ? "#ffffff"
                      : isSunday
                      ? "#ef4444"
                      : "#374151",
                    fontSize: 13,
                    fontWeight: isSelected || isToday ? 600 : 400,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isSelected) {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isToday) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          
          {/* 닫기 버튼 */}
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f9fafb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
              }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
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
          const statusPrayersMap: Record<string, Record<string, string>> = {};
          (recordsData as AttendanceRecord[]).forEach((record) => {
            if (!recordsMap[record.member_id]) {
              recordsMap[record.member_id] = {};
            }
            recordsMap[record.member_id][record.date] = record.attended;
            
            // status_prayer 저장
            if (record.status_prayer) {
              if (!statusPrayersMap[record.member_id]) {
                statusPrayersMap[record.member_id] = {};
              }
              statusPrayersMap[record.member_id][record.date] = record.status_prayer;
            }
          });
          setRecords(recordsMap);
          setStatusPrayers(statusPrayersMap);
        }

        // 출석 보고 기록 불러오기 (최근 8주분 로드)
        const uniqueSundays: string[] = [];
        for (let weekOffset = 0; weekOffset < 8; weekOffset++) {
          const sunday = new Date(currentSunday);
          sunday.setDate(new Date(currentSunday).getDate() - (weekOffset * 7));
          uniqueSundays.push(getSundayForDate(sunday));
        }

        const { data: reportsData, error: reportsError } = await supabase
          .from("attendance_reports")
          .select("*")
          .in("sunday_date", uniqueSundays);

        if (reportsError) {
          console.error("출석 보고 기록 조회 에러:", reportsError);
        } else {
          const reportsMap: Record<string, Record<string, boolean>> = {};
          (reportsData as { department: string; sunday_date: string }[]).forEach((report) => {
            if (!reportsMap[report.department]) {
              reportsMap[report.department] = {};
            }
            reportsMap[report.department][report.sunday_date] = true;
          });
          setReports(reportsMap);
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

  // 출석 보고 기록 실시간 구독 (Supabase Realtime)
  useEffect(() => {
    if (!hasPermission) return;

    const reportsChannel = supabase
      .channel("attendance_reports_changes")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE 모두 구독
          schema: "public",
          table: "attendance_reports",
        },
        (payload) => {
          console.log("📥 보고완료 기록 변경 감지:", payload);
          console.log("📥 payload.eventType:", payload.eventType);
          console.log("📥 payload.new:", payload.new);
          console.log("📥 payload.old:", payload.old);
          
          // 실시간으로 reports state 업데이트
          setReports((prev) => {
            const newReports = { ...prev };
            
            // INSERT/UPDATE의 경우 payload.new 사용, DELETE의 경우 payload.old 사용
            let department: string | undefined;
            let sundayDate: string | undefined;
            
            if (payload.eventType === "DELETE") {
              // DELETE 이벤트는 payload.old에 삭제된 행의 정보가 있어야 함
              // REPLICA IDENTITY FULL이 설정되어 있지 않으면 payload.old가 비어있을 수 있음
              const oldData = payload.old as { department?: string; sunday_date?: string } | null;
              department = oldData?.department;
              sundayDate = oldData?.sunday_date;
              console.log("🗑️ DELETE 이벤트 - department:", department, "sundayDate:", sundayDate, "payload.old:", payload.old);
              
              // payload.old가 없거나 필요한 데이터가 없는 경우
              // REPLICA IDENTITY FULL이 설정되지 않았을 수 있으므로, 전체 reports를 다시 로드
              if (!department || !sundayDate) {
                console.warn("⚠️ DELETE 이벤트에서 department 또는 sundayDate를 찾을 수 없음. REPLICA IDENTITY FULL이 설정되어 있는지 확인하세요. 전체 데이터를 다시 로드합니다.", { payload });
                
                // 최근 8주간의 보고완료 기록을 다시 가져옴
                const today = new Date();
                const currentSunday = getSundayForDate(today);
                const uniqueSundays: string[] = [];
                for (let weekOffset = 0; weekOffset < 8; weekOffset++) {
                  const sunday = new Date(currentSunday);
                  sunday.setDate(new Date(currentSunday).getDate() - (weekOffset * 7));
                  uniqueSundays.push(getSundayForDate(sunday));
                }
                
                supabase
                  .from("attendance_reports")
                  .select("department, sunday_date")
                  .in("sunday_date", uniqueSundays)
                  .then(({ data, error }) => {
                    if (error) {
                      console.error("보고완료 기록 재로드 에러:", error);
                      return;
                    }
                    const reportsMap: Record<string, Record<string, boolean>> = {};
                    (data || []).forEach((report: { department: string; sunday_date: string }) => {
                      if (!reportsMap[report.department]) {
                        reportsMap[report.department] = {};
                      }
                      reportsMap[report.department][report.sunday_date] = true;
                    });
                    setReports(reportsMap);
                    console.log("✅ 보고완료 기록 재로드 완료:", reportsMap);
                  });
                
                // 즉시 업데이트하지 않고 재로드 대기
                return prev;
              }
            } else {
              // INSERT/UPDATE 이벤트는 payload.new에 새/업데이트된 행의 정보가 있음
              const newData = payload.new as { department?: string; sunday_date?: string } | null;
              department = newData?.department;
              sundayDate = newData?.sunday_date;
              console.log("✅ INSERT/UPDATE 이벤트 - department:", department, "sundayDate:", sundayDate);
            }

            if (!department || !sundayDate) {
              console.warn("⚠️ department 또는 sundayDate가 없음:", { department, sundayDate, payload });
              return prev;
            }

            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              // 보고완료 추가 또는 업데이트
              if (!newReports[department]) {
                newReports[department] = {};
              }
              newReports[department][sundayDate] = true;
              console.log("✅ 보고완료 기록 추가/업데이트 완료:", { department, sundayDate });
            } else if (payload.eventType === "DELETE") {
              // 보고완료 삭제
              if (newReports[department]) {
                delete newReports[department][sundayDate];
                // 부서가 비어있으면 부서도 삭제
                if (Object.keys(newReports[department]).length === 0) {
                  delete newReports[department];
                }
                console.log("🗑️ 보고완료 기록 삭제 완료:", { department, sundayDate });
              } else {
                console.warn("⚠️ 삭제하려는 department가 reports에 없음:", department);
              }
            }

            return newReports;
          });
        }
      )
      .subscribe((status) => {
        console.log("📡 보고완료 기록 채널 구독 상태:", status);
      });

    return () => {
      console.log("🔌 보고완료 기록 채널 구독 해제");
      supabase.removeChannel(reportsChannel);
    };
  }, [hasPermission]);

  // 출석 기록 실시간 구독 (Supabase Realtime)
  useEffect(() => {
    if (!hasPermission) return;

    const recordsChannel = supabase
      .channel("attendance_records_changes")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE 모두 구독
          schema: "public",
          table: "attendance_records",
        },
        (payload) => {
          console.log("📥 출석 기록 변경 감지:", payload);
          console.log("📥 payload.eventType:", payload.eventType);
          console.log("📥 payload.new:", payload.new);
          console.log("📥 payload.old:", payload.old);
          
          const newData = payload.new as { member_id?: string; date?: string; attended?: boolean; status_prayer?: string | null } | null;
          const oldData = payload.old as { member_id?: string; date?: string; attended?: boolean; status_prayer?: string | null } | null;
          const memberId = newData?.member_id || oldData?.member_id;
          const date = newData?.date || oldData?.date;

          if (!memberId || !date) {
            console.warn("⚠️ memberId 또는 date가 없음:", { memberId, date, payload });
            return;
          }
          
          console.log("📥 처리 중인 데이터:", { memberId, date, status_prayer: newData?.status_prayer });

          // 실시간으로 records state 업데이트
          setRecords((prev) => {
            const newRecords = { ...prev };

            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              // 출석 기록 추가 또는 업데이트
              if (!newRecords[memberId]) {
                newRecords[memberId] = {};
              }
              newRecords[memberId][date] = newData?.attended || false;
              console.log("✅ 출석 기록 업데이트:", { memberId, date, attended: newData?.attended });
            } else if (payload.eventType === "DELETE") {
              // 출석 기록 삭제
              if (newRecords[memberId]) {
                delete newRecords[memberId][date];
                // 멤버가 비어있으면 멤버도 삭제
                if (Object.keys(newRecords[memberId]).length === 0) {
                  delete newRecords[memberId];
                }
              }
              console.log("🗑️ 출석 기록 삭제:", { memberId, date });
            }

            return newRecords;
          });

          // 실시간으로 statusPrayers state 업데이트
          setStatusPrayers((prev) => {
            const newStatusPrayers = { ...prev };

            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              // status_prayer 업데이트
              // status_prayer 필드가 payload에 있는 경우에만 업데이트 (null이거나 빈 문자열도 처리)
              if (newData && 'status_prayer' in newData) {
                if (newData.status_prayer && newData.status_prayer.trim() !== "") {
                  // status_prayer 값이 있는 경우
                  if (!newStatusPrayers[memberId]) {
                    newStatusPrayers[memberId] = {};
                  }
                  newStatusPrayers[memberId][date] = newData.status_prayer;
                  console.log("✅ 현황&기도제목 업데이트:", { memberId, date, status_prayer: newData.status_prayer, newData });
                } else {
                  // status_prayer가 null이거나 빈 값인 경우 삭제
                  if (newStatusPrayers[memberId] && newStatusPrayers[memberId][date]) {
                    delete newStatusPrayers[memberId][date];
                    if (Object.keys(newStatusPrayers[memberId]).length === 0) {
                      delete newStatusPrayers[memberId];
                    }
                  }
                  console.log("🗑️ 현황&기도제목 삭제 (null/빈값):", { memberId, date, newData });
                }
              } else {
                console.log("⚠️ status_prayer 필드가 payload에 없음:", { memberId, date, newData });
              }
            } else if (payload.eventType === "DELETE") {
              // 레코드 삭제 시 status_prayer도 삭제
              if (newStatusPrayers[memberId] && newStatusPrayers[memberId][date]) {
                delete newStatusPrayers[memberId][date];
                if (Object.keys(newStatusPrayers[memberId]).length === 0) {
                  delete newStatusPrayers[memberId];
                }
              }
              console.log("🗑️ 현황&기도제목 삭제 (레코드 삭제):", { memberId, date });
            }

            return newStatusPrayers;
          });
        }
      )
      .subscribe((status) => {
        console.log("📡 출석 기록 채널 구독 상태:", status);
      });

    return () => {
      console.log("🔌 출석 기록 채널 구독 해제");
      supabase.removeChannel(recordsChannel);
    };
  }, [hasPermission]);

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

      console.log("💾 출석 기록 저장 시도:", { memberId, date, attended: newStatus });
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
        console.error("❌ 출석 기록 저장 에러:", error);
        alert("출석 기록 저장 중 오류가 발생했습니다.");
        return;
      }

      console.log("✅ 출석 기록 저장 성공 (로컬 state 업데이트)");
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

  const handleReport = async (department: string, sundayDate: string) => {
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
        alert("로그인이 필요합니다.");
        return;
      }

      console.log("💾 보고완료 저장 시도:", { department, sundayDate });
      const { error } = await supabase.from("attendance_reports").upsert(
        {
          department: department,
          sunday_date: sundayDate,
          reported_by: user.id,
        },
        {
          onConflict: "department,sunday_date",
        }
      );

      if (error) {
        // 에러 정보를 안전하게 추출
        const errorInfo = {
          message: error?.message || "에러 메시지 없음",
          details: error?.details || null,
          hint: error?.hint || null,
          code: error?.code || null,
        };
        
        console.error("❌ 보고완료 저장 에러:", {
          ...errorInfo,
          department,
          sundayDate,
          fullError: error,
        });
        
        // 에러 객체를 문자열로 변환 시도
        try {
          const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
          console.error("에러 상세 정보:", errorString);
        } catch (stringifyError) {
          console.error("에러 직렬화 실패:", stringifyError);
        }
        
        const errorMessage = error?.message || error?.details || error?.hint || "알 수 없는 오류";
        alert(`보고완료 저장 중 오류가 발생했습니다: ${errorMessage}`);
        return;
      }

      console.log("✅ 보고완료 저장 성공 (로컬 state 업데이트)");
      // State 업데이트
      setReports((prev) => ({
        ...prev,
        [department]: {
          ...(prev[department] || {}),
          [sundayDate]: true,
        },
      }));
    } catch (err: any) {
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found") ||
        err?.status === 401
      ) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }
      console.error("보고완료 에러:", err);
      alert("보고완료 중 오류가 발생했습니다.");
    }
  };

  const handleUnreport = async (department: string, sundayDate: string) => {
    if (!confirm(`${department}의 보고완료를 해제하시겠습니까? 출석을 수정할 수 있게 됩니다.`)) {
      return;
    }

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
        alert("로그인이 필요합니다.");
        return;
      }

      console.log("💾 보고완료 해제 시도:", { department, sundayDate });
      const { error } = await supabase
        .from("attendance_reports")
        .delete()
        .eq("department", department)
        .eq("sunday_date", sundayDate);

      if (error) {
        // 에러 정보를 안전하게 추출
        const errorInfo = {
          message: error?.message || "에러 메시지 없음",
          details: error?.details || null,
          hint: error?.hint || null,
          code: error?.code || null,
        };
        
        console.error("❌ 보고완료 해제 에러:", {
          ...errorInfo,
          department,
          sundayDate,
          fullError: error,
        });
        
        // 에러 객체를 문자열로 변환 시도
        try {
          const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
          console.error("에러 상세 정보:", errorString);
        } catch (stringifyError) {
          console.error("에러 직렬화 실패:", stringifyError);
        }
        
        const errorMessage = error?.message || error?.details || error?.hint || "알 수 없는 오류";
        alert(`보고완료 해제 중 오류가 발생했습니다: ${errorMessage}`);
        return;
      }

      console.log("✅ 보고완료 해제 성공 (로컬 state 업데이트)");
      // State 업데이트
      setReports((prev) => {
        const newReports = { ...prev };
        if (newReports[department]) {
          delete newReports[department][sundayDate];
          // 부서가 비어있으면 부서도 삭제
          if (Object.keys(newReports[department]).length === 0) {
            delete newReports[department];
          }
        }
        return newReports;
      });
    } catch (err: any) {
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found") ||
        err?.status === 401
      ) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }
      console.error("보고완료 해제 에러:", err);
      alert("보고완료 해제 중 오류가 발생했습니다.");
    }
  };

  const handleSaveStatusPrayer = async (memberId: string, date: string, text: string) => {
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
        alert("로그인이 필요합니다.");
        return;
      }

      // attendance_records에서 해당 멤버와 날짜의 레코드 찾기
      const { data: existingRecord, error: findError } = await supabase
        .from("attendance_records")
        .select("id")
        .eq("member_id", memberId)
        .eq("date", date)
        .maybeSingle();

      if (findError && findError.code !== "PGRST116") {
        console.error("기록 조회 에러:", findError);
        alert("기록 조회 중 오류가 발생했습니다.");
        return;
      }

      if (existingRecord) {
        // 기존 레코드 업데이트
        const { error: updateError } = await supabase
          .from("attendance_records")
          .update({ status_prayer: text || null })
          .eq("id", existingRecord.id);

        if (updateError) {
          console.error("현황&기도제목 저장 에러:", updateError);
          alert("저장 중 오류가 발생했습니다.");
          return;
        }
      } else {
        // 새 레코드 생성 (attended는 false로 기본값)
        const { error: insertError } = await supabase
          .from("attendance_records")
          .insert({
            member_id: memberId,
            date: date,
            attended: false,
            status_prayer: text || null,
          });

        if (insertError) {
          console.error("현황&기도제목 저장 에러:", insertError);
          alert("저장 중 오류가 발생했습니다.");
          return;
        }
      }

      // 로컬 state 업데이트
      setStatusPrayers((prev) => {
        const newStatusPrayers = { ...prev };
        if (!newStatusPrayers[memberId]) {
          newStatusPrayers[memberId] = {};
        }
        if (text) {
          newStatusPrayers[memberId][date] = text;
        } else {
          delete newStatusPrayers[memberId][date];
          if (Object.keys(newStatusPrayers[memberId]).length === 0) {
            delete newStatusPrayers[memberId];
          }
        }
        return newStatusPrayers;
      });

      setShowStatusPrayerModal(false);
      setEditingStatusPrayer(null);
      setStatusPrayerInput("");
    } catch (err: any) {
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found") ||
        err?.status === 401
      ) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }
      console.error("현황&기도제목 저장 에러:", err);
      alert("저장 중 오류가 발생했습니다.");
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
                ref={adminCalendarAnchorRef}
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
                onClick={(e) => {
                  adminCalendarAnchorRef.current = e.currentTarget;
                  setShowAdminCalendar(true);
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
          {showAdminCalendar && (
            <CustomCalendar
              selectedSunday={adminSelectedSunday || sundayDate}
              onSelect={(sunday) => setAdminSelectedSunday(sunday)}
              onClose={() => {
                setShowAdminCalendar(false);
                adminCalendarAnchorRef.current = null;
              }}
              maxSunday={(() => {
                const today = new Date();
                return getSundayForDate(today);
              })()}
              anchorElement={adminCalendarAnchorRef.current}
            />
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
                const isExpanded = expandedDepartments.has(dept);
                
                // 부서명 매핑
                const deptMapping: Record<string, string> = {
                  "아동부": "유치부",
                  "중고등부": "청소년부",
                };
                
                // 해당 부서의 명단 필터링
                const deptMembers = members.filter((m) => {
                  const mappedDept = deptMapping[m.department || ""] || m.department;
                  return mappedDept === dept || m.department === dept;
                }).sort((a, b) => a.name.localeCompare(b.name));
                
                const adminSundayDate = adminSelectedSunday || currentWeekDates[0];
                
                // 현황&기도제목에 내용이 있는 개수 계산
                const statusPrayerCount = deptMembers.filter((member) => {
                  const statusPrayer = statusPrayers[member.id]?.[adminSundayDate] || "";
                  return statusPrayer.trim() !== "";
                }).length;
                
                return (
                  <div key={dept}>
                    <div
                      style={{
                        padding: "12px 16px",
                        borderBottom: index < departments.length - 1 ? "1px solid #e5e7eb" : "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        onClick={() => {
                          setExpandedDepartments((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(dept)) {
                              newSet.delete(dept);
                            } else {
                              newSet.add(dept);
                            }
                            return newSet;
                          });
                        }}
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#374151",
                          minWidth: 80,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {isExpanded ? "▼" : "▶"}
                        </span>
                        {dept}
                      </div>
                    {deptStats?.manager && (
                      <div style={{ fontSize: 13, color: "#6b7280", minWidth: 150 }}>
                        (담당: {deptStats.manager.name}{deptStats.manager.position ? ` ${deptStats.manager.position}` : ""})
                      </div>
                    )}
                    {deptStats ? (
                      <>
                        <div style={{ fontSize: 14, color: "#1f2937", marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                          {statusPrayerCount > 0 && (
                            <StatusPrayerBadge count={statusPrayerCount} />
                          )}
                          <span>{deptStats.attended}/{deptStats.total}명</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: rate >= 80 ? "#10b981" : rate >= 60 ? "#f59e0b" : "#ef4444", minWidth: 50, textAlign: "right" }}>
                          {rate}%
                        </div>
                        {(() => {
                          const isReported = reports[dept]?.[adminSundayDate] === true;
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                              <button
                                onClick={() => handleUnreport(dept, adminSundayDate)}
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: isReported ? "#3b82f6" : "#f3f4f6",
                                  color: isReported ? "#ffffff" : "#6b7280",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleReport(dept, adminSundayDate)}
                                disabled={true}
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: 6,
                                  border: "1px solid #e5e7eb",
                                  background: isReported ? "#10b981" : "#f3f4f6",
                                  color: isReported ? "#ffffff" : "#6b7280",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: "not-allowed",
                                  opacity: 0.6,
                                }}
                              >
                                보고완료
                              </button>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div style={{ fontSize: 14, color: "#9ca3af", marginLeft: "auto" }}>데이터 없음</div>
                    )}
                    </div>
                    {isExpanded && deptMembers.length > 0 && (
                      <div
                        style={{
                          backgroundColor: "#f9fafb",
                          borderTop: "1px solid #e5e7eb",
                          padding: "16px",
                        }}
                      >
                        <DepartmentMembersTable
                          deptMembers={deptMembers}
                          records={records}
                          statusPrayers={statusPrayers}
                          sundayDate={adminSundayDate}
                          onStatusPrayerClick={(memberId, date, currentText) => {
                            setEditingStatusPrayer({ memberId, date, currentText });
                            setStatusPrayerInput(currentText);
                            setShowStatusPrayerModal(true);
                          }}
                          onSaveStatusPrayer={handleSaveStatusPrayer}
                          isReported={reports[dept]?.[adminSundayDate] === true}
                        />
                      </div>
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
                    ref={managerCalendarAnchorRef}
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
                    onClick={(e) => {
                      managerCalendarAnchorRef.current = e.currentTarget;
                      setShowManagerCalendar(true);
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
                  const isReported = reports[userDepartment || ""]?.[managerSundayDate] === true;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
                      <span style={{ fontSize: 14, color: "#1f2937" }}>{deptStats.attended}/{deptStats.total}명</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>{rate}%</span>
                      <button
                        onClick={() => handleReport(userDepartment || "", managerSundayDate)}
                        disabled={isReported}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                          background: isReported ? "#10b981" : "#f3f4f6",
                          color: isReported ? "#ffffff" : "#6b7280",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: isReported ? "not-allowed" : "pointer",
                        }}
                      >
                        {isReported ? "보고완료" : "보고하기"}
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
              {showManagerCalendar && (
                <CustomCalendar
                  selectedSunday={managerSelectedSunday || sundayDate}
                  onSelect={(sunday) => setManagerSelectedSunday(sunday)}
                  onClose={() => {
                    setShowManagerCalendar(false);
                    managerCalendarAnchorRef.current = null;
                  }}
                  maxSunday={(() => {
                    const today = new Date();
                    return getSundayForDate(today);
                  })()}
                  anchorElement={managerCalendarAnchorRef.current}
                />
              )}
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
                  const isReported = reports[userDepartment || ""]?.[managerSundayDate] === true;
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleAttendance(member.id, managerSundayDate)}
                      disabled={isReported}
                      style={{
                        padding: "2px 2px",
                        borderRadius: 8,
                        border: `1px solid ${attended ? "#3b82f6" : "#e5e7eb"}`,
                        background: attended ? "#3b82f6" : isReported ? "#f3f4f6" : "#ffffff",
                        color: attended ? "#ffffff" : isReported ? "#9ca3af" : "#1f2937",
                        fontSize: 15,
                        fontWeight: 500,
                        cursor: isReported ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        opacity: isReported ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!attended && !isReported) {
                          e.currentTarget.style.background = "#f3f4f6";
                          e.currentTarget.style.borderColor = "#d1d5db";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!attended && !isReported) {
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

      {/* 교회학교 출석현황 (부서 담당자만) */}
      {!isAdmin && (
        <div>
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

              return (
                <div
                  key={dept}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                  }}
                >
                  <DepartmentMembersTable
                    deptMembers={deptMembers}
                    records={records}
                    statusPrayers={statusPrayers}
                    sundayDate={(() => {
                      // 부서담당자가 주일을 선택했으면 그것을 사용, 아니면 현재 주 일요일 사용
                      return (!isAdmin && userDepartment && managerSelectedSunday) ? managerSelectedSunday : currentWeekDates[0];
                    })()}
                    onStatusPrayerClick={(memberId, date, currentText) => {
                      setEditingStatusPrayer({ memberId, date, currentText });
                      setStatusPrayerInput(currentText);
                      setShowStatusPrayerModal(true);
                    }}
                    onSaveStatusPrayer={handleSaveStatusPrayer}
                    isReported={(() => {
                      const managerSundayDate = (!isAdmin && userDepartment && managerSelectedSunday) ? managerSelectedSunday : currentWeekDates[0];
                      return reports[userDepartment || ""]?.[managerSundayDate] === true;
                    })()}
                  />
                </div>
              );
              });
            })()}
        </div>
      )}

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

      {/* 현황&기도제목 입력 모달 */}
      {showStatusPrayerModal && editingStatusPrayer && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowStatusPrayerModal(false);
              setEditingStatusPrayer(null);
              setStatusPrayerInput("");
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              padding: "28px",
              width: "80%",
              maxWidth: 400,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1f2937", margin: 0 }}>
                현황&기도제목 입력
              </h2>
              <button
                onClick={() => {
                  setShowStatusPrayerModal(false);
                  setEditingStatusPrayer(null);
                  setStatusPrayerInput("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  color: "#9ca3af",
                  cursor: "pointer",
                  padding: 0,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <textarea
                value={statusPrayerInput}
                onChange={(e) => setStatusPrayerInput(e.target.value)}
                placeholder="현황 및 기도제목을 입력하세요"
                style={{
                  width: "100%",
                  minHeight: 75,
                  padding: "14px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowStatusPrayerModal(false);
                  setEditingStatusPrayer(null);
                  setStatusPrayerInput("");
                }}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  color: "#6b7280",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#ffffff";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                취소
              </button>
              <button
                onClick={async () => {
                  if (editingStatusPrayer) {
                    await handleSaveStatusPrayer(
                      editingStatusPrayer.memberId,
                      editingStatusPrayer.date,
                      statusPrayerInput
                    );
                  }
                }}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#3b82f6",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#2563eb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#3b82f6";
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
