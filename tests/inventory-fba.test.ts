// FBA 2단 모델 + FBM 회귀 유닛테스트 — plan §10.9 T1~T10 + reference §5b 현재고 합산.
// 순수 계산이라 골든 케이스로 결정적 검증. 기존 sales/fixtures는 import 재사용만.
import { describe, expect, it } from 'vitest';
import { computeInventory } from '../src/features/inventory/calc/reorder';
import {
  reorderPoint,
  orderUpToLevel,
  recommendedQty,
  safetyStockFromDays,
} from '../src/features/inventory/calc/primitives';
import { computeFba, currentFbaStock } from '../src/features/inventory/calc/fba';
import { modelForChannel } from '../src/features/inventory/calc/strategy';
import { itemVelocities } from '../src/features/inventory/calc/velocity';
import { parseTsv } from '../src/core/ingest/tsv';
import { parseTable } from '../src/features/sales/parse/parse';
import type { SalesRecord } from '../src/types/domain';
import { US_HEADER, JP_HEADER, makeTsv, usRow, jpRow, type Row } from './fixtures';

function parseRecords(header: string[], rows: Row[]): SalesRecord[] {
  const table = parseTsv(makeTsv(header, rows));
  return parseTable({ table, fileName: 'test.txt', fileId: 'f1', encoding: 'utf-8' }).records;
}

const TODAY = Date.UTC(2026, 7, 16); // 2026-08-16

// 공통 FBA 입력 베이스 — 각 테스트에서 필요한 필드만 오버라이드.
function fba(over: Partial<Parameters<typeof computeFba>[0]>) {
  return computeFba(
    {
      velocity: 5,
      fbaInbound: 0,
      fbaOnHand: 0,
      fbaFcProcessing: 0,
      stock3pl: 0,
      onOrder3pl: 0,
      leadTimeFbaDays: 7,
      leadTimeSupDays: 30,
      reviewDays: 7,
      safetyStockFba: 0,
      safetyStock3pl: 0,
      ...over,
    },
    TODAY,
  );
}

describe('T1 회귀 — primitives 분해 후에도 computeInventory 결과 불변', () => {
  it('primitives 조합 = computeInventory (reorderPoint/target/qty 동일)', () => {
    const input = {
      velocity: 5,
      leadTimeDays: 10,
      currentStock: 40,
      safetyStock: 20,
      reviewDays: 30,
    };
    const r = computeInventory(input, TODAY);
    // 손으로 계산한 프리미티브 값과 일치
    expect(r.reorderPoint).toBe(reorderPoint(5, 10, 20)); // 70
    expect(r.orderUpToLevel).toBe(orderUpToLevel(5, 10, 30, 20)); // 220
    const pos = 40; // currentStock + onOrder(0)
    expect(r.recommendedOrderQty).toBe(recommendedQty(r.orderUpToLevel, pos)); // 180
  });
});

describe('reference §5b — 현재 FBA 재고 = 인바운드 + 보유 + FC처리중', () => {
  it('17 + 240 + 6 = 263, 제외항목(고객주문/조사중/처리불가)은 입력 아님', () => {
    const stock = currentFbaStock({
      fbaInbound: 17,
      fbaOnHand: 240, // 보유 = 사용가능 201 + FC이전 39
      fbaFcProcessing: 6,
    });
    expect(stock).toBe(263);
  });

  it('합계 직접 입력(override) 시 그 값을 현재고로 사용', () => {
    const stock = currentFbaStock({
      fbaInbound: 17,
      fbaOnHand: 240,
      fbaFcProcessing: 6,
      fbaCurrentStockOverride: 300,
    });
    expect(stock).toBe(300);
  });

  it('computeFba가 현재고(263)를 보충 판단 주 기준으로 사용', () => {
    const r = fba({ fbaInbound: 17, fbaOnHand: 240, fbaFcProcessing: 6 });
    expect(r.currentFbaStock).toBe(263);
  });
});

describe('T2 — FBA 보충 재주문점 = v×L_fba + ss_fba', () => {
  it('v=5, L_fba=7, ss_fba=10 → ROP_fba=45', () => {
    const r = fba({ safetyStockFba: 10, fbaOnHand: 40 });
    expect(r.fbaReorderPoint).toBe(45);
  });
  it('현재고 40 ≤ 45 → 보충 필요', () => {
    const r = fba({ safetyStockFba: 10, fbaOnHand: 40 });
    expect(r.needsReplenish).toBe(true);
  });
  it('현재고 50 > 45 → 보충 불필요', () => {
    const r = fba({ safetyStockFba: 10, fbaOnHand: 50 });
    expect(r.needsReplenish).toBe(false);
  });
});

describe('T3 — FBA 목표·권장 보충량', () => {
  it('v=5, L_fba=7, R=7, ss_fba=10 → S_fba=80, 현재고 30 → 권장 50', () => {
    const r = fba({ safetyStockFba: 10, fbaOnHand: 30, stock3pl: 1000 });
    expect(r.fbaTargetLevel).toBe(80); // 5*(7+7)+10
    expect(r.recommendedReplenishQty).toBe(50); // 80 - 30
  });
});

describe('T4 — FBA 보충량 3PL 재고 클램프', () => {
  it('권장 50, stock3pl=20 → 실제 20, 클램프 true, 부족 30', () => {
    const r = fba({ safetyStockFba: 10, fbaOnHand: 30, stock3pl: 20 });
    expect(r.recommendedReplenishQty).toBe(50);
    expect(r.actualReplenishQty).toBe(20);
    expect(r.replenishClampedTo3pl).toBe(true);
    expect(r.replenishShortfall).toBe(30);
  });
  it('3PL 재고 충분하면 클램프 없음', () => {
    const r = fba({ safetyStockFba: 10, fbaOnHand: 30, stock3pl: 500 });
    expect(r.actualReplenishQty).toBe(50);
    expect(r.replenishClampedTo3pl).toBe(false);
    expect(r.replenishShortfall).toBe(0);
  });
});

describe('T5 — 3PL 재주문 포지션에 fbaInbound(in-transit) 미포함 (핵심 함정)', () => {
  it('stock3pl=100, onOrder3pl=0, fbaInbound=50 → 3PL 포지션은 150이 아니라 100', () => {
    const r = fba({ stock3pl: 100, onOrder3pl: 0, fbaInbound: 50 });
    expect(r.threePlPosition).toBe(100); // fbaInbound 미포함
  });
});

describe('T6 — 총 커버리지 이중계상 없음', () => {
  it('available=201, inbound=17, stock3pl=100, v=10 → (201+17+100)/10 = 31.8', () => {
    // 현재고 = 인바운드17 + 보유201(사용가능만, FC이전 0) + FC처리중0 = 218
    const r = fba({
      velocity: 10,
      fbaInbound: 17,
      fbaOnHand: 201,
      fbaFcProcessing: 0,
      fbaAvailable: 201,
      stock3pl: 100,
      onOrder3pl: 0,
    });
    expect(r.currentFbaStock).toBe(218);
    expect(r.totalCoverageDays).toBeCloseTo(31.8, 5); // inbound 1회만
  });
});

describe('T7 — velocity=0 방어', () => {
  it('모든 소진일수 null, 판정 NaN·음수 없음', () => {
    const r = fba({ velocity: 0, fbaOnHand: 100, stock3pl: 100 });
    expect(r.fbaDaysOfSupply).toBeNull();
    expect(r.fbaDaysWithCurrentStock).toBeNull();
    expect(r.totalCoverageDays).toBeNull();
    expect(r.daysUntilReplenish).toBeNull();
    expect(r.daysUntilReorder3pl).toBeNull();
    // ROP=0, 포지션>0 → 재주문/보충 불필요, 수량 0
    expect(Number.isNaN(r.recommendedReplenishQty)).toBe(false);
    expect(r.recommended3plOrderQty).toBe(0);
    expect(r.needsReplenish).toBe(false);
  });
});

describe('T8 — 3PL 발주량 MOQ·로트 반영', () => {
  it('로트 50 → 배수로 올림', () => {
    // v=5, L_sup=30, ss=0 → ROP_3pl=150, S_3pl=5*(30+7)=185
    // 포지션 40 ≤ 150 → 필요, 권장 raw = 185-40 = 145 → 로트50 → 150
    const r = fba({ stock3pl: 40, onOrder3pl: 0, lotSize: 50 });
    expect(r.needsReorder3pl).toBe(true);
    expect(r.recommended3plOrderQty).toBe(150);
  });
  it('MOQ 300 > raw 145 → 300', () => {
    const r = fba({ stock3pl: 40, onOrder3pl: 0, minOrderQty: 300 });
    expect(r.recommended3plOrderQty).toBe(300);
  });
});

describe('T9 — 마켓 → 이행모델 매핑', () => {
  it('Amazon.co.jp → FBM', () => {
    expect(modelForChannel('Amazon.co.jp')).toBe('FBM');
  });
  it('Amazon.com → FBA', () => {
    expect(modelForChannel('Amazon.com')).toBe('FBA');
  });
  it('미지 채널 → fallback', () => {
    expect(modelForChannel('Amazon.de')).toBe('FBM'); // 기본 폴백
    expect(modelForChannel('Amazon.de', 'FBA')).toBe('FBA');
  });
});

describe('T10 — velocity 채널 분리 (매출 재사용, 합산 오염 없음)', () => {
  it('JP·US 혼재 시 channels 필터로 US 판매만 velocity 산출', () => {
    const recs = parseRecords(US_HEADER, [
      usRow({ 'order-item-id': 'U1', sku: 'SKU-X', quantity: '10', 'sales-channel': 'Amazon.com', 'purchase-date': '2026-08-14T18:00:00+00:00' }),
      usRow({ 'order-item-id': 'U2', sku: 'SKU-X', quantity: '20', 'sales-channel': 'Amazon.com', 'purchase-date': '2026-08-15T18:00:00+00:00' }),
    ]);
    const jp = parseRecords(JP_HEADER, [
      jpRow({ 'order-item-id': 'J1', sku: 'SKU-X', quantity: '999', 'sales-channel': 'Amazon.co.jp', 'purchase-date': '2026-08-14T09:00:00+09:00' }),
    ]);
    const all = [...recs, ...jp];
    const usOnly = itemVelocities(all, { channels: ['Amazon.com'] });
    const x = usOnly.find((v) => v.key === 'SKU-X');
    expect(x).toBeDefined();
    expect(x!.totalQty).toBe(30); // JP 999 오염 없음
  });
});

describe('보충 발송 시점 — 언제 보낼지', () => {
  it('현재고가 ROP보다 위면 남은 일수 > 0, 발송 일자 미래', () => {
    // v=5, L_fba=7, ss=10 → ROP=45. 현재고 70 → (70-45)/5 = 5일 후
    const r = fba({ safetyStockFba: 10, fbaOnHand: 70, stock3pl: 500 });
    expect(r.needsReplenish).toBe(false);
    expect(r.daysUntilReplenish).toBeCloseTo(5, 5);
    expect(r.replenishByDate).toBe('2026-08-21'); // 08-16 + 5
  });
  it('현재고 ≤ ROP면 지금(0일) 보내야', () => {
    const r = fba({ safetyStockFba: 10, fbaOnHand: 40, stock3pl: 500 });
    expect(r.needsReplenish).toBe(true);
    expect(r.daysUntilReplenish).toBe(0);
    expect(r.replenishByDate).toBe('2026-08-16');
  });
});

describe('안전재고 — 일수 기반 (기본 방식)', () => {
  it('velocity 5, 14일치 → 70', () => {
    expect(safetyStockFromDays(5, 14)).toBe(70);
  });
});
