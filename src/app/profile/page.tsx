"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Cropper from "react-easy-crop";

// react-easy-crop의 Area 타입 정의
interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  avatar_url?: string | null;
};

// 이미지 압축 및 리사이징 함수 (300KB 이하로 제한)
const compressImage = (file: File, maxWidth: number = 400, maxHeight: number = 400, maxSizeKB: number = 300): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // 비율 유지하면서 리사이즈
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context를 가져올 수 없습니다."));
          return;
        }

        // PNG 파일의 경우 투명 배경을 흰색으로 채움
        if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // 품질을 낮춰가며 300KB 이하로 압축
        const compressWithQuality = (quality: number): void => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("이미지 압축에 실패했습니다."));
                return;
              }

              const sizeKB = blob.size / 1024;
              
              // 300KB 이하가 되면 완료
              if (sizeKB <= maxSizeKB || quality <= 0.1) {
                resolve(blob);
              } else {
                // 품질을 더 낮춰서 재시도
                compressWithQuality(Math.max(0.1, quality - 0.1));
              }
            },
            "image/jpeg",
            quality
          );
        };

        // 초기 품질 0.8에서 시작
        compressWithQuality(0.8);
      };
      img.onerror = () => reject(new Error("이미지를 로드할 수 없습니다."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
};

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [bucketAvailable, setBucketAvailable] = useState<boolean | null>(null);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [storageFileCount, setStorageFileCount] = useState<number | null>(null);
  const [storageFiles, setStorageFiles] = useState<Array<{ name: string; id: string; created_at: string; metadata?: { size?: number } }>>([]);
  const [isMobile, setIsMobile] = useState(false);
  
  // 이미지 크롭 관련 상태
  const [showImageCrop, setShowImageCrop] = useState(false);
  const [cropImageFile, setCropImageFile] = useState<File | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  
  // 삭제 확인 모달 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteFileName, setPendingDeleteFileName] = useState<string | null>(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<React.MouseEvent | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [gender, setGender] = useState("");
  
  // 비밀번호 변경 관련 상태
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [skipCurrentPassword, setSkipCurrentPassword] = useState(false);

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
      setGender((data as any).gender || "");

      // 부서담당자인지 확인 (role이 manager이거나 department가 있고 role이 특정 값인 경우)
      setIsManager(data.department && data.role === "manager");

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

    const checkBucket = async () => {
      try {
        // 버킷 존재 여부 확인 (list로 간단히 체크)
        const { data, error } = await supabase.storage
          .from("profile-images")
          .list("", { limit: 1 });
        
        // 에러 확인
        if (error) {
          // 버킷이 없는 경우
          if (
            error.message?.includes("Bucket not found") ||
            error.message?.includes("bucket") ||
            error.message?.includes("does not exist")
          ) {
            setBucketAvailable(false);
            return;
          }
          // 다른 에러의 경우도 버킷이 없는 것으로 간주 (안전하게)
          setBucketAvailable(false);
          return;
        }
        
        // 에러가 없으면 버킷이 존재하는 것으로 간주
        setBucketAvailable(true);
      } catch (err: any) {
        // 예외 발생 시 버킷이 없는 것으로 간주
        setBucketAvailable(false);
      }
    };

    loadProfile();
    checkBucket();
    checkStorageFiles();

    // 페이지 포커스 시 프로필 다시 불러오기 (다른 페이지에서 변경된 내용 반영)
    const handleFocus = () => {
      loadProfile();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [router]);

  const checkStorageFiles = async () => {
    if (bucketAvailable === false || !profile) return;
    
    try {
      const { data, error } = await supabase.storage
        .from("profile-images")
        .list("avatars", {
          limit: 1000,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) {
        return;
      }

      // 현재 사용자가 업로드한 파일만 필터링 (파일명이 {profile.id}- 로 시작하는 것)
      const userFiles = (data || []).filter((file) => {
        return file.name.startsWith(`${profile.id}-`);
      });

      setStorageFileCount(userFiles.length);
      setStorageFiles(userFiles);
    } catch (err) {
    }
  };

  const getStorageFileUrl = (fileName: string) => {
    return supabase.storage
      .from("profile-images")
      .getPublicUrl(`avatars/${fileName}`).data.publicUrl;
  };

  const handleSelectStorageImage = async (fileName: string) => {
    if (!profile) return;

    setUploadingAvatar(true);
    setErrorMsg(null);

    try {
      const fileUrl = getStorageFileUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: fileUrl })
        .eq("id", profile.id);

      if (updateError) {
        setErrorMsg("프로필 업데이트에 실패했습니다.");
        setUploadingAvatar(false);
        return;
      }

      // 로컬 상태 업데이트
      setProfile({ ...profile, avatar_url: fileUrl });
      setShowAvatarSelector(false);
    } catch (err: any) {
      console.error("스토리지 이미지 선택 에러:", err);
      setErrorMsg(err.message || "이미지 선택 중 오류가 발생했습니다.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteStorageImage = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 부모 버튼의 클릭 이벤트 방지
    e.preventDefault();
    
    // 삭제 확인 모달 표시
    setPendingDeleteFileName(fileName);
    setPendingDeleteEvent(e);
    setShowDeleteConfirm(true);
  };
  
  // 실제 삭제 실행 함수
  const executeDeleteStorageImage = async () => {
    if (!pendingDeleteFileName || !profile) {
      setShowDeleteConfirm(false);
      setPendingDeleteFileName(null);
      setPendingDeleteEvent(null);
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg(null);
    setShowDeleteConfirm(false);

    try {
      const filePath = `avatars/${pendingDeleteFileName}`;
      
      // 파일명이 현재 사용자 ID로 시작하는지 확인
      if (!pendingDeleteFileName.startsWith(`${profile.id}-`)) {
        setErrorMsg("본인이 업로드한 사진만 삭제할 수 있습니다.");
        setUploadingAvatar(false);
        setPendingDeleteFileName(null);
        setPendingDeleteEvent(null);
        return;
      }
      
      // 현재 프로필 사진이 삭제할 파일인지 먼저 확인
      const fileUrl = getStorageFileUrl(pendingDeleteFileName);
      const isCurrentAvatar = profile?.avatar_url === fileUrl;
      
      // 파일 삭제
      const { data, error: deleteError } = await supabase.storage
        .from("profile-images")
        .remove([filePath]);


      if (deleteError) {
        console.error("파일 삭제 에러 상세:", deleteError);
        
        // RLS 정책 에러인 경우
        if (deleteError.message?.includes("policy") || deleteError.message?.includes("permission")) {
          setErrorMsg(
            "파일 삭제 권한이 없습니다.\n\n" +
            "Supabase Storage의 DELETE 정책을 확인해주세요.\n" +
            "정책 이름: Allow users to delete their own profile images\n" +
            "정책 정의: (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text)"
          );
        } else {
          setErrorMsg(`파일 삭제에 실패했습니다: ${deleteError.message || JSON.stringify(deleteError)}`);
        }
        setUploadingAvatar(false);
        return;
      }

      // 현재 프로필 사진이 삭제한 파일이면 프로필도 업데이트
      if (isCurrentAvatar && profile) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: "icon:👤" })
          .eq("id", profile.id);
        
        if (updateError) {
          console.error("프로필 업데이트 에러:", updateError);
        } else {
          setProfile({ ...profile, avatar_url: "icon:👤" });
        }
      }

      // 파일 목록 새로고침
      await checkStorageFiles();
      
    } catch (err: any) {
      console.error("파일 삭제 에러:", err);
      setErrorMsg(err.message || "파일 삭제 중 오류가 발생했습니다.");
    } finally {
      setUploadingAvatar(false);
      setPendingDeleteFileName(null);
      setPendingDeleteEvent(null);
    }
  };

  const defaultIcons = [
    "👤", "🙂", "😊", "😎", "🤗", "🙏", "👨", "👩", 
    "🧑", "👨‍🦱", "👩‍🦱", "👨‍🦰", "👩‍🦰", "👨‍🦳", "👩‍🦳", "👨‍🦲",
    "👶", "🧒", "🧓", "👴", "👵", "💂", "🧙", "🧚"
  ];

  const handleIconSelect = async (icon: string) => {
    if (!profile) return;

    setUploadingAvatar(true);
    setErrorMsg(null);

    try {
      // 아이콘을 선택한 경우, avatar_url에 "icon:" 접두사를 붙여서 저장
      // 스토리지를 사용하지 않음
      const iconUrl = `icon:${icon}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: iconUrl })
        .eq("id", profile.id);

      if (updateError) {
        setErrorMsg("프로필 업데이트에 실패했습니다.");
        setUploadingAvatar(false);
        return;
      }

      // 로컬 상태 업데이트
      setProfile({ ...profile, avatar_url: iconUrl });
      setShowAvatarSelector(false);
    } catch (err: any) {
      console.error("아이콘 선택 에러:", err);
      setErrorMsg(err.message || "아이콘 선택 중 오류가 발생했습니다.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 크롭된 이미지를 생성하는 함수
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  // 크롭된 이미지를 Blob으로 변환하는 함수
  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    originalFileName?: string
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas context를 가져올 수 없습니다.");
    }

    // 크롭 영역 설정
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // 모든 이미지에서 먼저 전체 영역을 흰색으로 채움 (원본 이미지 외 추가 공간 처리)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pixelCrop.width, pixelCrop.height);

    // 이미지가 크롭 영역 안에 있는지 확인하고 그리기
    // pixelCrop 좌표가 이미지 범위를 벗어날 수 있으므로 클리핑 처리
    const sourceX = Math.max(0, pixelCrop.x);
    const sourceY = Math.max(0, pixelCrop.y);
    const sourceWidth = Math.min(pixelCrop.width, image.width - sourceX);
    const sourceHeight = Math.min(pixelCrop.height, image.height - sourceY);
    
    // 캔버스에 그릴 위치 계산 (원본이 음수 좌표에 있으면 캔버스에서 오프셋 조정)
    const destX = Math.max(0, -pixelCrop.x);
    const destY = Math.max(0, -pixelCrop.y);

    // 유효한 이미지 영역만 그리기
    if (sourceWidth > 0 && sourceHeight > 0 && sourceX < image.width && sourceY < image.height) {
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        destX,
        destY,
        sourceWidth,
        sourceHeight
      );
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 생성에 실패했습니다."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.9
      );
    });
  };

  // 크롭 완료 핸들러
  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // 크롭 모달에서 확인 버튼 클릭 시
  const handleCropComplete = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !profile || !cropImageFile) {
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg(null);

    try {
      // 크롭된 이미지 생성
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels, cropImageFile.name);
      const croppedFile = new File([croppedBlob], cropImageFile.name, { type: "image/jpeg" });

      // 이미지 압축 및 리사이즈 (300KB 이하로 제한)
      const compressedBlob = await compressImage(croppedFile, 400, 400, 300);
      const compressedFile = new File([compressedBlob], croppedFile.name, { type: "image/jpeg" });
      
      // 압축 후 크기 확인
      const sizeKB = compressedFile.size / 1024;
      console.log(`압축된 파일 크기: ${sizeKB.toFixed(2)}KB`);
      
      if (sizeKB > 300) {
        setErrorMsg(`파일 크기가 300KB를 초과합니다 (${sizeKB.toFixed(2)}KB). 더 작은 이미지를 선택해주세요.`);
        setUploadingAvatar(false);
        setShowImageCrop(false);
        return;
      }

      // 기존 프로필 사진이 있으면 삭제 (스토리지 파일인 경우만)
      if (profile.avatar_url && !profile.avatar_url.startsWith("icon:")) {
        try {
          // URL에서 파일 경로 추출
          const urlParts = profile.avatar_url.split("/");
          const fileName = urlParts[urlParts.length - 1];
          const filePath = `avatars/${fileName}`;
          
          // 기존 파일 삭제 시도 (에러가 나도 계속 진행)
          const { error: deleteError } = await supabase.storage
            .from("profile-images")
            .remove([filePath]);
          
          if (!deleteError) {
            // 삭제 성공 시 파일 목록 업데이트
            await checkStorageFiles();
          }
        } catch (err) {
          // 기존 파일 삭제 실패해도 새 파일 업로드는 계속 진행
        }
      }

      // Supabase Storage에 새 파일 업로드
      const fileExt = compressedFile.name.split(".").pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(filePath, compressedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("업로드 에러:", uploadError);
        
        // 버킷이 없을 때의 에러 처리
        if (
          uploadError.message?.includes("Bucket not found") ||
          uploadError.message?.includes("bucket") ||
          uploadError.message?.includes("does not exist")
        ) {
          setBucketAvailable(false);
          setErrorMsg(
            "프로필 사진 업로드 기능을 사용할 수 없습니다.\n\n" +
            "Supabase Storage에 'profile-images' 버킷이 필요합니다.\n" +
            "관리자에게 문의해주세요."
          );
        } else {
          setErrorMsg(`이미지 업로드에 실패했습니다: ${uploadError.message}`);
        }
        setUploadingAvatar(false);
        setShowImageCrop(false);
        return;
      }

      // 공개 URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from("profile-images")
        .getPublicUrl(filePath);

      // 프로필 업데이트
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      if (updateError) {
        setErrorMsg("프로필 업데이트에 실패했습니다.");
        setUploadingAvatar(false);
        setShowImageCrop(false);
        return;
      }

      // 로컬 상태 업데이트
      setProfile({ ...profile, avatar_url: publicUrl });
      setShowAvatarSelector(false);
      setShowImageCrop(false);
      // 크롭 모달 상태 초기화
      setCropImageFile(null);
      setCropImageSrc("");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      await checkStorageFiles(); // 스토리지 파일 개수 업데이트
    } catch (err: any) {
      console.error("아바타 업로드 에러:", err);
      setErrorMsg(err.message || "이미지 업로드 중 오류가 발생했습니다.");
      setShowImageCrop(false);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 파일 선택 시 크롭 모달 열기
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith("image/")) {
      setErrorMsg("이미지 파일만 업로드 가능합니다.");
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    // 파일을 읽어서 크롭 모달에 표시
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageFile(file);
      setCropImageSrc(reader.result as string);
      setShowImageCrop(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    };
    reader.onerror = () => {
      setErrorMsg("파일을 읽을 수 없습니다.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      // 업데이트할 데이터 준비 (gender 컬럼이 없을 수 있으므로 제외)
      const updateData: any = {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        birth: birth || null,
        position: position.trim() || null,
        department: department.trim() || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id);

      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }

      setEditing(false);
      await loadProfile();
    } catch (err: any) {
      setErrorMsg(err.message ?? "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
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
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      setPosition(data.position || "");
      setDepartment(data.department || "");
      setGender((data as any).gender || "");
      setIsManager(data.department && data.role === "manager");
    }
  };

  const handleLogout = async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      await supabase.auth.signOut();
      router.push("/login");
    }
  };

  const handlePasswordChange = async () => {
    setErrorMsg(null);

    // 현재 비밀번호 확인이 필요한 경우 (skipCurrentPassword가 false일 때)
    if (!skipCurrentPassword && !currentPassword) {
      setErrorMsg("현재 비밀번호를 입력해주세요.");
      return;
    }

    if (newPassword.length < 6) {
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        setErrorMsg("사용자 정보를 가져올 수 없습니다.");
        setChangingPassword(false);
        return;
      }

      // 현재 비밀번호 확인이 필요한 경우에만 확인
      if (!skipCurrentPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (signInError) {
          setErrorMsg("현재 비밀번호가 올바르지 않습니다.");
          setChangingPassword(false);
          return;
        }
      }

      // 비밀번호 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setErrorMsg(updateError.message || "비밀번호 변경에 실패했습니다.");
        setChangingPassword(false);
        return;
      }


      // 성공
      alert("비밀번호가 성공적으로 변경되었습니다.");
      setShowPasswordChange(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSkipCurrentPassword(false);
    } catch (err: any) {
      console.error("비밀번호 변경 에러:", err);
      setErrorMsg(err.message ?? "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setChangingPassword(false);
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

  const age = calculateAge(profile.birth);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f9fafb",
        padding: "20px",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      {/* 상단 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: isMobile ? "15px" : "16px", color: "#1f2937", fontWeight: 500, marginBottom: 4 }}>
            샬롬! {profile.full_name || "회원"}{profile.position ? ` ${profile.position}` : ""}님,
          </div>
          <div style={{ fontSize: isMobile ? "14px" : "15px", color: "#6b7280" }}>
            사랑하고 축복합니다.
          </div>
        </div>
        <div
          style={{
            position: "relative",
            cursor: editing ? "pointer" : "default",
          }}
          onClick={() => {
            if (editing) {
              setShowAvatarSelector(true);
            }
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              overflow: "hidden",
              border: editing ? "3px solid #3b82f6" : "none",
              backgroundImage: profile.avatar_url && !profile.avatar_url.startsWith("icon:") 
                ? `url(${profile.avatar_url})` 
                : "none",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {profile.avatar_url?.startsWith("icon:") 
              ? profile.avatar_url.replace("icon:", "")
              : !profile.avatar_url 
                ? (profile.full_name ? profile.full_name.charAt(0) : "👤")
                : null}
          </div>
          {editing && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                color: "#ffffff",
                border: "2px solid #ffffff",
              }}
            >
              ✏️
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* 프로필 정보 카드 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          padding: "24px",
          marginBottom: 20,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        {errorMsg && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px",
              backgroundColor: "#fef2f2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* 이름(성별, 나이) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>이름</span>
            {editing ? (
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  flex: 1,
                  maxWidth: "200px",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  textAlign: "right",
                }}
              />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>
                {profile.full_name || "-"}
                {((profile.gender || age !== null) && !editing) && (
                  <span style={{ fontSize: 13, color: "#6b7280", marginLeft: "8px" }}>
                    ({profile.gender || ""}{profile.gender && age !== null ? ", " : ""}{age !== null ? `${age}세` : ""})
                  </span>
                )}
              </span>
            )}
          </div>

          {/* 생년월일 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>생년월일</span>
            {editing ? (
              <input
                type="date"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                style={{
                  flex: 1,
                  maxWidth: "200px",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  textAlign: "right",
                }}
              />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>
                {profile.birth ? new Date(profile.birth).toLocaleDateString("ko-KR") : "-"}
              </span>
            )}
          </div>

          {/* 직분 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>직분</span>
            {editing ? (
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                style={{
                  flex: 1,
                  maxWidth: "200px",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  textAlign: "right",
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
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>
                {profile.position || "-"}
              </span>
            )}
          </div>

          {/* 전화번호 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>전화번호</span>
            {editing ? (
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  flex: 1,
                  maxWidth: "200px",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  textAlign: "right",
                }}
              />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>
                {profile.phone || "-"}
              </span>
            )}
          </div>

          {/* 이메일 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>이메일</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>
              {profile.email || "-"}
            </span>
          </div>

          {/* 비밀번호 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>비밀번호</span>
            <button
              onClick={async () => {
                // URL에서 recovery 타입인지 확인 (비밀번호 재설정 후)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const type = hashParams.get("type");
                const urlParams = new URLSearchParams(window.location.search);
                const typeFromQuery = urlParams.get("type");
                
                // recovery 타입이면 현재 비밀번호 확인 건너뛰기
                const isRecovery = type === "recovery" || typeFromQuery === "recovery";
                setSkipCurrentPassword(isRecovery);
                setShowPasswordChange(true);
                
                // URL에서 hash 제거 (한 번만 적용)
                if (isRecovery && window.location.hash) {
                  window.history.replaceState(null, "", window.location.pathname + window.location.search);
                }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #3b82f6",
                background: "#ffffff",
                color: "#3b82f6",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#eff6ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
              }}
            >
              비밀번호 변경
            </button>
          </div>

          {/* 담당교육부서 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>담당교육부서</span>
            {editing ? (
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{
                  flex: 1,
                  maxWidth: "200px",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  textAlign: "right",
                }}
              >
                <option value="">선택 안 함</option>
                <option value="유치부">유치부</option>
                <option value="유초등부">유초등부</option>
                <option value="청소년부">청소년부</option>
                <option value="청년부">청년부</option>
              </select>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>
                {profile.department || "-"}
                {isManager && (
                  <span
                    style={{
                      marginLeft: "8px",
                      padding: "2px 8px",
                      backgroundColor: "#3b82f6",
                      color: "#ffffff",
                      borderRadius: "12px",
                      fontSize: "11px",
                    }}
                  >
                    담당자
                  </span>
                )}
              </span>
            )}
          </div>

          {/* 권한 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>권한</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>
              {profile.role === "admin" ? "관리자" : profile.role === "leader" ? "리더" : "멤버"}
            </span>
          </div>

          {/* 승인상태 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 14, color: "#6b7280" }}>승인 상태</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: profile.approved ? "#10b981" : "#ef4444",
              }}
            >
              {profile.approved ? "✓ 승인됨" : "✗ 미승인"}
            </span>
          </div>
        </div>
      </div>

      {/* 하단 버튼들 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: saving ? "#d1d5db" : "#3b82f6",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 16,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              }}
            >
              {saving ? "저장 중..." : "저장하기"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                loadProfile();
              }}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#374151",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              취소
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "#3b82f6",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            프로필 수정
          </button>
        )}

        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            color: "#ef4444",
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          로그아웃
        </button>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordChange && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => {
            if (!changingPassword) {
              setShowPasswordChange(false);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setErrorMsg(null);
              setSkipCurrentPassword(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: isMobile ? "24px" : "32px",
              maxWidth: isMobile ? "calc(100vw - 40px)" : "400px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                비밀번호 변경
              </h2>
              <button
                onClick={() => {
                  if (!changingPassword) {
                    setShowPasswordChange(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setErrorMsg(null);
                    setSkipCurrentPassword(false);
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: changingPassword ? "not-allowed" : "pointer",
                  color: "#6b7280",
                  padding: 0,
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={changingPassword}
              >
                ×
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px",
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {skipCurrentPassword && (
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#eff6ff",
                    color: "#1e40af",
                    border: "1px solid #bfdbfe",
                    borderRadius: 8,
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  ℹ️ 비밀번호 재설정 링크를 통해 접속하셨으므로 현재 비밀번호 확인을 건너뜁니다.
                </div>
              )}
              
              {!skipCurrentPassword && (
                <div>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#374151",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    현재 비밀번호
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={changingPassword}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      fontSize: 14,
                    }}
                    required
                  />
                </div>
              )}

              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changingPassword}
                  placeholder="6자 이상 입력해주세요"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                  }}
                  required
                  minLength={6}
                />
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, margin: 0 }}>
                  최소 6자 이상 입력해주세요
                </p>
              </div>

              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changingPassword}
                  placeholder="새 비밀번호를 다시 입력해주세요"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    fontSize: 14,
                  }}
                  required
                  minLength={6}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <button
                  onClick={() => {
                    if (!changingPassword) {
                      setShowPasswordChange(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setErrorMsg(null);
                      setSkipCurrentPassword(false);
                    }
                  }}
                  disabled={changingPassword}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    background: "#ffffff",
                    color: "#374151",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: changingPassword ? "not-allowed" : "pointer",
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={changingPassword}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "none",
                    background: changingPassword ? "#d1d5db" : "#3b82f6",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: changingPassword ? "not-allowed" : "pointer",
                  }}
                >
                  {changingPassword ? "변경 중..." : "변경하기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 사진/아이콘 선택 모달 */}
      {showAvatarSelector && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowAvatarSelector(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: isMobile ? "16px" : "24px",
              maxWidth: isMobile ? "calc(100vw - 40px)" : "500px",
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                프로필 아이콘 선택
              </h2>
              <button
                onClick={() => setShowAvatarSelector(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 0,
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {/* 기본 아이콘 선택 */}
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: "12px",
                }}
              >
                기본 아이콘 선택
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "repeat(6, 1fr)" : "repeat(8, 1fr)",
                  gap: isMobile ? "6px" : "8px",
                }}
              >
                {defaultIcons.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => handleIconSelect(icon)}
                    style={{
                      width: isMobile ? "100%" : "40px",
                      height: isMobile ? "auto" : "40px",
                      aspectRatio: "1",
                      borderRadius: "50%",
                      border:
                        profile.avatar_url === `icon:${icon}`
                          ? "3px solid #3b82f6"
                          : "2px solid #e5e7eb",
                      backgroundColor: "#ffffff",
                      fontSize: isMobile ? "20px" : "22px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                      padding: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      if (profile.avatar_url !== `icon:${icon}`) {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                      }
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* 스토리지에 업로드된 사진들 */}
            {bucketAvailable === true && storageFiles.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: "12px",
                  }}
                >
                  업로드된 사진 ({storageFiles.length}개)
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "repeat(4, 1fr)" : "repeat(6, 1fr)",
                    gap: isMobile ? "6px" : "8px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {storageFiles.map((file) => {
                    const fileUrl = getStorageFileUrl(file.name);
                    const isSelected = profile.avatar_url === fileUrl;
                    const fileSize = (file as any).metadata?.size || (file as any).size || 0;
                    const sizeKB = (fileSize / 1024).toFixed(1);
                    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
                    const displaySize = fileSize > 1024 * 1024 ? `${sizeMB}MB` : `${sizeKB}KB`;
                    
                    return (
                      <div
                        key={file.id || file.name}
                        style={{
                          position: "relative",
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "1",
                            marginBottom: "4px",
                          }}
                        >
                          <button
                            onClick={() => handleSelectStorageImage(file.name)}
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: "8px",
                              border: isSelected
                                ? "3px solid #3b82f6"
                                : "2px solid #e5e7eb",
                              backgroundColor: "#ffffff",
                              cursor: "pointer",
                              overflow: "hidden",
                              padding: 0,
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = "#3b82f6";
                              }
                              e.currentTarget.style.transform = "scale(1.05)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = "#e5e7eb";
                              }
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            <img
                              src={fileUrl}
                              alt="프로필 사진"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteStorageImage(file.name, e);
                            }}
                            style={{
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              backgroundColor: "rgba(239, 68, 68, 0.9)",
                              border: "none",
                              color: "#ffffff",
                              fontSize: "14px",
                              fontWeight: "bold",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              zIndex: 10,
                              lineHeight: 1,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 1)";
                              e.currentTarget.style.transform = "scale(1.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.9)";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: isMobile ? "10px" : "11px",
                            color: "#6b7280",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {displaySize}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 직접 업로드 */}
            {bucketAvailable !== false && (
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: "12px",
                  }}
                >
                  사진 직접 업로드
                </div>
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "2px dashed #d1d5db",
                    backgroundColor: "#f9fafb",
                    color: "#374151",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.backgroundColor = "#eff6ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#d1d5db";
                    e.currentTarget.style.backgroundColor = "#f9fafb";
                  }}
                >
                  📷 사진 업로드
                </button>
              </div>
            )}

            {/* 스토리지 파일 정보 */}
            {bucketAvailable === true && storageFileCount !== null && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "12px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                📦 스토리지 파일 개수: {storageFileCount}개
                <button
                  onClick={checkStorageFiles}
                  style={{
                    marginLeft: "8px",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#ffffff",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  새로고침
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 이미지 크롭 모달 */}
      {showImageCrop && cropImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1002,
            padding: isMobile ? "10px" : "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: isMobile ? "16px" : "24px",
              maxWidth: isMobile ? "100%" : "600px",
              width: "100%",
              maxHeight: isMobile ? "calc(100vh - 40px)" : "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                사진 편집
              </h2>
              <button
                onClick={() => {
                  setShowImageCrop(false);
                  setCropImageFile(null);
                  setCropImageSrc("");
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                  setCroppedAreaPixels(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 0,
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {/* 크롭 영역 */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: isMobile ? "300px" : "400px",
                backgroundColor: "#000000",
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "20px",
              }}
            >
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round"
                showGrid={false}
                restrictPosition={false}
              />
            </div>

            {/* 줌 조절 슬라이더 */}
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    minWidth: "60px",
                  }}
                >
                  크기 조절
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{
                    flex: 1,
                    height: "6px",
                    borderRadius: "3px",
                    background: "#e5e7eb",
                    outline: "none",
                    cursor: "pointer",
                  }}
                />
                <span
                  style={{
                    fontSize: "14px",
                    color: "#374151",
                    minWidth: "40px",
                    textAlign: "right",
                  }}
                >
                  {Math.round(zoom * 100)}%
                </span>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div
              style={{
                display: "flex",
                gap: "12px",
              }}
            >
              <button
                onClick={() => {
                  setShowImageCrop(false);
                  setCropImageFile(null);
                  setCropImageSrc("");
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                  setCroppedAreaPixels(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleCropComplete}
                disabled={uploadingAvatar || !croppedAreaPixels}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    uploadingAvatar || !croppedAreaPixels
                      ? "#d1d5db"
                      : "#3b82f6",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "16px",
                  cursor:
                    uploadingAvatar || !croppedAreaPixels
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {uploadingAvatar ? "업로드 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1003,
            padding: isMobile ? "20px" : "40px",
          }}
          onClick={() => {
            setShowDeleteConfirm(false);
            setPendingDeleteFileName(null);
            setPendingDeleteEvent(null);
          }}
        >
          <div
            style={{
              backgroundColor: "#f5f5f5",
              borderRadius: "14px",
              padding: isMobile ? "24px" : "28px",
              maxWidth: isMobile ? "calc(100vw - 40px)" : "320px",
              width: "100%",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 아이콘 */}
            <div
              style={{
                width: isMobile ? "48px" : "56px",
                height: isMobile ? "48px" : "56px",
                backgroundColor: "#000000",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "60%",
                  height: "60%",
                  backgroundColor: "#ffffff",
                  borderRadius: "4px",
                  position: "relative",
                  transform: "rotate(45deg)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%) rotate(-45deg)",
                    width: "40%",
                    height: "2px",
                    backgroundColor: "#000000",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%) rotate(-45deg)",
                    width: "2px",
                    height: "40%",
                    backgroundColor: "#000000",
                  }}
                />
              </div>
            </div>

            {/* 텍스트 */}
            <div
              style={{
                fontSize: isMobile ? "16px" : "17px",
                color: "#000000",
                textAlign: "center",
                marginBottom: "28px",
                lineHeight: 1.4,
              }}
            >
              이 사진을 삭제하시겠습니까?
            </div>

            {/* 버튼 영역 */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                width: "100%",
              }}
            >
              {/* Cancel 버튼 */}
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setPendingDeleteFileName(null);
                  setPendingDeleteEvent(null);
                }}
                style={{
                  flex: 1,
                  padding: isMobile ? "12px" : "14px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#e5e5e5",
                  color: "#333333",
                  fontSize: isMobile ? "15px" : "16px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#d5d5d5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#e5e5e5";
                }}
              >
                Cancel
              </button>

              {/* OK 버튼 */}
              <button
                onClick={executeDeleteStorageImage}
                disabled={uploadingAvatar}
                style={{
                  flex: 1,
                  padding: isMobile ? "12px" : "14px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: uploadingAvatar ? "#94a3b8" : "#007AFF",
                  color: "#ffffff",
                  fontSize: isMobile ? "15px" : "16px",
                  fontWeight: 500,
                  cursor: uploadingAvatar ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!uploadingAvatar) {
                    e.currentTarget.style.backgroundColor = "#0056CC";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!uploadingAvatar) {
                    e.currentTarget.style.backgroundColor = "#007AFF";
                  }
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadingAvatar && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "24px",
              borderRadius: "12px",
              fontSize: 14,
              color: "#1f2937",
            }}
          >
            {profile?.avatar_url?.startsWith("icon:") 
              ? "아이콘 적용 중..." 
              : "이미지 업로드 중..."}
          </div>
        </div>
      )}
    </div>
  );
}
