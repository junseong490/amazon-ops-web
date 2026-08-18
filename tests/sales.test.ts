// 정확성 유닛테스트 — brief 요청사항 7의 8개 지점을 커버.
import { describe, expect, it } from 'vitest';
import { parseTsv } from '../src/core/ingest/tsv';
import { decodeBytes } from '../src/core/ingest/decode';
import { parseTable } from '../src/features/sales/parse/parse';
import { ingestOne } from '../src/features/sales/parse/pipeline';
import { aggregate } from '../src/features/sales/aggregate/aggregate';
import { buildDailyItemPivot } from '../src/features/sales/aggregate/pivot';
import type { SalesRecord } from '../src/types/domain';
import {
  JP_HEADER,
  US_HEADER,
  buildBytes,
  jpRow,
  makeTsv,
  usRow,
  type Row,
} from './fixtures';

/** header + rows → 정규화 레코드[] (텍스트 경로). */
function parseRecords(header: string[], rows: Row[]): SalesRecord[] {
  const table = parseTsv(makeTsv(header, rows));
  return parseTable({ table, fileName: 'test.txt', fileId: 'f1', encoding: 'utf-8' }).records;
}

describe('1. item-price는 라인 합계 — quantity로 재곱하지 않는다 (LOCKED §4)', () => {
  it('수량 3, item-price 35.98 → 매출 35.98 (107.94 아님)', () => {
    const recs = parseRecords(US_HEADER, [
      usRow({ quantity: '3', 'item-price': '35.98', 'order-item-id': 'OII-1' }),
    ]);
    const agg = aggregate(recs, ['channel']);
    expect(agg.totals.revenueByCurrency.USD).toBeCloseTo(35.98, 5);
    expect(agg.totals.quantity).toBe(3);
  });
});

describe('2. tz 버킷 — 마켓 현지시각 캘린더 일 (LOCKED §9)', () => {
  it('US UTC 심야 2026-08-14T05:50Z → America/Los_Angeles 기준 08-13', () => {
    const recs = parseRecords(US_HEADER, [
      usRow({ 'purchase-date': '2026-08-14T05:50:00+00:00', 'order-item-id': 'OII-2' }),
    ]);
    const agg = aggregate(recs, ['date']);
    expect(agg.rows).toHaveLength(1);
    expect(agg.rows[0].keys[0]).toBe('2026-08-13');
  });

  it('JP 2026-08-14T09:00+09:00 → Asia/Tokyo 기준 08-14', () => {
    const recs = parseRecords(JP_HEADER, [
      jpRow({ 'purchase-date': '2026-08-14T09:00:00+09:00', 'order-item-id': 'OII-3' }),
    ]);
    const agg = aggregate(recs, ['date']);
    expect(agg.rows[0].keys[0]).toBe('2026-08-14');
  });
});

describe('3. orderCount = distinct amazon-order-id (LOCKED §14)', () => {
  it('멀티라인 주문 1건 → orderCount 1, AOV=매출/1', () => {
    const recs = parseRecords(US_HEADER, [
      usRow({ 'amazon-order-id': 'ORD-A', 'order-item-id': 'L1', 'item-price': '10.00' }),
      usRow({ 'amazon-order-id': 'ORD-A', 'order-item-id': 'L2', 'item-price': '20.00', sku: 'SKU-2' }),
    ]);
    const agg = aggregate(recs, ['channel']);
    expect(agg.totals.orderCount).toBe(1);
    expect(agg.totals.revenueByCurrency.USD).toBeCloseTo(30.0, 5);
    expect(agg.totals.aovByCurrency.USD).toBeCloseTo(30.0, 5);
  });
});

describe('4. item-status=Cancelled 라인 매출 제외 — 부분취소 (LOCKED §12)', () => {
  it('한 주문 내 Shipped+Cancelled → 취소 라인 제외, 주문은 유지', () => {
    const rows = [
      usRow({ 'amazon-order-id': 'ORD-B', 'order-item-id': 'S1', 'item-status': 'Shipped', 'item-price': '10.00' }),
      usRow({ 'amazon-order-id': 'ORD-B', 'order-item-id': 'C1', 'item-status': 'Cancelled', 'item-price': '99.00', sku: 'SKU-C' }),
    ];
    const recs = parseRecords(US_HEADER, rows);
    const excluded = aggregate(recs, ['channel'], { excludeCancelled: true });
    expect(excluded.totals.revenueByCurrency.USD).toBeCloseTo(10.0, 5);
    expect(excluded.totals.orderCount).toBe(1);

    const included = aggregate(recs, ['channel'], { excludeCancelled: false });
    expect(included.totals.revenueByCurrency.USD).toBeCloseTo(109.0, 5);
  });
});

describe('5. 통화 혼재 합산 금지 — USD/JPY 분리 (LOCKED §8)', () => {
  it('USD + JPY → revenueByCurrency 분리, 합쳐진 단일 값 없음', () => {
    const recs = [
      ...parseRecords(US_HEADER, [usRow({ 'order-item-id': 'U1', 'item-price': '10.00' })]),
      ...parseRecords(JP_HEADER, [jpRow({ 'order-item-id': 'J1', 'item-price': '1000' })]),
    ];
    const agg = aggregate(recs, ['channel']);
    expect(agg.totals.revenueByCurrency).toEqual({ USD: 10, JPY: 1000 });
    // 통화 키가 정확히 2개 — 혼합 합산이 없다
    expect(Object.keys(agg.totals.revenueByCurrency).sort()).toEqual(['JPY', 'USD']);
  });
});

describe('6. dedup = order-item-id (LOCKED §13)', () => {
  it('동일 order-item-id 중복 라인 → 1건만 집계', () => {
    const recs = parseRecords(US_HEADER, [
      usRow({ 'order-item-id': 'DUP', 'item-price': '10.00' }),
      usRow({ 'order-item-id': 'DUP', 'item-price': '10.00' }),
    ]);
    expect(recs).toHaveLength(1);
    const agg = aggregate(recs, ['channel']);
    expect(agg.totals.revenueByCurrency.USD).toBeCloseTo(10.0, 5);
  });
});

describe('7. 헤더 이름 매핑 — US/JP 컬럼 수 상이 둘 다 파싱 (LOCKED §2)', () => {
  it('US(상위집합)와 JP(부분집합) 모두 이름으로 정확히 매핑', () => {
    const us = parseRecords(US_HEADER, [
      usRow({ 'order-item-id': 'U1', asin: 'B00USASIN', currency: 'USD', 'sales-channel': 'Amazon.com' }),
    ]);
    const jp = parseRecords(JP_HEADER, [
      jpRow({ 'order-item-id': 'J1', asin: 'B00JPASIN', currency: 'JPY', 'sales-channel': 'Amazon.co.jp' }),
    ]);
    expect(US_HEADER.length).not.toBe(JP_HEADER.length); // 컬럼 수가 다름
    expect(us[0].asin).toBe('B00USASIN');
    expect(us[0].currency).toBe('USD');
    expect(us[0].salesChannel).toBe('Amazon.com');
    // 위치 인덱스였다면 US 뒤쪽 B2B/address 컬럼 때문에 order-item-id가 어긋났을 것
    expect(us[0].orderItemId).toBe('U1');
    expect(jp[0].asin).toBe('B00JPASIN');
    expect(jp[0].currency).toBe('JPY');
    expect(jp[0].salesChannel).toBe('Amazon.co.jp');
  });
});

describe('8. 인코딩 폴백 (LOCKED §3)', () => {
  it('decode: 잘못된 UTF-8(Shift_JIS 바이트) → shift_jis로 폴백, ASCII 컬럼 정상', () => {
    // 0x81 0x40 = Shift_JIS 전각 공백 (UTF-8로는 불법 시퀀스)
    const bytes = buildBytes(['SKU-1\tUSD\t', new Uint8Array([0x81, 0x40]), '\t10.00']);
    const { text, encoding } = decodeBytes(bytes);
    expect(encoding).toBe('shift_jis');
    expect(text).toContain('SKU-1'); // ASCII 컬럼은 인코딩과 무관하게 정상
    expect(text).toContain('USD');
    expect(text).not.toContain('�');
  });

  it('parse: product-name 깨진 행(U+FFFD) → SKU 라벨 폴백, 집계는 정상', () => {
    const recs = parseRecords(US_HEADER, [
      usRow({
        'product-name': '���',
        sku: 'SKU-BROKEN',
        'item-price': '20.00',
        'order-item-id': 'BRK1',
      }),
    ]);
    expect(recs).toHaveLength(1);
    expect(recs[0].productNameFallback).toBe(true);
    expect(recs[0].productName).toBe('SKU-BROKEN'); // 라벨만 SKU로 폴백
    const agg = aggregate(recs, ['item']);
    expect(agg.totals.revenueByCurrency.USD).toBeCloseTo(20.0, 5); // 집계 정상
    expect(agg.itemLabels?.['SKU-BROKEN']).toBe('SKU-BROKEN');
  });
});

describe('9. 일별×품목별 그룹핑 — 날짜+품목 조합별 수량 분리 (byDateItem)', () => {
  it('같은 날 다른 품목 2개 / 같은 품목 다른 날 2개 → 조합별로 수량이 섞이지 않는다', () => {
    const recs = parseRecords(US_HEADER, [
      // 08-14: SKU-A 2개, SKU-B 5개
      usRow({ 'purchase-date': '2026-08-14T18:00:00+00:00', sku: 'SKU-A', quantity: '2', 'item-price': '10.00', 'order-item-id': 'D1' }),
      usRow({ 'purchase-date': '2026-08-14T18:00:00+00:00', sku: 'SKU-B', quantity: '5', 'item-price': '20.00', 'order-item-id': 'D2' }),
      // 08-15: SKU-A 3개 (같은 품목이 다른 날)
      usRow({ 'purchase-date': '2026-08-15T18:00:00+00:00', sku: 'SKU-A', quantity: '3', 'item-price': '10.00', 'order-item-id': 'D3' }),
    ]);
    const agg = aggregate(recs, ['date', 'item']);
    // 3개의 (날짜,품목) 조합
    expect(agg.rows).toHaveLength(3);
    const find = (date: string, item: string) =>
      agg.rows.find((r) => r.keys[0] === date && r.keys[1] === item);
    // 전체 기간 합산이 아니라 날짜별로 분리 — SKU-A는 08-14/08-15가 별개 행
    expect(find('2026-08-14', 'SKU-A')?.quantity).toBe(2);
    expect(find('2026-08-15', 'SKU-A')?.quantity).toBe(3);
    expect(find('2026-08-14', 'SKU-B')?.quantity).toBe(5);
    // 08-15에 SKU-B는 없다
    expect(find('2026-08-15', 'SKU-B')).toBeUndefined();
    // keys 순서는 [dateKey, itemKey]
    expect(agg.rows[0].keys.length).toBe(2);
    // 품목 라벨이 채워진다 (groupBy에 'item' 포함)
    expect(agg.itemLabels?.['SKU-A']).toBeDefined();
  });
});

describe('10. 일별 품목별 피벗 — 날짜×SKU, 누락 셀 빈칸, 월 합계 2행 (buildDailyItemPivot)', () => {
  // 08월: SKU-A(08-14 2개·08-15 3개), SKU-B(08-14 2개, 08-15 없음)
  // 09월: SKU-B 1개 (SKU-A 없음) — 월 합계가 전체 기간이 아니라 월별로 갈리는지 검증
  const recs = parseRecords(US_HEADER, [
    usRow({ 'purchase-date': '2026-08-14T18:00:00+00:00', sku: 'SKU-A', quantity: '2', 'item-price': '29.98', 'order-item-id': 'D1' }),
    usRow({ 'purchase-date': '2026-08-14T18:00:00+00:00', sku: 'SKU-B', quantity: '2', 'item-price': '20.00', 'order-item-id': 'D2' }),
    usRow({ 'purchase-date': '2026-08-15T18:00:00+00:00', sku: 'SKU-A', quantity: '3', 'item-price': '45.00', 'order-item-id': 'D3' }),
    usRow({ 'purchase-date': '2026-09-02T18:00:00+00:00', sku: 'SKU-B', quantity: '1', 'item-price': '10.00', 'order-item-id': 'D4' }),
  ]);
  const byDate = aggregate(recs, ['date']);
  const byItem = aggregate(recs, ['item']);
  const byDateItem = aggregate(recs, ['date', 'item']);
  // 매출 내림차순 컬럼: SKU-A(74.98) > SKU-B(30.00)
  const itemColumns = [...byItem.rows]
    .sort((a, b) => (b.revenueByCurrency.USD || 0) - (a.revenueByCurrency.USD || 0))
    .map((r) => r.keys[0]);
  const sections = buildDailyItemPivot(byDate.rows, byDateItem.rows, itemColumns);

  it('컬럼은 매출 내림차순, 월별로 섹션이 나뉜다', () => {
    expect(itemColumns).toEqual(['SKU-A', 'SKU-B']);
    expect(sections.map((s) => s.month)).toEqual(['2026-08', '2026-09']);
  });

  it('셀: 매칭된 (날짜,품목)은 수량, 안 팔린 조합은 null(빈 칸)', () => {
    const aug = sections[0];
    expect(aug.rows.map((r) => r.dateKey)).toEqual(['2026-08-14', '2026-08-15']);
    // 08-14: SKU-A 2, SKU-B 2
    expect(aug.rows[0].cells).toEqual([2, 2]);
    // 08-15: SKU-A 3, SKU-B 없음 → null
    expect(aug.rows[1].cells).toEqual([3, null]);
    // 09-02: SKU-A 없음 → null, SKU-B 1
    expect(sections[1].rows[0].cells).toEqual([null, 1]);
  });

  it('일 매출액·총 판매수량(행별)', () => {
    const aug = sections[0];
    expect(aug.rows[0].dailyQty).toBe(4); // 2 + 2
    expect(aug.rows[0].dailyRevenue.USD).toBeCloseTo(49.98, 5); // 29.98 + 20.00
    expect(aug.rows[1].dailyQty).toBe(3);
    expect(aug.rows[1].dailyRevenue.USD).toBeCloseTo(45.0, 5);
  });

  it('월 판매량 행 — 총합·품목별 수량이 그 달 범위로만 합산', () => {
    const aug = sections[0];
    expect(aug.totalQty).toBe(7); // 4 + 3
    expect(aug.itemQty['SKU-A']).toBe(5); // 2 + 3
    expect(aug.itemQty['SKU-B']).toBe(2); // 08-14만
    const sep = sections[1];
    expect(sep.totalQty).toBe(1);
    expect(sep.itemQty['SKU-A']).toBe(0); // 9월엔 SKU-A 미판매 → 0
    expect(sep.itemQty['SKU-B']).toBe(1);
  });

  it('월 매출액 행 — 총합·품목별 매출이 그 달 범위로만 합산(전체 기간 아님)', () => {
    const aug = sections[0];
    expect(aug.totalRevenue.USD).toBeCloseTo(94.98, 5); // 49.98 + 45.00
    expect(aug.itemRevenue['SKU-A'].USD).toBeCloseTo(74.98, 5); // 29.98 + 45.00
    expect(aug.itemRevenue['SKU-B'].USD).toBeCloseTo(20.0, 5); // 08-14만
    const sep = sections[1];
    expect(sep.totalRevenue.USD).toBeCloseTo(10.0, 5);
    expect(sep.itemRevenue['SKU-B'].USD).toBeCloseTo(10.0, 5);
    // SKU-B 월 매출이 전체 기간(30)이 아니라 월별(20/10)로 분리됐다
    expect(sep.itemRevenue['SKU-A']).toEqual({}); // 9월 SKU-A 매출 없음 → 빈 맵
  });
});

describe('보강: 파이프라인 바이트 경로 + 세금/배송 분리 (LOCKED §6)', () => {
  it('ingestOne: 바이트 → 레코드, 세금·배송이 매출과 분리 집계', () => {
    const tsv = makeTsv(US_HEADER, [
      usRow({ 'order-item-id': 'P1', 'item-price': '10.00', 'item-tax': '1.50', 'shipping-price': '3.00' }),
    ]);
    const bytes = buildBytes([tsv]);
    const res = ingestOne({ name: 'orders.txt', bytes });
    expect(res.records).toHaveLength(1);
    const agg = aggregate(res.records, ['channel']);
    expect(agg.totals.revenueByCurrency.USD).toBeCloseTo(10.0, 5); // 세·배송 미포함
    expect(agg.totals.taxByCurrency.USD).toBeCloseTo(1.5, 5);
    expect(agg.totals.shippingByCurrency.USD).toBeCloseTo(3.0, 5);
  });
});
