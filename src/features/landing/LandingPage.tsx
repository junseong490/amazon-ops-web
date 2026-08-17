// 랜딩페이지 — 실험(experiment/video-hero): 풀스크린 배경 비디오 히어로.
// 구조·기법은 참고 프롬프트에서 가져오되(비디오 히어로 + 알약 네비 + ShinyText + CTA),
// 콘텐츠는 전부 우리 실제 제품("Amazon 셀러 콘솔") 정본 카피로 채운다.
// 표시 계층만 — 로직 불변. 진입 라우트(/)로, CTA를 눌러야 대시보드(/sales)로 들어간다.
// Tailwind 유틸리티는 이 랜딩 파일에만 스코프됨(tailwind.config content). preflight 비활성.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ShinyText } from './ShinyText';

// 사용자 제공(유효성 확인됨) 배경 영상.
const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4';

// 알약 네비 링크 — 실제 대시보드 라우트.
const NAV_LINKS: { to: string; label: string }[] = [
  { to: '/sales', label: '매출' },
  { to: '/ads', label: '광고' },
  { to: '/inventory', label: '재고' },
  { to: '/pricing', label: '가격·마진' },
  { to: '/listing', label: '리스팅 진단' },
];

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  // prefers-reduced-motion: reduce → 자동재생 억제(정지 프레임 유지).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduceMotion) v.pause();
  }, [reduceMotion]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black font-sans text-white">
      {/* 풀스크린 배경 비디오 */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={VIDEO_SRC}
        autoPlay={!reduceMotion}
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      {/* 대비 확보용 다크 오버레이(상·하 그라디언트 + 전체 톤다운) */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

      {/* 콘텐츠 레이어 */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* 알약형 네비게이션 */}
        <header className="flex justify-center px-4 pt-6 sm:pt-8">
          <nav
            className="flex w-full max-w-4xl items-center justify-between gap-4 rounded-full border border-white/15 bg-white/5 px-3 py-2 backdrop-blur-md sm:px-4"
            aria-label="주요 메뉴"
          >
            <Link to="/" className="flex items-center gap-2.5 pl-1" aria-label="홈으로">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-gradient-to-br from-[#64CEFB]/30 to-white/10 text-sm font-semibold">
                A
              </span>
              <span className="hidden text-sm font-semibold tracking-tight text-white sm:inline">
                Amazon 셀러 콘솔
              </span>
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-full px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <Link
              to="/sales"
              className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-white/85"
            >
              시작하기
            </Link>
          </nav>
        </header>

        {/* 히어로 */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm sm:text-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#64CEFB]" aria-hidden="true" />
            아마존 셀러를 위한 운영 콘솔
          </motion.span>

          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl"
          >
            매출·광고·재고·마진을
            <br />
            <ShinyText>한 화면</ShinyText>
            <span className="text-white">에서 관리하세요</span>
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg"
          >
            미국(FBA)·일본(FBM) 두 마켓을 오가며 엑셀과 리포트를 뒤지지 마세요. 업로드 한 번이면 국가별
            매출, 광고 최적화, 재고 발주 시점, 마진까지 자동으로 계산됩니다.
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-10"
          >
            <Link
              to="/sales"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-black shadow-lg shadow-black/20 transition-transform hover:scale-[1.02]"
            >
              무료로 시작하기
              <ArrowRight
                className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
