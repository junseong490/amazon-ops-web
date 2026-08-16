// 공통 도메인 타입 (정규화 모델 + 집계 결과)
// PII(주소·buyer-*)는 이 모델에 절대 담지 않는다 (brief LOCKED §3, review §1.9).

export type ItemStatusClass = 'shipped' | 'pending' | 'unshipped' | 'cancelled' | 'other';

/**
 * 정규화된 주문 라인 1건. All Orders 리포트의 한 데이터 행 → 한 SalesRecord.
 * item-price는 이미 라인 합계(단가×quantity)다 — revenue = itemPrice, quantity 재곱 금지.
 */
export interface SalesRecord {
  /** order-item-id: 라인 고유키 (dedup 기준) */
  orderItemId: string;
  /** amazon-order-id: 주문 식별자 (orderCount = distinct) */
  amazonOrderId: string;
  /** purchase-date 원문 (tz 포함 ISO8601) */
  purchaseDateRaw: string;
  /** 파싱된 절대 시각 (epoch ms). tz 변환의 입력. */
  purchaseInstantMs: number;
  /** sales-channel (예: Amazon.com, Amazon.co.jp) — 마켓/국가 축 */
  salesChannel: string;
  /** ISO 4217 통화 코드 (혼재 합산 금지) */
  currency: string;
  sku: string;
  asin: string;
  /** 품목 라벨. 디코드 실패 시 sku→asin 폴백 (review §1.4). */
  productName: string;
  /** 품목 라벨이 폴백된 경우 표시 */
  productNameFallback: boolean;
  quantity: number;
  /** 라인 매출 = item-price 그대로 (LOCKED §4) */
  itemPrice: number;
  itemTax: number;
  shippingPrice: number;
  shippingTax: number;
  giftWrapPrice: number;
  giftWrapTax: number;
  itemPromotionDiscount: number;
  shipPromotionDiscount: number;
  orderStatus: string;
  /** 라인 단위 상태. 취소 필터는 이 값 기준 (LOCKED §12). */
  itemStatus: string;
  itemStatusClass: ItemStatusClass;
  fulfillmentChannel: string;
  /** 어느 업로드 배치에서 왔는지 */
  sourceFileId: string;
}

export interface ParseIssue {
  kind: 'skipped-row' | 'label-fallback' | 'unknown-channel' | 'missing-header';
  message: string;
  /** 원본 파일의 데이터 행 번호(1-based, 헤더 제외) 또는 컨텍스트 */
  row?: number;
}

export interface ParseResult {
  records: SalesRecord[];
  issues: ParseIssue[];
  /** 파일 인코딩 결과 (utf-8 | shift_jis) */
  encoding: string;
  fileName: string;
  fileId: string;
  rowCount: number;
  skippedCount: number;
}

/** 매출 정의 모드 */
export type RevenueMode = 'gross' | 'net';

export interface AggregateOptions {
  /** 취소 라인 제외 (기본 true) */
  excludeCancelled: boolean;
  /** 순매출 모드: item-price − item-promotion-discount (LOCKED §7) */
  revenueMode: RevenueMode;
  /** 품목 축: sku | asin (LOCKED §11) */
  itemAxis: 'sku' | 'asin';
  /** 기간 필터 (dateKey 문자열 비교, 마켓 현지 캘린더 일 기준). 포함 경계. */
  dateFrom?: string;
  dateTo?: string;
  /** 선택된 sales-channel (비면 전체) */
  channels?: string[];
  /** 포함할 itemStatusClass (비면 전체, 단 excludeCancelled와 조합) */
  statuses?: ItemStatusClass[];
}

/** 통화별 금액 맵: { USD: 1234.5, JPY: 5000 } */
export type MoneyByCurrency = Record<string, number>;

export interface GroupRow {
  /** groupBy 순서에 맞춘 키 배열 (예: ['2026-08-13','Amazon.com']) */
  keys: string[];
  revenueByCurrency: MoneyByCurrency;
  quantity: number;
  /** distinct amazon-order-id */
  orderCount: number;
  /** 세금·배송·기프트랩 (통화별) — 분리 표시용 */
  taxByCurrency: MoneyByCurrency;
  shippingByCurrency: MoneyByCurrency;
}

export type GroupDim = 'date' | 'channel' | 'item';

export interface AggregateResult {
  groupBy: GroupDim[];
  rows: GroupRow[];
  totals: {
    revenueByCurrency: MoneyByCurrency;
    taxByCurrency: MoneyByCurrency;
    shippingByCurrency: MoneyByCurrency;
    quantity: number;
    /** distinct amazon-order-id (전체) */
    orderCount: number;
    /** AOV = revenue / orderCount, 통화별 */
    aovByCurrency: MoneyByCurrency;
  };
  /** 품목 라벨 조회 (item 축일 때 키=sku/asin → productName) */
  itemLabels?: Record<string, string>;
}
