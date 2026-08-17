/** @type {import('tailwindcss').Config} */
// 실험(experiment/video-hero) 한정 도입. 랜딩 히어로 전용으로만 스코프한다.
// content를 랜딩 파일로 한정 → 대시보드(macOS 스타일, index.css 기반)에는
// 유틸리티 클래스가 생성되지 않아 전역 충돌이 없다.
// preflight(base reset) 비활성화 → 기존 index.css의 리셋/토큰을 그대로 보존한다.
export default {
  content: ['./src/features/landing/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        shine: {
          base: '#64CEFB',
          hi: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
