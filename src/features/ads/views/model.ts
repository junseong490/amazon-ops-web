// 뷰 파생 모델 — 키워드 표 한 행의 표시/편집 단위.
import type { AdMetrics, BidFlag } from '../types';

export interface KeywordView {
  rowIndex: number;
  entity: 'Keyword' | 'Product Targeting';
  label: string; // 키워드 텍스트 또는 타겟 표현식
  campaignName: string;
  adGroupName: string;
  matchType: string;
  metrics: AdMetrics;
  currentBid: number;
  effectiveTargetAcos: number;
  recommendedBid: number;
  reason: string;
  flags: BidFlag[];
  userBid: number;
  changed: boolean;
}

export type KeywordFilter =
  | 'all'
  | 'changed'
  | 'reduce'
  | 'grow'
  | 'waste'
  | 'negative-candidate'
  | 'low-data';

export type KeywordSort = 'spend' | 'acos' | 'clicks' | 'sales' | 'cpc';
