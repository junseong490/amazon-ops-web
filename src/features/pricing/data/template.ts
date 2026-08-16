// 초보 아마존 셀러용 기본 비용 템플릿(brief §기본 비용 템플릿).
// 값은 모두 예시 — 사용자가 편집·삭제·추가한다. 전부 편집 가능.

import { uid } from '../calc/scenario';
import type { Scenario } from '../types';

/** 새 시나리오 기본값. 판매가·통화·5개 카테고리(예시값) 포함. */
export function defaultScenario(): Scenario {
  return {
    id: uid('scn'),
    name: '기본 시나리오',
    market: 'US',
    currency: 'USD',
    sellingPrice: 25,
    categories: [
      {
        id: uid('cat'),
        name: '상품원가',
        items: [
          { id: uid('item'), name: '제조원가', basis: 'per_unit', value: 8, countInCogs: true },
          { id: uid('item'), name: '국내물류', basis: 'per_unit', value: 1, countInCogs: true },
        ],
      },
      {
        id: uid('cat'),
        name: '수출·물류',
        items: [
          { id: uid('item'), name: '국제운송', basis: 'per_unit', value: 2, countInCogs: true },
          // 관세: 원가(COGS) 대비 비율. per_unit 절대금액으로 바꿔도 됨.
          { id: uid('item'), name: '관세', basis: 'pct_of_cogs', value: 0.08 },
        ],
      },
      {
        id: uid('cat'),
        name: '아마존 수수료',
        items: [
          { id: uid('item'), name: '판매수수료(referral)', basis: 'pct_of_price', value: 0.15 },
          { id: uid('item'), name: 'FBA 배송비', basis: 'per_unit', value: 4 },
          { id: uid('item'), name: '월 보관료', basis: 'per_unit', value: 0.3 },
        ],
      },
      {
        id: uid('cat'),
        name: '마케팅',
        items: [
          // 광고비: ACOS 개념(판매가 대비 광고비 비율).
          { id: uid('item'), name: '광고비(ACOS)', basis: 'pct_of_price', value: 0.25 },
        ],
      },
      {
        id: uid('cat'),
        name: '기타',
        items: [
          { id: uid('item'), name: '반품·기타 충당', basis: 'pct_of_price', value: 0.02 },
        ],
      },
    ],
  };
}
