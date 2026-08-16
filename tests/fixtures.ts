// 합성 테스트 픽스처 — 실제 셀러 데이터가 아니라 확정 스키마를 본뜬 가짜 행.
// US 리포트는 상위집합(B2B/address 컬럼 포함), JP는 그 부분집합.

/** US All Orders 헤더 (상위집합). reference-order-report-schema.md 기준. */
export const US_HEADER = [
  'amazon-order-id', 'merchant-order-id', 'purchase-date', 'last-updated-date',
  'order-status', 'fulfillment-channel', 'sales-channel', 'order-channel', 'url',
  'ship-service-level', 'product-name', 'sku', 'asin', 'item-status', 'quantity',
  'currency', 'item-price', 'item-tax', 'shipping-price', 'shipping-tax',
  'gift-wrap-price', 'gift-wrap-tax', 'item-promotion-discount', 'ship-promotion-discount',
  'address-type', 'ship-city', 'ship-state', 'ship-postal-code', 'ship-country',
  'promotion-ids',
  'is-business-order', 'purchase-order-number', 'price-designation', 'buyer-company-name',
  'signature-confirmation-recommended', 'buyer-identification-number', 'buyer-identification-type',
  'order-item-id',
];

/** JP 헤더 = US에서 address-type 및 B2B 블록 제거 (컬럼 수가 다름). */
export const JP_HEADER = US_HEADER.filter(
  (h) =>
    ![
      'address-type',
      'is-business-order',
      'purchase-order-number',
      'price-designation',
      'buyer-company-name',
      'signature-confirmation-recommended',
      'buyer-identification-number',
      'buyer-identification-type',
    ].includes(h),
);

export type Row = Record<string, string>;

/** 헤더 순서에 맞춰 한 행을 만든다. 누락 필드는 빈 문자열. */
export function rowToLine(header: string[], row: Row): string {
  return header.map((h) => row[h] ?? '').join('\t');
}

/** header + rows → TSV 문자열. */
export function makeTsv(header: string[], rows: Row[]): string {
  return [header.join('\t'), ...rows.map((r) => rowToLine(header, r))].join('\n');
}

/** 문자열/바이트 조각을 이어붙여 Uint8Array 생성 (인코딩 테스트용). */
export function buildBytes(parts: Array<string | Uint8Array>): Uint8Array {
  const enc = new TextEncoder();
  const chunks = parts.map((p) => (typeof p === 'string' ? enc.encode(p) : p));
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** 기본값이 채워진 US 행. overrides로 개별 필드 지정. */
export function usRow(overrides: Row): Row {
  return {
    'amazon-order-id': '111-0000000-0000001',
    'purchase-date': '2026-08-14T12:00:00+00:00',
    'order-status': 'Shipped',
    'fulfillment-channel': 'Amazon',
    'sales-channel': 'Amazon.com',
    'product-name': 'Test Product',
    'sku': 'SKU-US-1',
    'asin': 'B000000001',
    'item-status': 'Shipped',
    'quantity': '1',
    'currency': 'USD',
    'item-price': '10.00',
    'item-tax': '0.00',
    'shipping-price': '0.00',
    'shipping-tax': '0.00',
    'gift-wrap-price': '0.00',
    'gift-wrap-tax': '0.00',
    'item-promotion-discount': '0.00',
    'ship-promotion-discount': '0.00',
    'is-business-order': 'false',
    'order-item-id': 'OII-US-1',
    ...overrides,
  };
}

/** 기본값이 채워진 JP 행. */
export function jpRow(overrides: Row): Row {
  return {
    'amazon-order-id': '222-0000000-0000001',
    'purchase-date': '2026-08-14T09:00:00+09:00',
    'order-status': 'Shipped',
    'fulfillment-channel': 'Amazon',
    'sales-channel': 'Amazon.co.jp',
    'product-name': 'テスト商品',
    'sku': 'SKU-JP-1',
    'asin': 'B000000JP1',
    'item-status': 'Shipped',
    'quantity': '1',
    'currency': 'JPY',
    'item-price': '1000',
    'item-tax': '0',
    'shipping-price': '0',
    'shipping-tax': '0',
    'gift-wrap-price': '0',
    'gift-wrap-tax': '0',
    'item-promotion-discount': '0',
    'ship-promotion-discount': '0',
    'order-item-id': 'OII-JP-1',
    ...overrides,
  };
}
