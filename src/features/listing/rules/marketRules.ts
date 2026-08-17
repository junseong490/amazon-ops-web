// 마켓별 규칙 테이블 (plan.md §15.3).
// ★ "마켓 추가·수치 업데이트는 이 파일만 고친다" — 데이터=코드 분리(§15.7).
//
// ⚠️ 출처 신뢰도: 셀러 커뮤니티 블로그 + Seller Central 공지 언급 혼합.
//    1차 공식 아님. 2026년 8월 기준 · 아마존 정책 변경 잦음 · 주기적 재확인 권장.
//    (백엔드 검색어는 바이트(UTF-8) 한도이며 1바이트만 넘어도 필드 전체가 조용히 비인덱싱.)
import type { Market, MarketRule } from '../types';

export const MARKET_RULES: Record<Market, MarketRule> = {
  US: {
    titleMax: 75,
    bulletMax: 5,
    bulletCharMin: 10,
    bulletCharMax: 255,
    backendByteMax: 249,
    stuffingTitleMax: 2,
    stuffingBulletMax: 4,
  },
  JP: {
    titleMax: 75,
    bulletMax: 5,
    bulletCharMin: 10,
    bulletCharMax: 255,
    backendByteMax: 500,
    stuffingTitleMax: 2,
    stuffingBulletMax: 4,
  },
};

export const MARKET_LABEL: Record<Market, string> = {
  US: '미국 (US)',
  JP: '일본 (JP)',
};

// UI 상시 노출 배너 문구 (규칙 테이블 신뢰도 라벨).
export const RULES_DISCLAIMER = '2026년 8월 기준 · 아마존 정책 변경 잦음 · 주기적 재확인 권장';
