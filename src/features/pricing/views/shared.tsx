// 가격 뷰 공용 — basis 메타(초보 이해용 라벨·툴팁) + 숫자/퍼센트 파싱·포맷.

import type { CostBasis } from '../types';

export interface BasisMeta {
  value: CostBasis;
  /** 셀렉트 라벨 */
  label: string;
  /** 값 입력 단위 표기 */
  unit: 'money' | 'percent';
  /** 초보용 설명(툴팁/힌트) */
  hint: string;
}

export const BASIS_META: Record<CostBasis, BasisMeta> = {
  per_unit: {
    value: 'per_unit',
    label: '단위당 금액(절대)',
    unit: 'money',
    hint: '판매가와 무관하게 개당 드는 실제 비용. 예: 제조원가·FBA 배송비.',
  },
  pct_of_price: {
    value: 'pct_of_price',
    label: '판매가 %',
    unit: 'percent',
    hint: '판매가에 비례하는 비용. 예: 아마존 판매수수료(15%)·광고비(ACOS).',
  },
  pct_of_cogs: {
    value: 'pct_of_cogs',
    label: '원가(COGS) %',
    unit: 'percent',
    hint: '상품원가 합계에 비례하는 비용. 예: 관세(원가의 8%).',
  },
};

export const BASIS_ORDER: CostBasis[] = ['per_unit', 'pct_of_price', 'pct_of_cogs'];

/** 문자열 입력 → number(빈 값/비정상 0). */
export function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** 소수 자리수 제한 로케일 포맷. */
export function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

/** 비율(0.15) → 퍼센트 문자열('15'). 입력값 채우기용. */
export function toPercentInput(fraction: number): string {
  const p = fraction * 100;
  // 부동소수 잔여(15.000000001) 정리
  return String(Math.round(p * 1e6) / 1e6);
}
