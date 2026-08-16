// 검색어 리포트 → 신규 키워드·네거티브 후보(순수) — plan §A4 + §5c.
// 이미 등록된 키워드/네거티브와 대조해 중복 제거. 제안만 생성(반영은 사용자 선택).
import type {
  NegativeSuggestion,
  NewKeywordSuggestion,
  SearchTermRow,
} from '../types';
import { roundBid } from './bid';

export interface SuggestParams {
  targetAcos: number;
  /** 네거티브 후보 판정 클릭 임계. 기본 15. */
  negativeCandidateClicks: number;
  /** 신규 키워드 최소 주문 수. 기본 1. */
  minOrders: number;
  currency: 'USD' | 'JPY';
}

export const DEFAULT_SUGGEST_PARAMS: SuggestParams = {
  targetAcos: 0.25,
  negativeCandidateClicks: 15,
  minOrders: 1,
  currency: 'USD',
};

export interface SuggestInput {
  searchTerms: SearchTermRow[];
  /** 이미 (positive) 키워드로 등록된 텍스트(소문자). */
  registeredKeywords: Set<string>;
  /** 이미 네거티브로 등록된 텍스트(소문자). */
  registeredNegatives: Set<string>;
}

export interface SuggestResult {
  newKeywords: NewKeywordSuggestion[];
  negatives: NegativeSuggestion[];
}

const norm = (s: string) => s.trim().toLowerCase();

export function suggestFromSearchTerms(
  input: SuggestInput,
  params: SuggestParams,
): SuggestResult {
  const newKeywords: NewKeywordSuggestion[] = [];
  const negatives: NegativeSuggestion[] = [];
  const seenNew = new Set<string>();
  const seenNeg = new Set<string>();

  for (const st of input.searchTerms) {
    const term = st.customerSearchTerm?.trim();
    if (!term) continue;
    const key = norm(term);
    const m = st.metrics;

    // 신규 키워드 후보: 고효율(주문 있음 + ACOS ≤ 목표) & 미등록.
    if (
      m.orders >= params.minOrders &&
      m.acos != null &&
      m.acos <= params.targetAcos &&
      !input.registeredKeywords.has(key) &&
      !seenNew.has(key)
    ) {
      seenNew.add(key);
      const rpc = m.rpc ?? 0;
      newKeywords.push({
        customerSearchTerm: term,
        campaignId: st.campaignId,
        adGroupId: st.adGroupId,
        campaignName: st.campaignName,
        adGroupName: st.adGroupName,
        recommendedBid: roundBid(Math.max(rpc * params.targetAcos, 0.02), params.currency),
        matchType: 'Exact',
        orders: m.orders,
        acos: m.acos,
      });
      continue;
    }

    // 네거티브 후보: 무전환 다클릭 & 미등록.
    if (
      m.orders === 0 &&
      m.clicks >= params.negativeCandidateClicks &&
      !input.registeredNegatives.has(key) &&
      !seenNeg.has(key)
    ) {
      seenNeg.add(key);
      negatives.push({
        customerSearchTerm: term,
        campaignId: st.campaignId,
        adGroupId: st.adGroupId,
        campaignName: st.campaignName,
        adGroupName: st.adGroupName,
        matchType: 'Negative Exact',
        clicks: m.clicks,
        spend: m.spend,
      });
    }
  }

  return { newKeywords, negatives };
}
