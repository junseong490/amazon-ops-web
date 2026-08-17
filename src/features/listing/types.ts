// 리스팅 진단기(Listing Auditor) 도메인 타입 (plan.md §15.2·§15.7).
// SEO=하드 규칙, AEO/GEO=신흥 권장 — 층을 layer로 분리해 UI·점수를 절대 섞지 않는다.

export type Market = 'US' | 'JP';

export interface ListingInput {
  market: Market; // 규칙 테이블(§15.3) 선택 키. 기본 US.
  title: string; // 타이틀 1개
  bullets: string[]; // 불릿(빈 칸 허용, 입력된 것만 검사)
  backendSearchTerms: string; // 백엔드 검색어(원문 그대로 — 정확한 바이트 계산용)
  description?: string; // (선택) 상품 설명 — AEO/GEO에 주로 쓰임
  targetKeywords: string[]; // 사용자가 노리는 목표 키워드
}

export type CheckLayer = 'SEO' | 'AEO';
export type CheckLevel = 'pass' | 'warn' | 'fail' | 'info';

export interface CheckResult {
  id: string; // 'S3','A2' … (같은 체크가 여러 행이면 접미사 부여)
  layer: CheckLayer; // ★ 층 분리 = UI 구분 근거
  level: CheckLevel;
  title: string;
  detail: string; // 구체 수치 포함("249/249B·1B 초과")
  fix?: string; // 다음 행동
}

export interface AuditReport {
  market: Market;
  seo: CheckResult[]; // S1~S6 (S3 최상단 고정)
  aeo: CheckResult[]; // A1~A3 (별도 배열 = 합산 안 함)
  seoScore: number; // SEO만의 요약(0~100)
  aeoScore: number; // AEO/GEO 별도 요약(합산 금지)
}

export interface MarketRule {
  titleMax: number; // 문자 수 한도 (75)
  bulletMax: number; // 불릿 개수 (5)
  bulletCharMin: number; // 불릿 각 하한 (10)
  bulletCharMax: number; // 불릿 각 상한 (255)
  backendByteMax: number; // 백엔드 검색어 UTF-8 바이트 한도 (US 249 / JP 500)
  stuffingTitleMax: number; // 타이틀 내 동일 토큰 허용 반복 상한
  stuffingBulletMax: number; // 전체 불릿 내 동일 토큰 허용 반복 상한
}
