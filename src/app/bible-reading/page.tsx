"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type BibleReadingRecord = {
  date: string; // YYYY-MM-DD
  video_watched: boolean;
  reading_completed: boolean;
  video_url?: string | null;
  comment?: string | null;
};

type Comment = {
  id: string;
  user_id: string;
  date: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  user_email?: string | null;
};

// 유튜브 URL에서 비디오 ID 추출
const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// 유튜브 임베드 URL 생성
const getYouTubeEmbedUrl = (url: string): string | null => {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  // UI 요소를 숨기기 위한 파라미터 추가
  const params = new URLSearchParams({
    modestbranding: '1', // 유튜브 로고 작게
    rel: '0', // 관련 영상 숨기기
    showinfo: '0', // 제목 등 정보 숨기기
    iv_load_policy: '3', // 주석 숨기기
    cc_load_policy: '0', // 자막 자동 로드 안함
    fs: '0', // 전체화면 버튼 숨기기
    playsinline: '1', // 인라인 재생
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

export default function BibleReadingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [records, setRecords] = useState<Record<string, BibleReadingRecord>>({});
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({}); // 날짜별 영상 URL (공통)
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [editingVideoUrl, setEditingVideoUrl] = useState(false);
  const [tempVideoUrl, setTempVideoUrl] = useState("");
  const [comments, setComments] = useState<Comment[]>([]); // 선택한 날짜의 댓글 목록
  const [newComment, setNewComment] = useState(""); // 새 댓글 입력
  const [userName, setUserName] = useState<string | null>(null); // 현재 사용자 이름
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // 현재 사용자 ID
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false); // 댓글 작성 팝업 상태
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false); // 일괄 업로드 팝업 상태
  const [bulkUploadText, setBulkUploadText] = useState(""); // 일괄 업로드 텍스트
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false); // 일괄 업로드 로딩 상태

  // 오늘 날짜를 YYYY-MM-DD 형식으로 가져오기
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = getTodayDate();

  // 초기 선택 날짜를 오늘로 설정
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(today);
    }
  }, [today, selectedDate]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        // 리프레시 토큰 에러 처리
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

      // 관리자 권한 확인 및 사용자 정보 가져오기
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.role === "admin") {
        setIsAdmin(true);
      }

      // 사용자 이름 가져오기
      if (profileData?.full_name) {
        setUserName(profileData.full_name);
      } else if (user?.email) {
        setUserName(user.email);
      } else if (user?.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      }
      setCurrentUserId(user.id);

      // 날짜별 영상 URL 불러오기 (모든 사용자에게 공통)
      // 모든 레코드에서 video_url이 있는 것을 가져옴 (RLS 정책이 허용하는 경우)
      // RLS 정책이 video_url이 있는 레코드는 모든 사용자가 조회할 수 있도록 설정되어 있어야 함
      const { data: allVideoRecords, error: videoError } = await supabase
        .from("bible_reading")
        .select("date, video_url")
        .not("video_url", "is", null)
        .order("date", { ascending: true });

      const videoUrlsMap: Record<string, string> = {};
      
      if (allVideoRecords) {
        allVideoRecords.forEach((record: any) => {
          if (record.video_url && !videoUrlsMap[record.date]) {
            videoUrlsMap[record.date] = record.video_url;
          }
        });
      }
      
      // RLS 정책 때문에 위 방법이 안되면, 관리자 계정을 찾아서 조회 시도
      if (Object.keys(videoUrlsMap).length === 0) {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .limit(1);

        if (adminProfiles && adminProfiles.length > 0) {
          const adminId = adminProfiles[0].id;
          // 현재 사용자가 관리자인 경우에만 조회 가능
          if (user.id === adminId) {
            const { data: adminRecords } = await supabase
              .from("bible_reading")
              .select("date, video_url")
              .eq("user_id", adminId)
              .not("video_url", "is", null)
              .order("date", { ascending: true });

            if (adminRecords) {
              adminRecords.forEach((record: any) => {
                if (record.video_url) {
                  videoUrlsMap[record.date] = record.video_url;
                }
              });
            }
          }
        }
      }
      
      setVideoUrls(videoUrlsMap);

      // 사용자 자신의 체크 기록 불러오기
      const { data: userRecords, error: userError } = await supabase
        .from("bible_reading")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (userError && userError.code !== "PGRST116") {
        console.error("성경일독 기록 조회 에러:", userError);
      }

      const recordsMap: Record<string, BibleReadingRecord> = {};
      
      if (userRecords) {
        userRecords.forEach((record: any) => {
          recordsMap[record.date] = {
            date: record.date,
            video_watched: record.video_watched || false,
            reading_completed: record.reading_completed || false,
            video_url: record.video_url || videoUrlsMap[record.date] || null,
          };
        });
      }

      // 영상 URL이 있지만 사용자 기록이 없는 날짜도 포함
      Object.keys(videoUrlsMap).forEach((date) => {
        if (!recordsMap[date]) {
          recordsMap[date] = {
            date,
            video_watched: false,
            reading_completed: false,
            video_url: videoUrlsMap[date],
          };
        }
      });

      setRecords(recordsMap);

      setLoading(false);
      } catch (err: any) {
        // 리프레시 토큰 에러 처리
        if (
          err?.message?.includes("Invalid Refresh Token") ||
          err?.message?.includes("Refresh Token Not Found")
        ) {
          await supabase.auth.signOut();
          router.push("/login");
        } else {
          console.error("데이터 로드 에러:", err);
          setLoading(false);
        }
      }
    };

    loadData();
  }, [router]);

  // 선택한 날짜의 댓글 불러오기
  useEffect(() => {
    const loadComments = async () => {
      if (!selectedDate) return;

      const { data: commentsData, error: commentsError } = await supabase
        .from("bible_comments")
        .select("*")
        .eq("date", selectedDate)
        .order("created_at", { ascending: true });

      if (commentsError && commentsError.code !== "PGRST116") {
        console.error("댓글 조회 에러:", commentsError);
        setComments([]);
        return;
      }

      if (commentsData && commentsData.length > 0) {
        // 사용자 정보 가져오기
        const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesError) {
          console.error("사용자 정보 조회 에러:", profilesError);
        }

        const profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
        if (profilesData) {
          profilesData.forEach((profile: any) => {
            profilesMap[profile.id] = {
              full_name: profile.full_name,
              email: profile.email,
            };
          });
        }

        const commentsList: Comment[] = commentsData.map((item: any) => {
          const profile = profilesMap[item.user_id];
          return {
            id: item.id,
            user_id: item.user_id,
            date: item.date,
            comment: item.comment,
            created_at: item.created_at,
            updated_at: item.updated_at,
            user_name: profile?.full_name || null,
            user_email: profile?.email || null,
          };
        });
        setComments(commentsList);
      } else {
        setComments([]);
      }
    };

    loadComments();
  }, [selectedDate]);

  // 선택한 날짜의 기록 가져오기
  const selectedRecord: BibleReadingRecord = {
    date: selectedDate,
    video_watched: records[selectedDate]?.video_watched || false,
    reading_completed: records[selectedDate]?.reading_completed || false,
    video_url: videoUrls[selectedDate] || records[selectedDate]?.video_url || null,
  };

  // 선택한 날짜가 변경될 때 편집 모드 초기화
  useEffect(() => {
    setEditingVideoUrl(false);
    setTempVideoUrl(videoUrls[selectedDate] || "");
  }, [selectedDate, videoUrls]);

  const saveRecord = async (date: string, video: boolean, reading: boolean) => {
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

      if (!user) return;

    // 체크 상태 저장
    const { error } = await supabase.from("bible_reading").upsert(
      {
        user_id: user.id,
        date: date,
        video_watched: video,
        reading_completed: reading,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,date",
      }
    );

    if (error) {
      console.error("저장 에러:", error);
      alert("저장 중 오류가 발생했습니다.");
      return;
    }

    // 로컬 상태 업데이트
    setRecords((prev) => ({
      ...prev,
      [date]: {
        date,
        video_watched: video,
        reading_completed: reading,
        video_url: videoUrls[date] || prev[date]?.video_url || null,
      },
    }));
    } catch (err: any) {
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found")
      ) {
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        console.error("저장 에러:", err);
        alert("저장 중 오류가 발생했습니다.");
      }
    }
  };

  const saveVideoUrl = async (date: string, videoUrl: string | null) => {
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

      if (!user || !isAdmin) {
        alert("관리자만 영상 URL을 설정할 수 있습니다.");
        return;
      }

    // 영상 URL 저장 (관리자 ID로 저장하여 모든 사용자에게 공통으로 적용)
    if (videoUrl) {
      // 기존 레코드가 있으면 업데이트, 없으면 생성
      const existingRecord = records[date];
      
      const payload: any = {
        user_id: user.id,
        date: date,
        video_url: videoUrl,
        updated_at: new Date().toISOString(),
      };

      // 기존 레코드가 있으면 체크 상태도 유지
      if (existingRecord) {
        payload.video_watched = existingRecord.video_watched;
        payload.reading_completed = existingRecord.reading_completed;
      } else {
        payload.video_watched = false;
        payload.reading_completed = false;
      }

      const { data: result, error } = await supabase.from("bible_reading").upsert(payload, {
        onConflict: "user_id,date",
      });

      if (error) {
        console.error("영상 URL 저장 에러:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        alert(`영상 URL 저장 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`);
        return;
      }
    } else {
      // 삭제 - video_url만 null로 업데이트
      const existingRecord = records[date];
      if (existingRecord && (existingRecord.video_watched || existingRecord.reading_completed)) {
        // 체크 기록이 있으면 video_url만 null로 업데이트
        const { error } = await supabase.from("bible_reading").upsert(
          {
            user_id: user.id,
            date: date,
            video_url: null,
            video_watched: existingRecord.video_watched,
            reading_completed: existingRecord.reading_completed,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,date",
          }
        );

        if (error) {
          console.error("영상 URL 삭제 에러:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          alert(`영상 URL 삭제 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`);
          return;
        }
      } else {
        // video_url만 있는 경우 삭제
        const { error } = await supabase
          .from("bible_reading")
          .delete()
          .eq("user_id", user.id)
          .eq("date", date);

        if (error) {
          console.error("영상 URL 삭제 에러:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          alert(`영상 URL 삭제 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`);
          return;
        }
      }
    }

    // 로컬 상태 업데이트
    if (videoUrl) {
      setVideoUrls((prev) => ({
        ...prev,
        [date]: videoUrl,
      }));
    } else {
      setVideoUrls((prev) => {
        const newUrls = { ...prev };
        delete newUrls[date];
        return newUrls;
      });
    }

    // records도 업데이트
    setRecords((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] || {
          date,
          video_watched: false,
          reading_completed: false,
        }),
        video_url: videoUrl,
      },
    }));
    } catch (err: any) {
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found")
      ) {
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        console.error("영상 URL 저장 에러:", err);
        alert("영상 URL 저장 중 오류가 발생했습니다.");
      }
    }
  };

  // 일괄 업로드 텍스트 파싱
  const parseBulkUploadText = (text: string): Array<{ date: string; url: string }> => {
    const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    const results: Array<{ date: string; url: string }> = [];

    for (const line of lines) {
      // 쉼표 또는 탭으로 구분
      const parts = line.split(/[,\t]/).map((p) => p.trim()).filter((p) => p.length > 0);
      
      if (parts.length >= 2) {
        const date = parts[0];
        const url = parts[1];
        
        // 날짜 형식 검증 (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(date)) {
          // URL 형식 검증 (유튜브 URL인지 확인)
          if (url.includes("youtube.com") || url.includes("youtu.be")) {
            results.push({ date, url });
          }
        }
      }
    }

    return results;
  };

  // 일괄 업로드 실행
  const handleBulkUpload = async () => {
    if (!bulkUploadText.trim()) {
      alert("업로드할 내용을 입력해주세요.");
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

      if (!user || !isAdmin) {
        alert("관리자만 일괄 업로드할 수 있습니다.");
        return;
      }

      const parsedData = parseBulkUploadText(bulkUploadText);
    
      if (parsedData.length === 0) {
        alert("올바른 형식의 데이터가 없습니다.\n형식: 날짜,URL (예: 2024-01-01,https://www.youtube.com/watch?v=...)");
        return;
      }

      setBulkUploadLoading(true);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // 각 항목을 순차적으로 저장
      for (const item of parsedData) {
        const existingRecord = records[item.date];
        
        const payload: any = {
          user_id: user.id,
          date: item.date,
          video_url: item.url,
          updated_at: new Date().toISOString(),
        };

        // 기존 레코드가 있으면 체크 상태도 유지
        if (existingRecord) {
          payload.video_watched = existingRecord.video_watched;
          payload.reading_completed = existingRecord.reading_completed;
        } else {
          payload.video_watched = false;
          payload.reading_completed = false;
        }

        const { error } = await supabase.from("bible_reading").upsert(payload, {
          onConflict: "user_id,date",
        });

        if (error) {
          errorCount++;
          errors.push(`${item.date}: ${error.message}`);
        } else {
          successCount++;
          // 로컬 상태 업데이트
          setVideoUrls((prev) => ({
            ...prev,
            [item.date]: item.url,
          }));
          setRecords((prev) => ({
            ...prev,
            [item.date]: {
              ...(prev[item.date] || {
                date: item.date,
                video_watched: false,
                reading_completed: false,
              }),
              video_url: item.url,
            },
          }));
        }
      }

      // 결과 메시지 표시
      let message = `업로드 완료!\n성공: ${successCount}개`;
      if (errorCount > 0) {
        message += `\n실패: ${errorCount}개`;
        if (errors.length > 0) {
          message += `\n\n에러 상세:\n${errors.slice(0, 5).join("\n")}`;
          if (errors.length > 5) {
            message += `\n... 외 ${errors.length - 5}개`;
          }
        }
      }
      alert(message);

      // 성공한 경우 팝업 닫기 및 데이터 다시 불러오기
      if (errorCount === 0) {
        setIsBulkUploadModalOpen(false);
        setBulkUploadText("");
        
        // 모든 레코드에서 video_url이 있는 것을 다시 불러오기
        const { data: allVideoRecords } = await supabase
          .from("bible_reading")
          .select("date, video_url")
          .not("video_url", "is", null)
          .order("date", { ascending: true });

        if (allVideoRecords) {
          const videoUrlsMap: Record<string, string> = {};
          allVideoRecords.forEach((record: any) => {
            if (record.video_url && !videoUrlsMap[record.date]) {
              videoUrlsMap[record.date] = record.video_url;
            }
          });
          setVideoUrls(videoUrlsMap);
        }
      }
    } catch (error: any) {
      if (
        error?.message?.includes("Invalid Refresh Token") ||
        error?.message?.includes("Refresh Token Not Found")
      ) {
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        console.error("일괄 업로드 에러:", error);
        alert(`일괄 업로드 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`);
      }
    } finally {
      setBulkUploadLoading(false);
    }
  };

  const handleVideoToggle = async () => {
    const newValue = !selectedRecord.video_watched;
    await saveRecord(selectedDate, newValue, selectedRecord.reading_completed);
  };

  const handleReadingToggle = async () => {
    const newValue = !selectedRecord.reading_completed;
    await saveRecord(selectedDate, selectedRecord.video_watched, newValue);
  };

  const handleSaveVideoUrl = async () => {
    await saveVideoUrl(selectedDate, tempVideoUrl.trim() || null);
    setEditingVideoUrl(false);
  };

  const handleCancelEdit = () => {
    setTempVideoUrl(videoUrls[selectedDate] || "");
    setEditingVideoUrl(false);
  };

  const handleSaveComment = async () => {
    if (!newComment.trim()) {
      alert("댓글을 입력해주세요.");
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

      // 기존 댓글이 있는지 확인 (UNIQUE 제약 조건 때문에)
      const { data: existingComment } = await supabase
        .from("bible_comments")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", selectedDate)
        .maybeSingle();

      let commentData;
      let commentError;

      if (existingComment) {
        // 기존 댓글이 있으면 업데이트
        const { data, error } = await supabase
          .from("bible_comments")
          .update({
            comment: newComment.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingComment.id)
          .select()
          .single();
        commentData = data;
        commentError = error;
      } else {
        // 새 댓글 삽입
        const { data, error } = await supabase
          .from("bible_comments")
          .insert({
            user_id: user.id,
            date: selectedDate,
            comment: newComment.trim(),
          })
          .select()
          .single();
        commentData = data;
        commentError = error;
      }

      if (commentError) {
        console.error("댓글 저장 에러:", {
          message: commentError.message,
          details: commentError.details,
          hint: commentError.hint,
          code: commentError.code,
        });
        alert(`댓글 저장 중 오류가 발생했습니다: ${commentError.message || "알 수 없는 오류"}`);
        return;
      }

      if (commentData) {
        // 댓글 목록 다시 불러오기 (업데이트된 댓글 포함)
        const { data: commentsData } = await supabase
          .from("bible_comments")
          .select("*")
          .eq("date", selectedDate)
          .order("created_at", { ascending: true });

        if (commentsData && commentsData.length > 0) {
        // 사용자 정보 가져오기
        const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
        if (profilesData) {
          profilesData.forEach((profile: any) => {
            profilesMap[profile.id] = {
              full_name: profile.full_name,
              email: profile.email,
            };
          });
        }

        const commentsList: Comment[] = commentsData.map((item: any) => {
          const profile = profilesMap[item.user_id];
          return {
            id: item.id,
            user_id: item.user_id,
            date: item.date,
            comment: item.comment,
            created_at: item.created_at,
            updated_at: item.updated_at,
            user_name: profile?.full_name || null,
            user_email: profile?.email || null,
          };
        });
          setComments(commentsList);
        }
        setNewComment("");
      }
    } catch (err: any) {
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found")
      ) {
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        console.error("댓글 저장 에러:", err);
        alert("댓글 저장 중 오류가 발생했습니다.");
      }
    }
  };

  const handleDeleteComment = async (commentId: string, commentUserId: string) => {
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

      if (!user) return;

    // 자신의 댓글만 삭제 가능
    if (user.id !== commentUserId) {
      alert("자신의 댓글만 삭제할 수 있습니다.");
      return;
    }

    if (!confirm("댓글을 삭제하시겠습니까?")) {
      return;
    }

    const { error } = await supabase.from("bible_comments").delete().eq("id", commentId);

    if (error) {
      console.error("댓글 삭제 에러:", error);
      alert("댓글 삭제 중 오류가 발생했습니다.");
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      if (
        err?.message?.includes("Invalid Refresh Token") ||
        err?.message?.includes("Refresh Token Not Found")
      ) {
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        console.error("댓글 삭제 에러:", err);
        alert("댓글 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  // 날짜 이동 함수
  const moveDate = (days: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const goToToday = () => {
    setSelectedDate(today);
  };

  // 날짜 포맷팅 (한국어)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  };

  // 달성률 계산
  const completionRate = useMemo(() => {
    const startDate = new Date(new Date().getFullYear(), 0, 1); // 올해 1월 1일
    const todayDate = new Date();
    const totalDays = Math.ceil((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    let completedDays = 0;
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const record = records[dateStr];
      if (record && record.video_watched && record.reading_completed) {
        completedDays++;
      }
    }

    return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
  }, [records]);

  // 연속 달성 일수 계산
  const consecutiveDays = useMemo(() => {
    let count = 0;
    const todayDate = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const record = records[dateStr];
      if (record && record.video_watched && record.reading_completed) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [records]);

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

  const isToday = selectedDate === today;
  const currentVideoUrl = videoUrls[selectedDate] || selectedRecord.video_url;
  const embedUrl = currentVideoUrl ? getYouTubeEmbedUrl(currentVideoUrl) : null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
          성경일독 365일
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>매일 성경을 읽고 영상을 시청하세요</p>
      </div>

      {/* 달성률 카드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "20px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>올해 달성률</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#3b82f6" }}>{completionRate}%</div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: "20px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>연속 달성 일수</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#10b981" }}>{consecutiveDays}일</div>
        </div>
      </div>

      {/* 날짜 선택 및 성경 읽기 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "24px",
          border: "1px solid #e5e7eb",
          marginBottom: 20,
        }}
      >
        {/* 날짜 선택 영역 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => moveDate(-1)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              color: "#374151",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
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
            ◀ 이전
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              flex: 1,
              minWidth: 150,
            }}
          />

          <button
            onClick={() => moveDate(1)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              color: "#374151",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
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
            다음 ▶
          </button>

          {!isToday && (
            <button
              onClick={goToToday}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#2563eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#3b82f6";
              }}
            >
              오늘로
            </button>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
            {formatDate(selectedDate)}
            {isToday && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  padding: "3px 8px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  borderRadius: 12,
                  fontWeight: 500,
                }}
              >
                오늘
              </span>
            )}
          </h2>
          {isAdmin && (
            <button
              onClick={() => setIsBulkUploadModalOpen(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
                color: "#3b82f6",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#eff6ff";
                e.currentTarget.style.borderColor = "#3b82f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#e5e7eb";
              }}
            >
              일괄 업로드
            </button>
          )}
        </div>

        {/* 유튜브 영상 */}
        {embedUrl && !editingVideoUrl && (
          <div
            style={{
              marginBottom: 20,
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                position: "relative",
                paddingBottom: "56.25%", // 16:9 비율
                height: 0,
                overflow: "hidden",
              }}
            >
              <iframe
                src={embedUrl}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div
              style={{
                padding: "12px",
                backgroundColor: "#f9fafb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <a
                href={currentVideoUrl || ""}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: "#3b82f6",
                  textDecoration: "none",
                }}
              >
                유튜브에서 보기 →
              </a>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingVideoUrl(true);
                    setTempVideoUrl(currentVideoUrl || "");
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                    color: "#374151",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  수정
                </button>
              )}
            </div>
          </div>
        )}

        {/* 영상 URL 입력/수정 (관리자만) */}
        {isAdmin && (!embedUrl || editingVideoUrl) && (
          <div
            style={{
              marginBottom: 16,
              padding: "16px",
              backgroundColor: "#f9fafb",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
              {embedUrl ? "영상 URL 수정" : "영상 URL 추가"}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="url"
                value={tempVideoUrl}
                onChange={(e) => setTempVideoUrl(e.target.value)}
                placeholder="유튜브 URL을 입력하세요 (예: https://www.youtube.com/watch?v=...)"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSaveVideoUrl}
                disabled={!tempVideoUrl.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: tempVideoUrl.trim() ? "#3b82f6" : "#d1d5db",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: tempVideoUrl.trim() ? "pointer" : "not-allowed",
                }}
              >
                저장
              </button>
              {editingVideoUrl && (
                <button
                  onClick={handleCancelEdit}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                    color: "#374151",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  취소
                </button>
              )}
              {currentVideoUrl && !editingVideoUrl && (
                <button
                  onClick={async () => {
                    await saveVideoUrl(selectedDate, null);
                    setTempVideoUrl("");
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                    color: "#ef4444",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  삭제
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
              유튜브 URL 형식: https://www.youtube.com/watch?v=VIDEO_ID 또는 https://youtu.be/VIDEO_ID
            </div>
          </div>
        )}

        {/* 영상 시청 체크 */}
        <div
          style={{
            marginBottom: 16,
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 4 }}>
                영상 시청
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>성경 강해 영상을 시청하세요</div>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selectedRecord.video_watched}
                onChange={handleVideoToggle}
                style={{
                  width: 20,
                  height: 20,
                  cursor: "pointer",
                  accentColor: "#3b82f6",
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: selectedRecord.video_watched ? "#10b981" : "#6b7280",
                }}
              >
                {selectedRecord.video_watched ? "시청 완료" : "시청 안 함"}
              </span>
            </label>
          </div>
        </div>

        {/* 성경 읽기 체크 */}
        <div
          style={{
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 4 }}>
                성경 읽기
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>성경 분량을 읽으세요</div>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selectedRecord.reading_completed}
                onChange={handleReadingToggle}
                style={{
                  width: 20,
                  height: 20,
                  cursor: "pointer",
                  accentColor: "#3b82f6",
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: selectedRecord.reading_completed ? "#10b981" : "#6b7280",
                }}
              >
                {selectedRecord.reading_completed ? "읽기 완료" : "읽기 안 함"}
              </span>
            </label>
          </div>
        </div>

        {/* 완료 상태 */}
        {selectedRecord.video_watched && selectedRecord.reading_completed && (
          <div
            style={{
              marginTop: 16,
              padding: "12px",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>
              🎉 {isToday ? "오늘의" : "이 날의"} 성경 읽기를 완료했습니다!
            </div>
          </div>
        )}

        {/* 댓글 섹션 */}
        <div
          style={{
            marginTop: 20,
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>
              댓글 ({comments.length})
            </h3>
            <button
              onClick={() => setIsCommentModalOpen(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#2563eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#3b82f6";
              }}
            >
              댓글 작성
            </button>
          </div>

          {/* 댓글 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {comments.map((comment) => {
              const isMyComment = currentUserId === comment.user_id;

              return (
                <div
                  key={comment.id}
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#ffffff",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>
                        {comment.user_name || comment.user_email || "익명"}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                        {new Date(comment.created_at).toLocaleString("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {comment.comment}
                  </div>
                  {isMyComment && (
                    <button
                      onClick={() => handleDeleteComment(comment.id, comment.user_id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#ffffff",
                        color: "#ef4444",
                        fontSize: 11,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      삭제
                    </button>
                  )}
                </div>
              );
            })}

            {comments.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: 13 }}>
                아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 일괄 업로드 팝업 */}
      {isBulkUploadModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !bulkUploadLoading) {
              setIsBulkUploadModalOpen(false);
              setBulkUploadText("");
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: "24px",
              width: "90%",
              maxWidth: 600,
              maxHeight: "80vh",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
              animation: "slideUp 0.3s ease-out",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1f2937" }}>
                영상 URL 일괄 업로드
              </h2>
              <button
                onClick={() => {
                  if (!bulkUploadLoading) {
                    setIsBulkUploadModalOpen(false);
                    setBulkUploadText("");
                  }
                }}
                disabled={bulkUploadLoading}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  color: "#6b7280",
                  cursor: bulkUploadLoading ? "not-allowed" : "pointer",
                  padding: 0,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  opacity: bulkUploadLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!bulkUploadLoading) {
                    e.currentTarget.style.backgroundColor = "#f3f4f6";
                    e.currentTarget.style.color = "#1f2937";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!bulkUploadLoading) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6b7280";
                  }
                }}
              >
                ×
              </button>
            </div>
            <div style={{ marginBottom: 12, fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              날짜와 유튜브 URL을 한 줄에 하나씩 입력하세요. (쉼표 또는 탭으로 구분)
              <br />
              <strong>형식:</strong> 날짜,URL
              <br />
              <strong>예시:</strong>
              <br />
              <code style={{ fontSize: 12, backgroundColor: "#f3f4f6", padding: "2px 4px", borderRadius: 4 }}>
                2024-01-01,https://www.youtube.com/watch?v=VIDEO_ID
              </code>
              <br />
              <code style={{ fontSize: 12, backgroundColor: "#f3f4f6", padding: "2px 4px", borderRadius: 4 }}>
                2024-01-02,https://youtu.be/VIDEO_ID
              </code>
            </div>
            <textarea
              value={bulkUploadText}
              onChange={(e) => setBulkUploadText(e.target.value)}
              placeholder="2024-01-01,https://www.youtube.com/watch?v=VIDEO_ID&#10;2024-01-02,https://youtu.be/VIDEO_ID&#10;2024-01-03,https://www.youtube.com/watch?v=VIDEO_ID"
              rows={12}
              disabled={bulkUploadLoading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 13,
                resize: "vertical",
                fontFamily: "monospace",
                marginBottom: 16,
                minHeight: 200,
                opacity: bulkUploadLoading ? 0.6 : 1,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  if (!bulkUploadLoading) {
                    setIsBulkUploadModalOpen(false);
                    setBulkUploadText("");
                  }
                }}
                disabled={bulkUploadLoading}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: bulkUploadLoading ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  opacity: bulkUploadLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!bulkUploadLoading) {
                    e.currentTarget.style.backgroundColor = "#f9fafb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!bulkUploadLoading) {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                  }
                }}
              >
                취소
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={!bulkUploadText.trim() || bulkUploadLoading}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: bulkUploadText.trim() && !bulkUploadLoading ? "#3b82f6" : "#d1d5db",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: bulkUploadText.trim() && !bulkUploadLoading ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (bulkUploadText.trim() && !bulkUploadLoading) {
                    e.currentTarget.style.backgroundColor = "#2563eb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (bulkUploadText.trim() && !bulkUploadLoading) {
                    e.currentTarget.style.backgroundColor = "#3b82f6";
                  }
                }}
              >
                {bulkUploadLoading ? "업로드 중..." : "업로드"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 댓글 작성 팝업 */}
      {isCommentModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsCommentModalOpen(false);
              setNewComment("");
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: "24px",
              width: "90%",
              maxWidth: 500,
              maxHeight: "80vh",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
              animation: "slideUp 0.3s ease-out",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1f2937" }}>
                댓글 작성
              </h2>
              <button
                onClick={() => {
                  setIsCommentModalOpen(false);
                  setNewComment("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  color: "#6b7280",
                  cursor: "pointer",
                  padding: 0,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.color = "#1f2937";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#6b7280";
                }}
              >
                ×
              </button>
            </div>
            <div style={{ marginBottom: 12, fontSize: 13, color: "#6b7280" }}>
              {formatDate(selectedDate)}의 댓글을 작성합니다
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요..."
              rows={6}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                resize: "vertical",
                fontFamily: "inherit",
                marginBottom: 16,
                minHeight: 120,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setIsCommentModalOpen(false);
                  setNewComment("");
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#ffffff";
                }}
              >
                취소
              </button>
              <button
                onClick={async () => {
                  await handleSaveComment();
                  setIsCommentModalOpen(false);
                  setNewComment("");
                }}
                disabled={!newComment.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: newComment.trim() ? "#3b82f6" : "#d1d5db",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: newComment.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (newComment.trim()) {
                    e.currentTarget.style.backgroundColor = "#2563eb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (newComment.trim()) {
                    e.currentTarget.style.backgroundColor = "#3b82f6";
                  }
                }}
              >
                작성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 최근 기록 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: "20px",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 16 }}>최근 기록</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.keys(records)
            .sort()
            .reverse()
            .slice(0, 7)
            .map((date) => {
              const record = records[date];
              const isComplete = record.video_watched && record.reading_completed;
              const isSelected = date === selectedDate;
              const hasVideo = videoUrls[date] || record.video_url;
              return (
                <div
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    backgroundColor: isSelected ? "#eff6ff" : "#f9fafb",
                    borderRadius: 6,
                    border: isSelected ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }
                  }}
                >
                  <div style={{ fontSize: 13, color: "#374151", fontWeight: isSelected ? 600 : 500 }}>
                    {formatDate(date)}
                    {date === today && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          padding: "2px 6px",
                          backgroundColor: "#3b82f6",
                          color: "white",
                          borderRadius: 8,
                          fontWeight: 500,
                        }}
                      >
                        오늘
                      </span>
                    )}
                    {hasVideo && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          padding: "2px 6px",
                          backgroundColor: "#10b981",
                          color: "white",
                          borderRadius: 8,
                          fontWeight: 500,
                        }}
                      >
                        영상
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: record.video_watched ? "#10b981" : "#9ca3af",
                      }}
                    >
                      {record.video_watched ? "✓ 영상" : "✗ 영상"}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: record.reading_completed ? "#10b981" : "#9ca3af",
                      }}
                    >
                      {record.reading_completed ? "✓ 읽기" : "✗ 읽기"}
                    </span>
                    {isComplete && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          backgroundColor: "#10b981",
                          color: "white",
                          borderRadius: 12,
                          fontWeight: 500,
                        }}
                      >
                        완료
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

          {Object.keys(records).length === 0 && (
            <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af", fontSize: 13 }}>
              아직 기록이 없습니다. 오늘부터 시작해보세요!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
