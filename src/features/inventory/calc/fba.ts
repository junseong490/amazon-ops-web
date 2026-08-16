// FBA(미국) 2단 계산 — 3PL 창고 → FBA 창고 보충 + 공급사 → 3PL 재주문. plan §10.4.
// 순수 함수(I/O 없음). 하나의 결과 객체에 두 결정(FBA 보충 / 3PL 재주문)을 담는다.
//
// ★ FBA 현재고 정의는 reference §5b가 정본(plan §10 "사용가능만" 가정을 덮어씀):
//   현재 FBA 재고 = 인바운드 + 보유(사용가능+FC이전) + 주문처리센터 처리중.
//   고객주문·스테이징·조사중·처리불가는 제외(참고 표시만). 이 현재고가 보충 시점 판단의 주 기준.
// ★ in-transit 이중계상 방지(plan §10.5): 인바운드는 FBA 현재고에만 포함,
//   3PL 포지션(stock3pl + onOrder3pl)에는 넣지 않는다.

import {
  DAY_MS,
  dateKeyUtc,
  daysOfSupply,
  daysUntil,
  orderUpToLevel,
  recommendedQty,
  reorderPoint,
} from './primitives';

export interface FbaInput {
  /** 일 평균 판매량 (US 채널 판매속도) */
  velocity: number;

  // --- FBA 현재고 구성요소 (reference §5b) — 자동 합산되어 현재고가 된다 ---
  /** 인바운드 (배송 중, in-transit). FBA 쪽에만 계상. */
  fbaInbound: number;
  /** 보유 = 사용 가능 + 주문처리센터 이전 (둘 다 현재고 포함) */
  fbaOnHand: number;
  /** 예약됨 > 주문처리센터 처리 중 */
  fbaFcProcessing: number;
  /**
   * (선택) 현재고 합계 직접 입력. 지정 시 위 3요소 합산 대신 이 값을 현재고로 사용.
   */
  fbaCurrentStockOverride?: number;
  /**
   * (선택·보조지표) 사용 가능(available)만. 즉시 품절일수 계산용. 미지정 시 보유값 사용.
   */
  fbaAvailable?: number;

  // --- 3PL 창고 ---
  /** 3PL 창고 보유(배송 중 제외 — 이미 3PL을 떠난 인바운드는 미포함) */
  stock3pl: number;
  /** 공급사에 발주해 3PL 입고 대기 */
  onOrder3pl: number;

  // --- 리드타임 / 검토주기 (전부 UI 입력값) ---
  /** L_fba: 3PL → FBA 리드타임 (일) */
  leadTimeFbaDays: number;
  /** L_sup: 공급사 → 3PL 리드타임 (일) */
  leadTimeSupDays: number;
  /** R: 검토주기 (일) */
  reviewDays: number;

  // --- 안전재고 (fba/3pl 각각 units) ---
  safetyStockFba: number;
  safetyStock3pl: number;

  // --- 발주 반올림 (3PL 재주문에 적용) ---
  lotSize?: number;
  minOrderQty?: number;
}

export interface FbaResult {
  velocity: number;

  // FBA 보충 (3PL → FBA)
  /** 현재 FBA 재고 (§5b 합산: 인바운드 + 보유 + FC처리중) — 보충 판단 주 기준 */
  currentFbaStock: number;
  /** FBA 보충 재주문점 = v × L_fba + ss_fba */
  fbaReorderPoint: number;
  /** 현재고 ≤ ROP_fba → 보충 필요 */
  needsReplenish: boolean;
  /** FBA 목표 수준 = v × (L_fba + R) + ss_fba */
  fbaTargetLevel: number;
  /** 권장 보충량 = max(0, 목표 − 현재고) (정수 올림) */
  recommendedReplenishQty: number;
  /** 실제 보충 가능량 = min(권장, stock3pl) (3PL 재고 상한 클램프) */
  actualReplenishQty: number;
  /** 3PL 재고 부족으로 클램프됐나 */
  replenishClampedTo3pl: boolean;
  /** 3PL 부족으로 못 보내는 수량 = 권장 − 실제 */
  replenishShortfall: number;
  /** 언제 보내야 하나 — ROP까지 남은 일수 (0 = 지금 보내야) */
  daysUntilReplenish: number | null;
  /** 보충 발송 권장 일자 'YYYY-MM-DD' */
  replenishByDate: string | null;

  // 3PL 재주문 (공급사 → 3PL)
  /** 3PL 포지션 = stock3pl + onOrder3pl (★ fbaInbound 미포함) */
  threePlPosition: number;
  /** 3PL 재주문점 = v × L_sup + ss_3pl */
  threePlReorderPoint: number;
  /** 포지션 ≤ ROP_3pl → 재주문 필요 */
  needsReorder3pl: boolean;
  /** 3PL 목표 수준 = v × (L_sup + R) + ss_3pl */
  threePlTargetLevel: number;
  /** 3PL 권장 발주량 (MOQ·로트 반영) */
  recommended3plOrderQty: number;
  /** 3PL 재주문점까지 남은 일수 (0 = 지금) */
  daysUntilReorder3pl: number | null;

  // 예측
  /** FBA 품절 예상일수 = 사용가능 / v (가장 보수적) */
  fbaDaysOfSupply: number | null;
  /** 현재고 기준 소진일수 = 현재고 / v */
  fbaDaysWithCurrentStock: number | null;
  /** 총 커버리지 = (현재고 + stock3pl + onOrder3pl) / v — in-transit 정확히 1회만 계상 */
  totalCoverageDays: number | null;
}

/** FBA 현재고 합산(§5b): 인바운드 + 보유 + FC처리중. override 있으면 그 값. */
export function currentFbaStock(input: {
  fbaInbound: number;
  fbaOnHand: number;
  fbaFcProcessing: number;
  fbaCurrentStockOverride?: number;
}): number {
  if (input.fbaCurrentStockOverride !== undefined && input.fbaCurrentStockOverride !== null) {
    return Math.max(0, input.fbaCurrentStockOverride);
  }
  return (
    Math.max(0, input.fbaInbound) +
    Math.max(0, input.fbaOnHand) +
    Math.max(0, input.fbaFcProcessing)
  );
}

/**
 * FBA 2단 계산. todayMs는 발송 권장 일자 산출용(테스트 결정성 위해 주입).
 */
export function computeFba(input: FbaInput, todayMs: number = Date.now()): FbaResult {
  const v = Math.max(0, input.velocity || 0);
  const fbaInbound = Math.max(0, input.fbaInbound || 0);
  const fbaOnHand = Math.max(0, input.fbaOnHand || 0);
  const fbaFcProcessing = Math.max(0, input.fbaFcProcessing || 0);
  const stock3pl = Math.max(0, input.stock3pl || 0);
  const onOrder3pl = Math.max(0, input.onOrder3pl || 0);
  const lFba = Math.max(0, input.leadTimeFbaDays || 0);
  const lSup = Math.max(0, input.leadTimeSupDays || 0);
  const review = Math.max(0, input.reviewDays || 0);
  const ssFba = Math.max(0, input.safetyStockFba || 0);
  const ss3pl = Math.max(0, input.safetyStock3pl || 0);
  const lotSize = input.lotSize && input.lotSize > 0 ? input.lotSize : 0;
  const minOrderQty = Math.max(0, input.minOrderQty || 0);

  // 사용 가능(available): 보조 품절지표용. 미지정 시 보유값으로 폴백.
  const fbaAvailable =
    input.fbaAvailable !== undefined && input.fbaAvailable !== null
      ? Math.max(0, input.fbaAvailable)
      : fbaOnHand;

  // ── FBA 보충 결정 ──
  const stock = currentFbaStock({
    fbaInbound,
    fbaOnHand,
    fbaFcProcessing,
    fbaCurrentStockOverride: input.fbaCurrentStockOverride,
  });
  const fbaReorderPoint = reorderPoint(v, lFba, ssFba);
  const needsReplenish = stock <= fbaReorderPoint;
  const fbaTargetLevel = orderUpToLevel(v, lFba, review, ssFba);
  const recommendedReplenishQty = Math.ceil(Math.max(0, fbaTargetLevel - stock));
  const actualReplenishQty = Math.min(recommendedReplenishQty, stock3pl);
  const replenishClampedTo3pl = recommendedReplenishQty > stock3pl;
  const replenishShortfall = Math.max(0, recommendedReplenishQty - actualReplenishQty);
  const daysUntilReplenish = daysUntil(stock, fbaReorderPoint, v);
  const replenishByDate =
    daysUntilReplenish !== null
      ? dateKeyUtc(todayMs + daysUntilReplenish * DAY_MS)
      : null;

  // ── 3PL 재주문 결정 (★ inbound 미포함) ──
  const threePlPosition = stock3pl + onOrder3pl;
  const threePlReorderPoint = reorderPoint(v, lSup, ss3pl);
  const needsReorder3pl = threePlPosition <= threePlReorderPoint;
  const threePlTargetLevel = orderUpToLevel(v, lSup, review, ss3pl);
  const recommended3plOrderQty = needsReorder3pl
    ? recommendedQty(threePlTargetLevel, threePlPosition, minOrderQty, lotSize)
    : 0;
  const daysUntilReorder3pl = daysUntil(threePlPosition, threePlReorderPoint, v);

  // ── 예측 ──
  const fbaDaysOfSupply = daysOfSupply(fbaAvailable, v);
  const fbaDaysWithCurrentStock = daysOfSupply(stock, v);
  // 총 커버리지: 현재고(인바운드 이미 포함) + 3PL 포지션. in-transit 정확히 1회.
  const totalCoverageDays = daysOfSupply(stock + threePlPosition, v);

  return {
    velocity: v,
    currentFbaStock: stock,
    fbaReorderPoint,
    needsReplenish,
    fbaTargetLevel,
    recommendedReplenishQty,
    actualReplenishQty,
    replenishClampedTo3pl,
    replenishShortfall,
    daysUntilReplenish,
    replenishByDate,
    threePlPosition,
    threePlReorderPoint,
    needsReorder3pl,
    threePlTargetLevel,
    recommended3plOrderQty,
    daysUntilReorder3pl,
    fbaDaysOfSupply,
    fbaDaysWithCurrentStock,
    totalCoverageDays,
  };
}
