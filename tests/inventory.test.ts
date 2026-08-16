// 재고 계산기 유닛테스트 — 순수 계산(reorder) + 매출 연동 velocity.
// 기존 sales.test.ts/fixtures.ts는 수정하지 않고 import 재사용만 한다.
import { describe, expect, it } from 'vitest';
import {
  computeInventory,
  safetyStockFromLeadTime,
} from '../src/features/inventory/calc/reorder';
import { itemVelocities } from '../src/features/inventory/calc/velocity';
import { parseTsv } from '../src/core/ingest/tsv';
import { parseTable } from '../src/features/sales/parse/parse';
import type { SalesRecord } from '../src/types/domain';
import { US_HEADER, makeTsv, usRow, type Row } from './fixtures';

function parseRecords(header: string[], rows: Row[]): SalesRecord[] {
  const table = parseTsv(makeTsv(header, rows));
  return parseTable({ table, fileName: 'test.txt', fileId: 'f1', encoding: 'utf-8' }).records;
}

// 결정적 테스트를 위한 고정 '오늘'
const TODAY = Date.UTC(2026, 7, 16); // 2026-08-16

describe('1. 재주문 시점 = velocity×리드타임 + 안전재고', () => {
  it('velocity 5, 리드타임 10, 안전재고 20 → 70', () => {
    const r = computeInventory(
      { velocity: 5, leadTimeDays: 10, currentStock: 100, safetyStock: 20 },
      TODAY,
    );
    expect(r.reorderPoint).toBeCloseTo(70, 5);
  });
});

describe('2. 소진 예상일수·일자 = 현재고 / velocity', () => {
  it('현재고 100, velocity 5 → 20일, 소진일자 = 오늘+20일', () => {
    const r = computeInventory(
      { velocity: 5, leadTimeDays: 10, currentStock: 100, safetyStock: 20 },
      TODAY,
    );
    expect(r.daysOfSupply).toBeCloseTo(20, 5);
    expect(r.stockoutDate).toBe('2026-09-05'); // 08-16 + 20일
  });

  it('velocity 0 → 소진일수/일자 null(무한), 재주문 필요', () => {
    const r = computeInventory(
      { velocity: 0, leadTimeDays: 10, currentStock: 100, safetyStock: 20 },
      TODAY,
    );
    expect(r.daysOfSupply).toBeNull();
    expect(r.stockoutDate).toBeNull();
    expect(r.daysUntilReorder).toBeNull();
    // reorderPoint=20, 포지션 100 > 20 → 재주문 불필요
    expect(r.needsReorder).toBe(false);
  });
});

describe('3. needsReorder = (현재고+입고대기) <= 재주문시점', () => {
  it('현재고 60, 재주문시점 70 → 재주문 필요', () => {
    const r = computeInventory(
      { velocity: 5, leadTimeDays: 10, currentStock: 60, safetyStock: 20 },
      TODAY,
    );
    expect(r.reorderPoint).toBeCloseTo(70, 5);
    expect(r.needsReorder).toBe(true);
  });

  it('입고대기 30 반영 시 포지션 90 > 70 → 재주문 불필요', () => {
    const r = computeInventory(
      { velocity: 5, leadTimeDays: 10, currentStock: 60, safetyStock: 20, onOrder: 30 },
      TODAY,
    );
    expect(r.needsReorder).toBe(false);
    expect(r.recommendedOrderQty).toBe(0);
  });
});

describe('4. 재주문 시점까지 남은 일수', () => {
  it('현재고 100, 재주문시점 70, velocity 5 → (100-70)/5 = 6일', () => {
    const r = computeInventory(
      { velocity: 5, leadTimeDays: 10, currentStock: 100, safetyStock: 20 },
      TODAY,
    );
    expect(r.daysUntilReorder).toBeCloseTo(6, 5);
  });

  it('이미 재주문 시점 이하면 0으로 클램프', () => {
    const r = computeInventory(
      { velocity: 5, leadTimeDays: 10, currentStock: 50, safetyStock: 20 },
      TODAY,
    );
    expect(r.daysUntilReorder).toBe(0);
  });
});

describe('5. 권장 발주량 = 목표보충수준 − 포지션 (발주주기 반영)', () => {
  it('velocity 5, 리드 10, 안전 20, 현재고 40, 발주주기 30 → 목표 270, 발주 230', () => {
    const r = computeInventory(
      {
        velocity: 5,
        leadTimeDays: 10,
        currentStock: 40,
        safetyStock: 20,
        reviewDays: 30,
      },
      TODAY,
    );
    // orderUpTo = 5*(10+30)+20 = 220? -> 5*40=200 +20 = 220
    expect(r.orderUpToLevel).toBeCloseTo(220, 5);
    // qty = 220 - 40 = 180
    expect(r.recommendedOrderQty).toBe(180);
  });
});

describe('6. MOQ·로트 반올림', () => {
  it('원 발주량 180, 로트 50 → 200으로 올림', () => {
    const r = computeInventory(
      {
        velocity: 5,
        leadTimeDays: 10,
        currentStock: 40,
        safetyStock: 20,
        reviewDays: 30,
        lotSize: 50,
      },
      TODAY,
    );
    expect(r.recommendedOrderQty).toBe(200); // ceil(180/50)*50
  });

  it('MOQ 300 > 원 발주량 180 → 300', () => {
    const r = computeInventory(
      {
        velocity: 5,
        leadTimeDays: 10,
        currentStock: 40,
        safetyStock: 20,
        reviewDays: 30,
        minOrderQty: 300,
      },
      TODAY,
    );
    expect(r.recommendedOrderQty).toBe(300);
  });

  it('소수 발주량은 정수 단위로 올림', () => {
    const r = computeInventory(
      { velocity: 3, leadTimeDays: 7, currentStock: 5, safetyStock: 4, reviewDays: 14 },
      TODAY,
    );
    // orderUpTo = 3*21+4 = 67, qty = 67-5 = 62 (정수)
    expect(Number.isInteger(r.recommendedOrderQty)).toBe(true);
    expect(r.recommendedOrderQty).toBe(62);
  });
});

describe('7. 안전재고 = 리드타임×velocity×계수', () => {
  it('velocity 5, 리드 10, 계수 0.5 → 25', () => {
    expect(safetyStockFromLeadTime(5, 10, 0.5)).toBeCloseTo(25, 5);
  });
});

describe('8. 매출 연동 velocity — sales/aggregate 재사용', () => {
  it('SKU-A 이틀간 총 30개 → 일 평균 15', () => {
    const recs = parseRecords(US_HEADER, [
      usRow({ 'order-item-id': 'A1', sku: 'SKU-A', quantity: '20', 'purchase-date': '2026-08-14T18:00:00+00:00' }),
      usRow({ 'order-item-id': 'A2', sku: 'SKU-A', quantity: '10', 'purchase-date': '2026-08-15T18:00:00+00:00' }),
    ]);
    const vs = itemVelocities(recs);
    const a = vs.find((v) => v.key === 'SKU-A');
    expect(a).toBeDefined();
    expect(a!.totalQty).toBe(30);
    expect(a!.days).toBe(2);
    expect(a!.velocity).toBeCloseTo(15, 5);
  });

  it('빈 레코드 → 빈 배열', () => {
    expect(itemVelocities([])).toEqual([]);
  });
});
