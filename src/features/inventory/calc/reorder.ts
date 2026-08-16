// 재고 재주문 계산 — 순수 함수(I/O 없음). 수동 입력만으로 동작.
// 매출 데이터가 없어도 velocity/리드타임/현재고/안전재고만 있으면 계산된다.
// plan §6.2·§10.3(FBM). 공용 식은 calc/primitives.ts로 분해(동작 불변, 회귀 T1).

import {
  DAY_MS,
  dateKeyUtc,
  daysOfSupply as dosPrimitive,
  daysUntil,
  orderUpToLevel as orderUpToLevelPrimitive,
  recommendedQty,
  reorderPoint as reorderPointPrimitive,
  safetyStockFromLeadTime,
} from './primitives';

// 계수 방식 안전재고는 primitives에서 관리하되, 기존 import 경로 호환을 위해 재노출.
export { safetyStockFromLeadTime };

export interface InventoryInput {
  /** 일 평균 판매량 (units/day) */
  velocity: number;
  /** 리드타임 (일) */
  leadTimeDays: number;
  /** 현재 재고 (units) */
  currentStock: number;
  /** 안전재고 (units). 직접 입력 또는 safetyStockFromLeadTime()로 산출. */
  safetyStock: number;
  /** 이미 발주해 입고 대기 중인 수량 (units, 기본 0) */
  onOrder?: number;
  /** 발주 주기 / 목표 커버리지 일수 (일, 기본 0 → 리드타임만 커버) */
  reviewDays?: number;
  /** 발주 로트 배수 (units). 있으면 권장 발주량을 이 배수로 올림. */
  lotSize?: number;
  /** 최소 주문 수량 MOQ (units) */
  minOrderQty?: number;
}

export interface InventoryResult {
  /** 재주문 시점 = velocity×리드타임 + 안전재고 */
  reorderPoint: number;
  /** 소진 예상일수 = 현재고 / velocity (velocity<=0 → null: 무한) */
  daysOfSupply: number | null;
  /** 재주문 시점까지 남은 일수 (velocity<=0 → null, 이미 도달 시 0) */
  daysUntilReorder: number | null;
  /** 소진 예상일자 'YYYY-MM-DD' (velocity<=0 → null) */
  stockoutDate: string | null;
  /** 재고 포지션(현재고+입고대기)이 재주문 시점 이하인가 */
  needsReorder: boolean;
  /** 목표 보충 수준 = velocity×(리드타임+발주주기) + 안전재고 */
  orderUpToLevel: number;
  /** 권장 발주량 (MOQ·로트 반영, 정수 단위) */
  recommendedOrderQty: number;
}

/**
 * 순수 재고 계산(FBM 단일창고). todayMs는 소진 예상일자 산출용(테스트 결정성 위해 주입 가능).
 */
export function computeInventory(input: InventoryInput, todayMs: number = Date.now()): InventoryResult {
  const velocity = Math.max(0, input.velocity || 0);
  const leadTimeDays = Math.max(0, input.leadTimeDays || 0);
  const currentStock = Math.max(0, input.currentStock || 0);
  const safetyStock = Math.max(0, input.safetyStock || 0);
  const onOrder = Math.max(0, input.onOrder || 0);
  const reviewDays = Math.max(0, input.reviewDays || 0);
  const lotSize = input.lotSize && input.lotSize > 0 ? input.lotSize : 0;
  const minOrderQty = Math.max(0, input.minOrderQty || 0);

  const reorderPoint = reorderPointPrimitive(velocity, leadTimeDays, safetyStock);
  const orderUpToLevel = orderUpToLevelPrimitive(velocity, leadTimeDays, reviewDays, safetyStock);
  const position = currentStock + onOrder;
  const needsReorder = position <= reorderPoint;

  const daysOfSupply = dosPrimitive(currentStock, velocity);
  const daysUntilReorder = daysUntil(currentStock, reorderPoint, velocity);
  const stockoutDate =
    daysOfSupply !== null ? dateKeyUtc(todayMs + daysOfSupply * DAY_MS) : null;

  const recommendedOrderQty = needsReorder
    ? recommendedQty(orderUpToLevel, position, minOrderQty, lotSize)
    : 0;

  return {
    reorderPoint,
    daysOfSupply,
    daysUntilReorder,
    stockoutDate,
    needsReorder,
    orderUpToLevel,
    recommendedOrderQty,
  };
}
