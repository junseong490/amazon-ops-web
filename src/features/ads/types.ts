// 광고(Sponsored Products) 최적화 데이터 모델 — plan §A6 / reference §2~3.
// 순수 계산 계층(aggregate/recommend)은 이 타입만 의존하고 I/O·React는 모른다.

/** SP Campaigns 시트에서 인식하는 Entity 종류. */
export type AdEntity =
  | 'Campaign'
  | 'Ad Group'
  | 'Product Ad'
  | 'Keyword'
  | 'Negative Keyword'
  | 'Product Targeting'
  | 'Negative Product Targeting'
  | 'Bidding Adjustment'
  | 'Other';

/** computeMetrics 출력 — 0분모는 null(무전환/저데이터 방어). */
export interface AdMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  ctr: number | null; // clicks / impressions
  cpc: number | null; // spend / clicks
  cvr: number | null; // orders / clicks
  acos: number | null; // spend / sales  (sales=0 → null = 무전환)
  roas: number | null; // sales / spend
  rpc: number | null; // sales / clicks  (권장 입찰 상한 입력)
}

export type BidFlag =
  | 'keep'
  | 'grow'
  | 'reduce'
  | 'waste'
  | 'negative-candidate'
  | 'low-data'
  | 'no-click'
  | 'floor'
  | 'rpc-cap';

export interface BidParams {
  /** 전역 목표 ACOS(0~1). 기본 0.25(§5c). 행별 override 가능. */
  targetAcos: number;
  /** 이 클릭 수 미만은 저데이터 → 관망(유지). 기본 10. */
  minClicks: number;
  /** 판매 0인데 이 클릭 이상이면 네거티브 후보. 기본 15. */
  zeroSaleClicks: number;
  /** 1회 최대 인상폭(비율). 기본 0.30. */
  maxIncreasePct: number;
  /** 1회 최대 인하폭(비율). 하방 보수적 — 기본 0.15(§5c). */
  maxDecreasePct: number;
  /** 입찰 하한. 이 아래로 내리지 않음. 기본 0.02(USD). */
  bidFloor: number;
  /** 절대 상한(없으면 null → RPC 상한만). */
  bidCeiling: number | null;
  /** RPC×targetAcos 상한 적용. 기본 true. */
  applyRpcCap: boolean;
  /** balanced=상·하 모두 / waste-cut=인하만 / growth=인상 허용. 기본 balanced. */
  strategyMode: 'balanced' | 'waste-cut' | 'growth';
  /** 입찰 반올림 통화(USD 2자리 / JPY 정수). 기본 USD. */
  currency: 'USD' | 'JPY';
}

export interface BidRecommendation {
  newBid: number;
  reason: string;
  flags: BidFlag[];
}

/** SP Campaigns 한 행(원형 보존 + 파생). rowIndex = 스프레드시트 실제 행번호(왕복 키). */
export interface AdRow {
  rowIndex: number;
  entity: AdEntity;
  raw: (string | number | boolean | null)[];
  campaignId?: string;
  adGroupId?: string;
  campaignName?: string;
  adGroupName?: string;
  keywordText?: string;
  matchType?: string;
  targetingExpr?: string;
  currentBid?: number;
  /** Keyword/Product Targeting(비네거티브)만 편집 대상. */
  editable: boolean;
  metrics?: AdMetrics;
}

/** SP Search Term Report 한 행(읽기 전용). */
export interface SearchTermRow {
  campaignId: string;
  adGroupId: string;
  campaignName: string;
  adGroupName: string;
  keywordText: string;
  matchType: string;
  customerSearchTerm: string;
  metrics: AdMetrics;
}

export interface NewKeywordSuggestion {
  customerSearchTerm: string;
  campaignId: string;
  adGroupId: string;
  campaignName: string;
  adGroupName: string;
  recommendedBid: number;
  matchType: 'Exact';
  orders: number;
  acos: number | null;
}

export interface NegativeSuggestion {
  customerSearchTerm: string;
  campaignId: string;
  adGroupId: string;
  campaignName: string;
  adGroupName: string;
  matchType: 'Negative Exact';
  clicks: number;
  spend: number;
}

/** 업로드 워크북 컨텍스트 — 왕복(patch)용 원본 바이트 보관. */
export interface AdWorkbook {
  fileName: string;
  /** 원본 xlsx 바이트(왕복 패치 입력). */
  rawBytes: Uint8Array;
  /** SP Campaigns 편집 대상 시트 이름. */
  spSheetName: string;
  /** SP Campaigns 헤더 컬럼명 → 0-based 인덱스. */
  colIndex: Record<string, number>;
  rows: AdRow[];
  searchTerms: SearchTermRow[];
  /** 파싱 경고(형식 일부 인식 실패 등). */
  warnings: string[];
}
