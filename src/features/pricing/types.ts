// 가격·마진 시뮬레이터 도메인 모델 (LOCKED, brief §데이터 모델).
// 통화 혼재 금지: Scenario 하나는 단일 통화로만 계산·표시한다.

/**
 * 비용 항목의 계산 기준.
 * - `per_unit`     : 판매가와 무관한 단위당 절대금액(시나리오 통화 기준).
 * - `pct_of_price` : 판매가의 비율. value=0.15 → 판매가의 15%.
 * - `pct_of_cogs`  : 원가합(COGS)의 비율. value=0.08 → COGS의 8%.
 */
export type CostBasis = 'per_unit' | 'pct_of_price' | 'pct_of_cogs';

export interface CostItem {
  id: string;
  name: string;
  basis: CostBasis;
  /** per_unit=절대금액, pct_*=소수 비율(0.15=15%). */
  value: number;
  /** per_unit 항목만 의미. true면 COGS 합계에 포함(제조·물류 등 원가성). */
  countInCogs?: boolean;
}

export interface Category {
  id: string;
  name: string;
  items: CostItem[];
}

export interface Scenario {
  id: string;
  name: string;
  /** 마켓 라벨(US/JP 등) — 표시용. 계산엔 통화만 쓴다. */
  market: string;
  /** ISO 4217. 시나리오 전체가 이 통화 하나로만 계산된다(혼재 금지). */
  currency: string;
  sellingPrice: number;
  categories: Category[];
}
