// FBM(일본) 전략 — 단일창고 단순 재주문. plan §10.3.
// 3PL 창고 한 곳에서 직접 고객 출고 → 기존 computeInventory를 그대로 승격해 사용.
// (검증 완료된 로직 재사용. primitives 공유로 FBA의 3PL 재주문과 동일 식임을 보장.)

import { computeInventory, type InventoryInput, type InventoryResult } from './reorder';

export type FbmInput = InventoryInput;
export type FbmResult = InventoryResult;

/** FBM 재고 결정(단일창고). currentStock = 3PL 창고 재고. */
export function computeFbm(input: FbmInput, todayMs: number = Date.now()): FbmResult {
  return computeInventory(input, todayMs);
}
