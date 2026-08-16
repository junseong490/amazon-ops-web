// 원시 테이블 → SalesRecord[] (정규화 + dedup).
// LOCKED §4(revenue=item-price), §12(item-status 라인상태), §13(dedup=order-item-id).

import type { ItemStatusClass, ParseIssue, ParseResult, SalesRecord } from '../../../types/domain';
import type { ColumnMap } from '../../../core/schema/mapping';
import { buildColumnMap } from '../../../core/schema/mapping';
import type { RawTable } from '../../../core/ingest/tsv';

/** 금액 문자열 → number. 통화기호/콤마/공백 제거, 빈값·비수치는 0. */
export function parseAmount(raw: string | undefined): number {
  if (raw == null) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** 수량 문자열 → 정수(>=0). */
export function parseQuantity(raw: string | undefined): number {
  const n = parseAmount(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** item-status 문자열 → 분류. Cancelled 판정에 사용. */
export function classifyStatus(raw: string | undefined): ItemStatusClass {
  const s = (raw || '').trim().toLowerCase();
  if (s === '') return 'other';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('shipped')) return 'shipped';
  if (s.includes('unshipped')) return 'unshipped';
  if (s.includes('pending')) return 'pending';
  return 'other';
}

/** product-name이 유효한 라벨인지 (mojibake/빈값 감지). */
function isBrokenLabel(name: string | undefined): boolean {
  if (name == null) return true;
  const trimmed = name.trim();
  if (trimmed === '') return true;
  if (trimmed.includes('�')) return true; // 치환문자
  return false;
}

function cell(row: string[], map: ColumnMap, field: keyof ColumnMap): string | undefined {
  const idx = map[field];
  if (idx === undefined) return undefined;
  return row[idx];
}

export interface ParseInput {
  table: RawTable;
  fileName: string;
  fileId: string;
  encoding: string;
}

/**
 * 원시 테이블을 정규화 레코드로 변환한다.
 * - 헤더 이름으로 매핑 (위치 인덱스 금지)
 * - order-item-id 기준 dedup (파일 내 중복 라인 제거)
 * - product-name 손상 시 sku→asin 라벨 폴백
 */
export function parseTable(input: ParseInput): ParseResult {
  const { table, fileName, fileId, encoding } = input;
  const { map, missingRequired } = buildColumnMap(table.header);
  const issues: ParseIssue[] = [];

  if (missingRequired.length > 0) {
    issues.push({
      kind: 'missing-header',
      message: `필수 헤더 누락: ${missingRequired.join(', ')}`,
    });
    // 필수 헤더가 없으면 안전하게 빈 결과 반환
    return {
      records: [],
      issues,
      encoding,
      fileName,
      fileId,
      rowCount: table.rows.length,
      skippedCount: table.rows.length,
    };
  }

  const seen = new Set<string>();
  const records: SalesRecord[] = [];
  let skipped = 0;

  table.rows.forEach((row, i) => {
    const rowNum = i + 1;
    const amazonOrderId = (cell(row, map, 'amazonOrderId') || '').trim();
    const sku = (cell(row, map, 'sku') || '').trim();
    const asin = (cell(row, map, 'asin') || '').trim();
    const purchaseDateRaw = (cell(row, map, 'purchaseDate') || '').trim();

    // 최소 식별 정보가 없으면 스킵
    if (amazonOrderId === '' || purchaseDateRaw === '') {
      skipped++;
      issues.push({ kind: 'skipped-row', message: '주문ID/구매일 누락', row: rowNum });
      return;
    }

    const instant = Date.parse(purchaseDateRaw);
    if (!Number.isFinite(instant)) {
      skipped++;
      issues.push({ kind: 'skipped-row', message: `구매일 파싱 실패: ${purchaseDateRaw}`, row: rowNum });
      return;
    }

    // order-item-id: 라인 고유키. 없으면 합성 키 + 경고.
    let orderItemId = (cell(row, map, 'orderItemId') || '').trim();
    if (orderItemId === '') {
      orderItemId = `${amazonOrderId}:${sku}:${rowNum}`;
    }

    // dedup: order-item-id 기준 (같은 파일/재업로드 중복 라인 제거)
    if (seen.has(orderItemId)) {
      return; // 조용히 중복 제거
    }
    seen.add(orderItemId);

    // 라벨 폴백: product-name 손상 시 sku → asin
    const rawName = cell(row, map, 'productName');
    let productName: string;
    let productNameFallback = false;
    if (isBrokenLabel(rawName)) {
      productName = sku || asin || '(unknown)';
      productNameFallback = true;
      issues.push({ kind: 'label-fallback', message: `품목라벨 폴백 → ${productName}`, row: rowNum });
    } else {
      productName = (rawName as string).trim();
    }

    const itemStatus = (cell(row, map, 'itemStatus') || '').trim();

    records.push({
      orderItemId,
      amazonOrderId,
      purchaseDateRaw,
      purchaseInstantMs: instant,
      salesChannel: (cell(row, map, 'salesChannel') || '').trim(),
      currency: (cell(row, map, 'currency') || '').trim().toUpperCase(),
      sku,
      asin,
      productName,
      productNameFallback,
      quantity: parseQuantity(cell(row, map, 'quantity')),
      itemPrice: parseAmount(cell(row, map, 'itemPrice')),
      itemTax: parseAmount(cell(row, map, 'itemTax')),
      shippingPrice: parseAmount(cell(row, map, 'shippingPrice')),
      shippingTax: parseAmount(cell(row, map, 'shippingTax')),
      giftWrapPrice: parseAmount(cell(row, map, 'giftWrapPrice')),
      giftWrapTax: parseAmount(cell(row, map, 'giftWrapTax')),
      itemPromotionDiscount: parseAmount(cell(row, map, 'itemPromotionDiscount')),
      shipPromotionDiscount: parseAmount(cell(row, map, 'shipPromotionDiscount')),
      orderStatus: (cell(row, map, 'orderStatus') || '').trim(),
      itemStatus,
      itemStatusClass: classifyStatus(itemStatus),
      fulfillmentChannel: (cell(row, map, 'fulfillmentChannel') || '').trim(),
      sourceFileId: fileId,
    });
  });

  return {
    records,
    issues,
    encoding,
    fileName,
    fileId,
    rowCount: table.rows.length,
    skippedCount: skipped,
  };
}
