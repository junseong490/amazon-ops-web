// 공용 재고 계산 프리미티브 — 순수 함수(I/O·React 없음). plan §10.2.
// FBM(단일창고)과 FBA(2단)가 "같은 식"을 공유함을 코드로 보장하기 위해
// 기존 reorder.ts 로직을 여기로 분해·추출한다. 동작은 불변(테스트 T1 회귀).

export const DAY_MS = 24 * 60 * 60 * 1000;

/** 재주문점 ROP = velocity × 리드타임 + 안전재고. */
export function reorderPoint(velocity: number, leadTimeDays: number, safetyStock: number): number {
  return Math.max(0, velocity) * Math.max(0, leadTimeDays) + Math.max(0, safetyStock);
}

/** 목표 보충 수준 = velocity × (리드타임 + 검토주기) + 안전재고. */
export function orderUpToLevel(
  velocity: number,
  leadTimeDays: number,
  reviewDays: number,
  safetyStock: number,
): number {
  return (
    Math.max(0, velocity) * (Math.max(0, leadTimeDays) + Math.max(0, reviewDays)) +
    Math.max(0, safetyStock)
  );
}

/** 소진 예상일수 = 재고 / velocity. velocity ≤ 0 → null(무한). */
export function daysOfSupply(stock: number, velocity: number): number | null {
  return velocity > 0 ? Math.max(0, stock) / velocity : null;
}

/** 어느 값이 임계선까지 남은 일수 = (value − threshold)/velocity, 0으로 클램프. v≤0 → null. */
export function daysUntil(value: number, threshold: number, velocity: number): number | null {
  return velocity > 0 ? Math.max(0, (value - threshold) / velocity) : null;
}

/**
 * 권장 발주/보충량 = max(0, target − position)에 MOQ·로트 반영.
 * qty>0일 때만 MOQ 상향·로트 배수 올림. 그 외 정수 올림.
 */
export function recommendedQty(
  target: number,
  position: number,
  minOrderQty = 0,
  lotSize = 0,
): number {
  let qty = Math.max(0, target - position);
  if (qty > 0) {
    if (minOrderQty > 0 && qty < minOrderQty) qty = minOrderQty;
    qty = lotSize > 0 ? Math.ceil(qty / lotSize) * lotSize : Math.ceil(qty);
  }
  return qty;
}

/** 안전재고 — 일수 기반: velocity × 일수(예: 14일치). */
export function safetyStockFromDays(velocity: number, days: number): number {
  return Math.max(0, velocity) * Math.max(0, days);
}

/** 안전재고 — 계수 방식: 리드타임 × velocity × 계수. */
export function safetyStockFromLeadTime(
  velocity: number,
  leadTimeDays: number,
  factor: number,
): number {
  return Math.max(0, velocity) * Math.max(0, leadTimeDays) * Math.max(0, factor);
}

/** epoch ms → 'YYYY-MM-DD' (UTC 기준, 표시 일자). */
export function dateKeyUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
