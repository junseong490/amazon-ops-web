// 스키마 매핑 레이어: 헤더 '이름'으로 컬럼을 찾는다 (LOCKED §2, review §1.5).
// 위치 인덱스 금지. 마켓마다 컬럼 수가 다르므로(US B2B/address 추가, JP 없음)
// 필요한 헤더만 집고 여분은 무시한다.

/** 내부 필드 → 리포트 헤더명 후보(별칭 포함). 첫 매칭 우선. */
export const HEADER_ALIASES = {
  orderItemId: ['order-item-id'],
  amazonOrderId: ['amazon-order-id'],
  purchaseDate: ['purchase-date'],
  salesChannel: ['sales-channel'],
  currency: ['currency'],
  sku: ['sku'],
  asin: ['asin'],
  productName: ['product-name'],
  quantity: ['quantity', 'quantity-purchased'],
  itemPrice: ['item-price'],
  itemTax: ['item-tax'],
  shippingPrice: ['shipping-price'],
  shippingTax: ['shipping-tax'],
  giftWrapPrice: ['gift-wrap-price'],
  giftWrapTax: ['gift-wrap-tax'],
  itemPromotionDiscount: ['item-promotion-discount'],
  shipPromotionDiscount: ['ship-promotion-discount'],
  orderStatus: ['order-status'],
  itemStatus: ['item-status'],
  fulfillmentChannel: ['fulfillment-channel'],
} as const;

export type InternalField = keyof typeof HEADER_ALIASES;

/** 정확성/집계에 반드시 필요한 필드 (없으면 파싱 불가로 간주) */
export const REQUIRED_FIELDS: InternalField[] = [
  'amazonOrderId',
  'purchaseDate',
  'salesChannel',
  'currency',
  'sku',
  'itemPrice',
  'itemStatus',
];

export type ColumnMap = Partial<Record<InternalField, number>>;

export interface MappingResult {
  map: ColumnMap;
  missingRequired: InternalField[];
}

/**
 * 헤더 배열 → 내부필드별 컬럼 인덱스 맵.
 * 헤더는 소문자/trim 정규화 후 별칭과 매칭.
 */
export function buildColumnMap(header: string[]): MappingResult {
  const norm = header.map((h) => h.trim().toLowerCase());
  const map: ColumnMap = {};

  (Object.keys(HEADER_ALIASES) as InternalField[]).forEach((field) => {
    const aliases = HEADER_ALIASES[field];
    for (const alias of aliases) {
      const idx = norm.indexOf(alias);
      if (idx !== -1) {
        map[field] = idx;
        break;
      }
    }
  });

  const missingRequired = REQUIRED_FIELDS.filter((f) => map[f] === undefined);
  return { map, missingRequired };
}
