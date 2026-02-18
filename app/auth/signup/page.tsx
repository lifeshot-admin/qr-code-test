"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import {
  sendVerificationCode,
  verifyEmailCode,
  checkNickname,
  getTermsPolicies,
  submitAllTermsAgreements,
  signup,
  uploadProfileImage,
  type TermsPolicy,
  type SignupPayload,
} from "@/lib/api-client";

// ==================== TYPES ====================

type SignupStep = "terms" | "verify" | "password" | "nickname" | "profile";

const STEP_ORDER: SignupStep[] = ["terms", "verify", "password", "nickname", "profile"];

type SignupData = {
  email: string;
  password: string;
  confirmPassword: string;
  termsAgreements: { policyType: string; agreed: boolean }[];
  nickname: string;
  profileImageFile: File | null;
  profileImagePreview: string | null;
  language: string;
};

// ==================== STEP LABELS ====================

const STEP_LABELS: Record<SignupStep, { title: string; description: string }> = {
  terms: { title: "약관 동의", description: "서비스 이용을 위해 약관에 동의해주세요." },
  verify: { title: "이메일 인증", description: "이메일로 전송된 인증 코드를 입력해주세요." },
  password: { title: "비밀번호 설정", description: "사용하실 비밀번호를 설정해주세요." },
  nickname: { title: "닉네임 설정", description: "사용하실 닉네임을 입력해주세요." },
  profile: { title: "프로필 설정 및 완료", description: "프로필 사진을 설정하고 가입을 완료하세요." },
};

// ==================== HELPERS ====================

function logUserAction(buttonName: string, data?: Record<string, unknown>) {
  const now = new Date();
  const time = now.toLocaleTimeString("ko-KR", { hour12: false });
  console.log(`[USER_ACTION] Button: ${buttonName}, Time: ${time}, Data:`, data || {});
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg && msg !== "API request failed") return msg;
  }
  return "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";
}

// ==================== INNER COMPONENT (useSearchParams 필요) ====================

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 이메일은 signin 페이지에서 전달받음
  const emailFromQuery = searchParams.get("email") || "";

  // Step management
  const [currentStep, setCurrentStep] = useState<SignupStep>("terms");
  const [signupData, setSignupData] = useState<SignupData>({
    email: emailFromQuery,
    password: "",
    confirmPassword: "",
    termsAgreements: [],
    nickname: "",
    profileImageFile: null,
    profileImagePreview: null,
    language: "ko",
  });

  // 이메일이 없으면 signin으로 리다이렉트
  useEffect(() => {
    if (!emailFromQuery) {
      router.replace("/auth/signin");
    }
  }, [emailFromQuery, router]);

  // Step change 로깅
  useEffect(() => {
    const label = STEP_LABELS[currentStep];
    console.log(`[STEP_CHANGE] Current Step: ${label.title}`);
  }, [currentStep]);

  // Global states
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Terms
  const [terms, setTerms] = useState<TermsPolicy[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [selectedTermsModal, setSelectedTermsModal] = useState<TermsPolicy | null>(null);

  // Email Verification
  const [verificationCode, setVerificationCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // 재발송 Back-off 로직
  const [resendCount, setResendCount] = useState(0); // 재발송 횟수 (최초 발송 제외)
  const [resendBlocked, setResendBlocked] = useState(false); // 4회 이상 차단

  // Back-off 쿨다운 시간 (초) 결정
  // 1회: 즉시(0s), 2회: 30s, 3회: 60s, 4회+: 차단(30분 후 초기화)
  const getResendCooldown = (count: number): number => {
    switch (count) {
      case 1: return 0;   // 1회 재발송 → 즉시 가능
      case 2: return 30;  // 2회 재발송 → 30초 대기
      case 3: return 60;  // 3회 재발송 → 60초 대기
      default: return -1; // 4회 이상 → 차단
    }
  };

  // 30분 후 차단 해제 타이머
  const resendBlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resendBlockTimerRef.current) clearTimeout(resendBlockTimerRef.current);
    };
  }, []);

  // Nickname
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [checkingNickname, setCheckingNickname] = useState(false);

  // Password
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong">("weak");
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress
  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  // ==================== TOAST ====================

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ==================== 약관 관련 상수 ====================

  // UI에서 숨기되 자동 동의 처리할 약관 타입
  const HIDDEN_AUTO_AGREE_TYPES = ["PRIVACY_PHONE", "PRIVACY_PHOTO"];
  // UI에서 완전히 제거할 약관 타입
  const EXCLUDED_TYPES = ["PRIVACY_PAYMENT"];
  // 노션 링크 매핑 (policyType → 외부 URL)
  const TERMS_NOTION_LINKS: Record<string, string> = {
    SERVICE_TERMS: "https://myking.notion.site/SERVICE_TERMS",
    PRIVACY_SIGNUP: "https://myking.notion.site/PRIVACY_SIGNUP",
    MARKETING_CONSENT: "https://myking.notion.site/MARKETING_CONSENT",
  };
  // 한국어 약관 이름 매핑
  const TERMS_KO_NAMES: Record<string, string> = {
    SERVICE_TERMS: "치이즈 서비스 이용 약관",
    PRIVACY_SIGNUP: "개인정보 처리방침",
    MARKETING_CONSENT: "마이킹 수신 정보 동의",
  };

  // UI에 보여줄 약관만 필터링 (PRIVACY_PAYMENT 제거, PRIVACY_PHONE/PHOTO 숨김)
  const visibleTerms = terms.filter(
    (t) => !EXCLUDED_TYPES.includes(t.policyType) && !HIDDEN_AUTO_AGREE_TYPES.includes(t.policyType)
  );

  // ==================== STEP: Terms ====================

  useEffect(() => {
    if (currentStep === "terms" && terms.length === 0) {
      fetchTerms();
    }
  }, [currentStep]);

  const fetchTerms = async () => {
    setLoadingTerms(true);
    try {
      const response = await getTermsPolicies("ko");
      const termsData = response.data || [];
      setTerms(termsData);
      setSignupData((prev) => ({
        ...prev,
        termsAgreements: termsData
          .filter((term: TermsPolicy) => !EXCLUDED_TYPES.includes(term.policyType)) // PRIVACY_PAYMENT 완전 제외
          .map((term: TermsPolicy) => ({
            policyType: term.policyType,
            // PRIVACY_PHONE, PRIVACY_PHOTO는 자동 동의
            agreed: HIDDEN_AUTO_AGREE_TYPES.includes(term.policyType) ? true : false,
          })),
      }));
    } catch (error) {
      console.error("Failed to fetch terms:", error);
      showToast("약관 불러오기에 실패했습니다. 다시 시도해주세요.", "error");
    } finally {
      setLoadingTerms(false);
    }
  };

  const toggleTermAgreement = (policyType: string, agreed: boolean) => {
    setSignupData((prev) => ({
      ...prev,
      termsAgreements: prev.termsAgreements.map((t) =>
        t.policyType === policyType ? { ...t, agreed } : t
      ),
    }));
  };

  const toggleAllTerms = (agreed: boolean) => {
    setSignupData((prev) => ({
      ...prev,
      termsAgreements: prev.termsAgreements.map((t) => {
        // 숨겨진 자동 동의 항목은 항상 true 유지
        if (HIDDEN_AUTO_AGREE_TYPES.includes(t.policyType)) return { ...t, agreed: true };
        return { ...t, agreed };
      }),
    }));
  };

  const allRequiredTermsAgreed = (): boolean => {
    // visibleTerms 기준으로 필수 항목만 체크 (숨겨진 항목은 이미 자동 동의)
    return signupData.termsAgreements.every((agreement) => {
      const term = terms.find((t) => t.policyType === agreement.policyType);
      if (!term) return true;
      if (HIDDEN_AUTO_AGREE_TYPES.includes(agreement.policyType)) return true; // 자동 동의
      if (EXCLUDED_TYPES.includes(agreement.policyType)) return true; // 제외 항목
      return !term.isRequired || agreement.agreed;
    });
  };

  const allVisibleTermsAgreed = (): boolean => {
    const visibleAgreements = signupData.termsAgreements.filter(
      (t) => !HIDDEN_AUTO_AGREE_TYPES.includes(t.policyType) && !EXCLUDED_TYPES.includes(t.policyType)
    );
    return visibleAgreements.length > 0 && visibleAgreements.every((t) => t.agreed);
  };

  // [보기] 클릭 시 노션 링크 새 창 열기
  const handleViewTerms = (term: TermsPolicy) => {
    logUserAction("약관 보기", { policyType: term.policyType });
    const notionUrl = TERMS_NOTION_LINKS[term.policyType];
    const linkUrl = notionUrl || term.url;
    if (linkUrl) {
      window.open(linkUrl, "_blank", "noopener,noreferrer");
    } else {
      // 링크가 없으면 기존 모달로 폴백
      setSelectedTermsModal(term);
    }
  };

  const handleSubmitTerms = async (): Promise<boolean> => {
    logUserAction("약관 동의 제출", { agreedCount: signupData.termsAgreements.filter(t => t.agreed).length });
    if (!allRequiredTermsAgreed()) {
      showToast("필수 약관에 모두 동의해주세요.", "error");
      return false;
    }

    setSubmitting(true);
    try {
      // 모든 약관 (숨겨진 자동 동의 포함)을 서버에 전송
      const allAgreements = signupData.termsAgreements.map((t) => ({
        policyType: t.policyType,
        agreed: HIDDEN_AUTO_AGREE_TYPES.includes(t.policyType) ? true : t.agreed,
      }));

      await submitAllTermsAgreements(
        signupData.email,
        allAgreements.filter((t) => t.agreed)
      );
      showToast("약관 동의가 완료되었습니다.", "success");
      return true;
    } catch (error) {
      showToast(getErrorMessage(error), "error");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== STEP: Email Verification ====================

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 약관 동의 완료 후 자동으로 인증 코드 발송
  useEffect(() => {
    if (currentStep === "verify" && !codeSent) {
      handleSendCode(false);
    }
  }, [currentStep]);

  const handleSendCode = async (isResend: boolean = false) => {
    logUserAction(isResend ? "인증코드 재발송" : "인증코드 발송", {
      email: signupData.email,
      resendCount: isResend ? resendCount + 1 : 0,
    });

    // 재발송인 경우 Back-off 체크
    if (isResend) {
      const nextCount = resendCount + 1;

      // 4회 이상 → 차단
      if (nextCount > 3) {
        setResendBlocked(true);
        console.log(`[RESEND_LOG] Attempt: ${nextCount}, WaitTime: BLOCKED (30분)`);
        showToast("재발송 횟수를 초과했습니다. 30분 뒤에 다시 시도하거나 고객센터에 문의해주세요.", "error");

        // 30분(1800초) 후 차단 해제
        resendBlockTimerRef.current = setTimeout(() => {
          setResendBlocked(false);
          setResendCount(0);
          setCountdown(0);
          console.log("[RESEND_LOG] 30분 경과 → 차단 해제, 카운트 초기화");
        }, 30 * 60 * 1000);
        return;
      }
    }

    setSendingCode(true);
    try {
      await sendVerificationCode(signupData.email, signupData.language);

      if (isResend) {
        const newResendCount = resendCount + 1;
        setResendCount(newResendCount);
        const cooldown = getResendCooldown(newResendCount);
        console.log(`[RESEND_LOG] Attempt: ${newResendCount}, WaitTime: ${cooldown >= 0 ? cooldown + "s" : "BLOCKED"}`);

        if (cooldown > 0) {
          setCountdown(cooldown);
        }
        // cooldown === 0 이면 즉시 재발송 가능 (카운트다운 없음)
      } else {
        // 최초 발송: 3분 카운트다운
        setCountdown(180);
        console.log("[RESEND_LOG] Attempt: 0 (initial), WaitTime: 180s");
      }

      setCodeSent(true);
      // 이전 코드 입력값 초기화 (새 코드 발송됨)
      setVerificationCode("");
      showToast("인증 코드가 이메일로 전송되었습니다.", "success");
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async (code: string) => {
    logUserAction("인증코드 자동검증", { code });
    if (!code || code.length !== 6) return;

    setVerifyingCode(true);
    try {
      await verifyEmailCode(signupData.email, code);
      setIsVerified(true);
      showToast("이메일 인증이 완료되었습니다!", "success");
    } catch (error) {
      const msg = getErrorMessage(error);
      if (msg.includes("만료") || msg.includes("expired")) {
        showToast("인증 코드가 만료되었습니다. 다시 발송해주세요.", "error");
      } else if (msg.includes("잘못") || msg.includes("invalid") || msg.includes("틀")) {
        showToast("인증 코드가 올바르지 않습니다. 다시 확인해주세요.", "error");
      } else {
        showToast(msg, "error");
      }
      // 실패 시 입력 초기화하여 재입력 유도
      setVerificationCode("");
    } finally {
      setVerifyingCode(false);
    }
  };

  // ── Auto-Submit: 6자리 입력 시 즉시 검증 ──
  useEffect(() => {
    if (verificationCode.length === 6 && !isVerified && !verifyingCode) {
      handleVerifyCode(verificationCode);
    }
  }, [verificationCode]);

  // ==================== STEP: Password ====================

  useEffect(() => {
    const { password } = signupData;
    if (!password) {
      setPasswordStrength("weak");
      return;
    }
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    const isLongEnough = password.length >= 8;

    const score = [hasLower, hasUpper, hasNumber, hasSpecial, isLongEnough].filter(Boolean).length;
    setPasswordStrength(score >= 4 ? "strong" : score >= 3 ? "medium" : "weak");
  }, [signupData.password]);

  useEffect(() => {
    setPasswordMatch(
      !signupData.confirmPassword || signupData.password === signupData.confirmPassword
    );
  }, [signupData.password, signupData.confirmPassword]);

  // ==================== STEP: Nickname ====================

  const handleCheckNicknameOnNext = async (): Promise<boolean> => {
    logUserAction("닉네임 중복확인", { nickname: signupData.nickname });
    if (!signupData.nickname || signupData.nickname.length < 2) {
      showToast("닉네임은 2자 이상 입력해주세요.", "error");
      return false;
    }

    setCheckingNickname(true);
    try {
      await checkNickname(signupData.nickname);
      setNicknameAvailable(true);
      return true;
    } catch (error) {
      setNicknameAvailable(false);
      const msg = getErrorMessage(error);
      if (msg.includes("이미") || msg.includes("중복") || msg.includes("exist")) {
        showToast("이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.", "error");
      } else {
        showToast(msg, "error");
      }
      return false;
    } finally {
      setCheckingNickname(false);
    }
  };

  // ==================== STEP: Profile & Final ====================

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 업로드 가능합니다. (JPG, PNG, GIF)", "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast("파일 크기는 10MB 이하만 가능합니다.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSignupData((prev) => ({
        ...prev,
        profileImageFile: file,
        profileImagePreview: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeProfileImage = () => {
    setSignupData((prev) => ({
      ...prev,
      profileImageFile: null,
      profileImagePreview: null,
    }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    logUserAction("가입 완료", { email: signupData.email, nickname: signupData.nickname });
    setSubmitting(true);
    try {
      const signupPayload: SignupPayload = {
        nickname: signupData.nickname,
        email: signupData.email,
        password: signupData.password,
        language: signupData.language,
      };

      console.log("[STEP_CHANGE] Current Step: 최종 가입 요청");
      console.log("[SIGNUP] Payload:", JSON.stringify({ ...signupPayload, password: "***" }));

      const { response: signupResponse, accessToken } = await signup(signupPayload);

      console.log("[STEP_CHANGE] Current Step: 가입 성공");
      console.log("[SIGNUP] Response userId:", signupResponse.data?.id || signupResponse.data?.userId);
      console.log("[SIGNUP] AccessToken:", accessToken ? "있음" : "없음");

      // 프로필 이미지 업로드 시퀀스
      if (signupData.profileImageFile) {
        console.log("[PROFILE_IMAGE] 프로필 이미지 업로드 시작");
        console.log("[PROFILE_IMAGE] File:", {
          name: signupData.profileImageFile.name,
          size: signupData.profileImageFile.size,
          type: signupData.profileImageFile.type,
        });

        if (accessToken) {
          try {
            const userId = signupResponse.data?.id || signupResponse.data?.userId;
            if (userId) {
              console.log("[PROFILE_IMAGE] userId:", userId, "→ uploadProfileImage 호출");
              await uploadProfileImage(userId, signupData.profileImageFile, accessToken);
              console.log("[STEP_CHANGE] Current Step: 프로필 이미지 업로드 성공");
            } else {
              console.warn("[PROFILE_IMAGE] userId를 응답에서 추출하지 못했습니다:", signupResponse.data);
              showToast("프로필 사진 업로드에 실패했지만, 회원가입은 완료되었습니다.", "info");
            }
          } catch (uploadError) {
            console.error("[PROFILE_IMAGE] 업로드 실패:", uploadError);
            showToast("프로필 사진 업로드에 실패했지만, 회원가입은 완료되었습니다.", "info");
          }
        } else {
          console.warn("[PROFILE_IMAGE] accessToken이 없어 프로필 이미지 업로드를 건너뜁니다.");
          showToast("프로필 사진 업로드에 실패했지만, 회원가입은 완료되었습니다.", "info");
        }
      } else {
        console.log("[PROFILE_IMAGE] 프로필 이미지 없음 → 기본 이미지 사용");
      }

      sessionStorage.removeItem("signupData");
      showToast("회원가입이 완료되었습니다! 자동 로그인 중...", "success");

      // 자동 로그인
      const loginResult = await signIn("credentials", {
        email: signupData.email,
        password: signupData.password,
        redirect: false,
      });

      if (loginResult?.ok) {
        console.log("[STEP_CHANGE] Current Step: 자동 로그인 성공 → 홈으로 이동");
        router.push("/");
      } else {
        console.warn("[STEP_CHANGE] Current Step: 자동 로그인 실패");
        showToast("회원가입은 완료되었으나 자동 로그인에 실패했습니다.", "info");
        setTimeout(() => router.push("/auth/signin"), 2000);
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      if (msg.includes("이미") || msg.includes("중복") || msg.includes("exist")) {
        showToast("이미 가입된 계정입니다. 로그인 페이지로 이동해주세요.", "error");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== NAVIGATION ====================

  const handleNext = async () => {
    logUserAction("다음", { currentStep, email: signupData.email });

    switch (currentStep) {
      case "terms": {
        if (!allRequiredTermsAgreed()) {
          showToast("필수 약관에 동의해주세요.", "error");
          return;
        }
        const termsSuccess = await handleSubmitTerms();
        if (!termsSuccess) return;
        setCurrentStep("verify");
        break;
      }
      case "verify": {
        if (!isVerified) {
          showToast("이메일 인증을 완료해주세요.", "error");
          return;
        }
        setCurrentStep("password");
        break;
      }
      case "password": {
        if (!signupData.password || signupData.password.length < 8) {
          showToast("비밀번호는 8자 이상이어야 합니다.", "error");
          return;
        }
        if (passwordStrength === "weak") {
          showToast("비밀번호 보안 강도를 높여주세요.", "error");
          return;
        }
        if (!passwordMatch) {
          showToast("비밀번호가 일치하지 않습니다.", "error");
          return;
        }
        setCurrentStep("nickname");
        break;
      }
      case "nickname": {
        // "다음" 클릭 시에만 닉네임 중복 체크
        const nicknameOk = await handleCheckNicknameOnNext();
        if (!nicknameOk) return;
        setCurrentStep("profile");
        break;
      }
      case "profile": {
        await handleSubmit();
        return;
      }
    }
  };

  const handleBack = () => {
    logUserAction("이전", { currentStep });
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEP_ORDER[idx - 1]);
    } else {
      // 첫 단계에서 뒤로가면 signin으로
      router.push("/auth/signin");
    }
  };

  // ==================== RENDER: Toast ====================

  const renderToast = () => {
    if (!toast) return null;
    const bgColor =
      toast.type === "success" ? "bg-green-500" :
      toast.type === "error" ? "bg-red-500" :
      "bg-[#0055FF]";

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 ${bgColor} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 max-w-md`}
      >
        <span className="text-lg">
          {toast.type === "success" ? "\u2713" : toast.type === "error" ? "\u2717" : "\u24D8"}
        </span>
        <span className="text-sm font-medium">{toast.message}</span>
      </motion.div>
    );
  };

  // ==================== RENDER: Steps ====================

  const renderStepContent = () => {
    const label = STEP_LABELS[currentStep];

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div>
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">{label.title}</h2>
            <p className="text-gray-600">{label.description}</p>
          </div>

          {currentStep === "terms" && renderTermsStep()}
          {currentStep === "verify" && renderVerifyStep()}
          {currentStep === "password" && renderPasswordStep()}
          {currentStep === "nickname" && renderNicknameStep()}
          {currentStep === "profile" && renderProfileStep()}
        </motion.div>
      </AnimatePresence>
    );
  };

  // ---- Terms Agreement ----
  const renderTermsStep = () => (
    <div className="space-y-4">
      {loadingTerms ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#0055FF] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-500">약관 불러오는 중...</span>
        </div>
      ) : (
        <>
          <div className="bg-[#F8F9FA] rounded-2xl p-4 border border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allVisibleTermsAgreed()}
                onChange={(e) => toggleAllTerms(e.target.checked)}
                className="w-5 h-5 text-[#0055FF] rounded focus:ring-[#0055FF] accent-[#0055FF]"
              />
              <span className="font-bold text-gray-800 text-lg">전체 동의하기</span>
            </label>
          </div>

          <div className="space-y-3">
            {visibleTerms.map((term) => {
              const agreement = signupData.termsAgreements.find((a) => a.policyType === term.policyType);
              const koName = TERMS_KO_NAMES[term.policyType] || term.title || term.policyType.replace(/_/g, " ");
              return (
                <div key={term.policyType} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={agreement?.agreed || false}
                      onChange={(e) => toggleTermAgreement(term.policyType, e.target.checked)}
                      className="w-5 h-5 text-[#0055FF] rounded focus:ring-[#0055FF] accent-[#0055FF]"
                    />
                    <span className="text-gray-700">
                      <span className={`text-xs font-bold mr-2 ${term.isRequired ? "text-red-500" : "text-gray-400"}`}>
                        {term.isRequired ? "[필수]" : "[선택]"}
                      </span>
                      {koName}
                    </span>
                  </label>
                  <button
                    onClick={() => handleViewTerms(term)}
                    className="text-sm text-[#0055FF] hover:underline whitespace-nowrap ml-2"
                  >
                    보기
                  </button>
                </div>
              );
            })}
          </div>

          {/* 내부 로직: PRIVACY_PHONE, PRIVACY_PHOTO는 자동 동의 처리됨 (UI 비노출) */}
        </>
      )}

      {/* 약관 상세 모달 (노션 링크가 없는 경우 폴백) */}
      <AnimatePresence>
        {selectedTermsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTermsModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-4">
                {TERMS_KO_NAMES[selectedTermsModal.policyType] || selectedTermsModal.title || selectedTermsModal.policyType.replace(/_/g, " ")}
              </h3>
              <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                {selectedTermsModal.content || "약관 내용을 불러올 수 없습니다."}
              </div>
              <button
                onClick={() => {
                  logUserAction("약관 모달 닫기", { policyType: selectedTermsModal?.policyType });
                  setSelectedTermsModal(null);
                }}
                className="w-full mt-6 bg-[#0055FF] text-white font-bold py-3 rounded-xl hover:bg-opacity-90 transition-all"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ---- Email Verification ----
  const renderVerifyStep = () => (
    <div className="space-y-4">
      <div className="bg-[#F8F9FA] rounded-2xl p-4 text-center">
        <p className="text-gray-700 text-sm">인증 코드를 전송했습니다</p>
        <p className="text-lg font-bold text-[#0055FF]">{signupData.email}</p>
      </div>

      {isVerified ? (
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
          className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">{"\u2713"}</div>
          <p className="text-green-700 font-bold text-lg">이메일 인증 완료!</p>
          <p className="text-green-600 text-sm mt-1">&apos;다음&apos; 버튼을 눌러 진행해주세요.</p>
        </motion.div>
      ) : (
        <>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">인증 코드 (6자리)</label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                disabled={verifyingCode}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0055FF] text-center text-2xl tracking-[0.5em] font-mono text-black placeholder:text-gray-400 disabled:bg-gray-50"
                placeholder="000000"
                autoFocus
              />
              {/* 검증 중 로딩 표시 */}
              {verifyingCode && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-[#0055FF] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {verifyingCode && (
              <p className="text-xs text-[#0055FF] mt-2 text-center">인증 코드 확인 중...</p>
            )}
            <p className="text-xs text-gray-400 mt-2 text-center">6자리 입력 시 자동으로 인증됩니다.</p>
          </div>

          {/* 재발송 Back-off 상태 표시 */}
          {resendBlocked ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
              <p className="text-red-600 text-sm font-medium">
                재발송 횟수를 초과했습니다.
              </p>
              <p className="text-red-500 text-xs mt-1">
                30분 뒤에 다시 시도하거나 고객센터에 문의해주세요.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {countdown > 0 ? (
                  <>
                    남은 시간: <span className="text-[#0055FF] font-bold">
                      {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                    </span>
                  </>
                ) : codeSent ? (
                  <span className="text-gray-400">재발송 가능</span>
                ) : null}
              </span>
              {codeSent && (
                <button
                  onClick={() => handleSendCode(true)}
                  disabled={sendingCode || countdown > 0}
                  className={`font-medium ${
                    countdown > 0 || sendingCode
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-[#0055FF] hover:underline"
                  }`}
                >
                  {sendingCode ? "발송 중..." : `코드 재발송${resendCount > 0 ? ` (${resendCount}/3)` : ""}`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  // ---- Password ----
  const renderPasswordStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-gray-700 font-semibold mb-2">비밀번호</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={signupData.password}
            onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0055FF] transition-colors pr-12 text-black placeholder:text-gray-400"
            placeholder="8자 이상, 영문/숫자/특수문자 포함"
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            type="button"
          >
            {showPassword ? "숨김" : "보기"}
          </button>
        </div>
        {signupData.password && (
          <div className="mt-2">
            <div className="flex gap-1">
              <div className={`h-1.5 flex-1 rounded-full ${
                passwordStrength === "weak" ? "bg-red-400" :
                passwordStrength === "medium" ? "bg-yellow-400" : "bg-green-400"
              }`} />
              <div className={`h-1.5 flex-1 rounded-full ${
                passwordStrength === "medium" ? "bg-yellow-400" :
                passwordStrength === "strong" ? "bg-green-400" : "bg-gray-200"
              }`} />
              <div className={`h-1.5 flex-1 rounded-full ${
                passwordStrength === "strong" ? "bg-green-400" : "bg-gray-200"
              }`} />
            </div>
            <p className={`text-xs mt-1 ${
              passwordStrength === "weak" ? "text-red-500" :
              passwordStrength === "medium" ? "text-yellow-600" : "text-green-600"
            }`}>
              {passwordStrength === "weak" ? "보안 강도: 약함" :
               passwordStrength === "medium" ? "보안 강도: 보통" : "보안 강도: 강함"}
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-gray-700 font-semibold mb-2">비밀번호 확인</label>
        <input
          type={showPassword ? "text" : "password"}
          value={signupData.confirmPassword}
          onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
          className={`w-full px-4 py-3 border rounded-xl focus:outline-none transition-colors text-black placeholder:text-gray-400 ${
            !passwordMatch ? "border-red-400 focus:border-red-400" : "border-gray-200 focus:border-[#0055FF]"
          }`}
          placeholder="비밀번호를 다시 입력해주세요"
        />
        {!passwordMatch && (
          <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
        )}
      </div>

      <p className="text-xs text-gray-400">
        비밀번호는 서버로 바로 전송되지 않으며, 마지막 가입 단계에서 안전하게 처리됩니다.
      </p>
    </div>
  );

  // ---- Nickname ----
  const renderNicknameStep = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-gray-700 font-semibold mb-2">닉네임</label>
        <input
          type="text"
          value={signupData.nickname}
          onChange={(e) => {
            setSignupData((prev) => ({ ...prev, nickname: e.target.value }));
            setNicknameAvailable(null); // 입력 변경 시 초기화
          }}
          maxLength={20}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0055FF] transition-colors text-black placeholder:text-gray-400"
          placeholder="2~20자 닉네임 입력"
        />
      </div>

      {checkingNickname && (
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-[#0055FF] border-t-transparent rounded-full animate-spin inline-block" />
          확인 중...
        </p>
      )}

      {!checkingNickname && nicknameAvailable === true && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
          <span className="text-green-600 font-bold">{"\u2713"}</span>
          <span className="text-green-700 text-sm font-medium">사용 가능한 닉네임입니다.</span>
        </motion.div>
      )}

      {!checkingNickname && nicknameAvailable === false && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-2">
          <span className="text-red-600 font-bold">{"\u2717"}</span>
          <span className="text-red-700 text-sm font-medium">이미 사용 중인 닉네임입니다.</span>
        </motion.div>
      )}

      <p className="text-xs text-gray-400">
        닉네임은 다른 사용자에게 표시됩니다. &apos;다음&apos; 버튼을 누르면 중복 확인이 진행됩니다.
      </p>
    </div>
  );

  // ---- Profile & Submit ----
  const renderProfileStep = () => (
    <div className="space-y-6">
      {/* 프로필 이미지 */}
      <div>
        <label className="block text-gray-700 font-semibold mb-3">프로필 사진 (선택)</label>
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border-4 border-gray-100">
            {signupData.profileImagePreview ? (
              <>
                <img
                  src={signupData.profileImagePreview}
                  alt="프로필 미리보기"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={removeProfileImage}
                  className="absolute top-0 right-0 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                >
                  {"\u2717"}
                </button>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              {signupData.profileImagePreview ? "사진 변경" : "사진 선택"}
            </button>
            <p className="text-xs text-gray-400 mt-2">JPG, PNG, GIF (최대 10MB)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* 정보 요약 */}
      <div className="bg-[#F8F9FA] rounded-2xl p-6 space-y-3 text-sm">
        <h3 className="font-bold text-gray-800 text-base mb-2">가입 정보 확인</h3>
        <div className="flex justify-between">
          <span className="text-gray-500">이메일</span>
          <span className="text-gray-800 font-medium">{signupData.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">이메일 인증</span>
          <span className="text-green-600 font-medium">인증 완료</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">닉네임</span>
          <span className="text-gray-800 font-medium">{signupData.nickname}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">비밀번호 강도</span>
          <span className={`font-medium ${
            passwordStrength === "strong" ? "text-green-600" :
            passwordStrength === "medium" ? "text-yellow-600" : "text-red-500"
          }`}>
            {passwordStrength === "strong" ? "강함" : passwordStrength === "medium" ? "보통" : "약함"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">프로필 사진</span>
          <span className="text-gray-800 font-medium">
            {signupData.profileImageFile ? "설정됨" : "기본 이미지"}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        &apos;가입 완료&apos;를 누르면 입력하신 정보로 회원가입이 진행됩니다.
      </p>
    </div>
  );

  // ==================== MAIN RENDER ====================

  if (!emailFromQuery) {
    return null; // redirect 중
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      {/* Toast */}
      <AnimatePresence>{renderToast()}</AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        {/* Header - 단계 번호 없이 심플하게 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-[#1A1A1A]">회원가입</h1>
            <span className="text-sm text-gray-500">{signupData.email}</span>
          </div>
          {/* 프로그레스 바만 표시 (단계 번호 인디케이터 제거) */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#0055FF]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-[#F8F9FA] rounded-2xl shadow-xl p-8">
          {renderStepContent()}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              disabled={submitting}
              className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 transition-all disabled:opacity-50"
            >
              이전
            </button>
            <button
              onClick={handleNext}
              disabled={
                submitting ||
                checkingNickname ||
                (currentStep === "verify" && !isVerified)
              }
              className="flex-1 bg-[#0055FF] text-white font-bold py-3 rounded-xl hover:bg-opacity-90 transition-all disabled:opacity-50"
            >
              {currentStep === "profile"
                ? submitting ? "가입 처리 중..." : "가입 완료"
                : checkingNickname ? "확인 중..." : "다음"
              }
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== PAGE EXPORT (Suspense 경계) ====================

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#0055FF] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
