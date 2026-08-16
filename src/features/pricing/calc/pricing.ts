// 가격·마진 순수 계산(brief §계산). React·I/O 없음.
// 경계 안전: NaN/Infinity를 만들지 않고, 불가능한 경우 null로 명확히 표시한다.

import type { CostBasis, CostItem, Scenario } from '../types';

/** 유한수만 통과, 그 외(NaN/Infinity/undefined)는 0으로. */
function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * COGS(원가합) = per_unit 항목 중 countInCogs:true 값들의 합.
 * pct_of_cogs 항목은 정의상 COGS에 포함하지 않는다(순환 방지).
 */
export function cogs(scenario: Scenario): number {
  let sum = 0;
  for (const cat of scenario.categories) {
    for (const item of cat.items) {
      if (item.basis === 'per_unit' && item.countInCogs) sum += safe(item.value);
    }
  }
  return sum;
}

/** 항목 1개를 단위당 금액으로 환산. price·cogsVal은 미리 계산해 넘긴다. */
export function resolveItem(item: CostItem, price: number, cogsVal: number): number {
  const value = safe(item.value);
  switch (item.basis) {
    case 'per_unit':
      return value;
    case 'pct_of_price':
      return safe(price) * value;
    case 'pct_of_cogs':
      return safe(cogsVal) * value;
    default:
      return 0;
  }
}

/** 특정 basis들의 항목만 순회하며 합. */
function sumByBasis(scenario: Scenario, bases: CostBasis[], price: number, cogsVal: number): number {
  let sum = 0;
  for (const cat of scenario.categories) {
    for (const item of cat.items) {
      if (bases.includes(item.basis)) sum += resolveItem(item, price, cogsVal);
    }
  }
  return sum;
}

export interface CategorySubtotal {
  id: string;
  name: string;
  /** 이 카테고리 항목들의 단위당 비용 합. */
  subtotal: number;
}

export interface PricingResult {
  currency: string;
  price: number;
  cogs: number;
  /** 판매가에 비례하지 않는 고정 단위비용(per_unit + pct_of_cogs 환산분). */
  fixedTotal: number;
  /** pct_of_price 비율들의 합(소수). 0.42 = 판매가의 42%. */
  pctOfPriceTotal: number;
  /** 총 단위당 비용. */
  costPerUnit: number;
  /** 단위당 순이익 = 판매가 − 총비용. */
  netProfit: number;
  /** 마진율 = 순이익 / 판매가. 판매가 ≤ 0 이면 null. */
  marginRate: number | null;
  /** 손익분기 판매가 = fixedTotal / (1 − pctOfPriceTotal). pct합 ≥ 1이면 null(불가). */
  breakevenPrice: number | null;
  /** ROI = 순이익 / COGS. COGS ≤ 0 이면 null. */
  roi: number | null;
  categorySubtotals: CategorySubtotal[];
}

/** 시나리오 전체를 계산해 결과 지표를 반환(모든 경계 안전 처리 포함). */
export function compute(scenario: Scenario): PricingResult {
  const price = safe(scenario.sellingPrice);
  const cogsVal = cogs(scenario);

  const fixedTotal = sumByBasis(scenario, ['per_unit', 'pct_of_cogs'], price, cogsVal);
  const pctOfPriceTotal = sumByBasis(scenario, ['pct_of_price'], 1, cogsVal); // price=1 → 비율 합
  const costPerUnit = fixedTotal + price * pctOfPriceTotal;
  const netProfit = price - costPerUnit;

  const marginRate = price > 0 ? netProfit / price : null;
  const breakevenPrice = pctOfPriceTotal < 1 ? fixedTotal / (1 - pctOfPriceTotal) : null;
  const roi = cogsVal > 0 ? netProfit / cogsVal : null;

  const categorySubtotals: CategorySubtotal[] = scenario.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    subtotal: cat.items.reduce((acc, item) => acc + resolveItem(item, price, cogsVal), 0),
  }));

  return {
    currency: scenario.currency,
    price,
    cogs: cogsVal,
    fixedTotal,
    pctOfPriceTotal,
    costPerUnit,
    netProfit,
    marginRate,
    breakevenPrice,
    roi,
    categorySubtotals,
  };
}
