// 가격·마진 시뮬레이터 유닛테스트 — 순수 계산 + 시나리오 CRUD 헬퍼.
// 기존 코어/테스트는 수정하지 않고 신규 pricing 모듈만 검증한다.
import { describe, expect, it } from 'vitest';
import { compute, cogs, resolveItem } from '../src/features/pricing/calc/pricing';
import {
  addCategory,
  addItem,
  removeCategory,
  removeItem,
  updateItem,
} from '../src/features/pricing/calc/scenario';
import { defaultScenario } from '../src/features/pricing/data/template';
import type { Scenario } from '../src/features/pricing/types';

function scn(partial: Partial<Scenario> & Pick<Scenario, 'categories'>): Scenario {
  return {
    id: 's1',
    name: 't',
    market: 'US',
    currency: 'USD',
    sellingPrice: 100,
    ...partial,
  };
}

describe('1. 총비용 = per_unit + pct_of_price 혼합', () => {
  const s = scn({
    sellingPrice: 100,
    categories: [
      {
        id: 'c1',
        name: '원가',
        items: [
          { id: 'i1', name: '제조', basis: 'per_unit', value: 20, countInCogs: true },
          { id: 'i2', name: '수수료', basis: 'pct_of_price', value: 0.15 },
        ],
      },
    ],
  });

  it('총비용 = 20 + 100×0.15 = 35', () => {
    expect(compute(s).costPerUnit).toBeCloseTo(35, 6);
  });
  it('순이익 = 100 − 35 = 65, 마진율 = 0.65', () => {
    const r = compute(s);
    expect(r.netProfit).toBeCloseTo(65, 6);
    expect(r.marginRate).toBeCloseTo(0.65, 6);
  });
});

describe('2. 손익분기 = fixed / (1 − pct)', () => {
  it('fixed 20, pct 0.15 → 20/0.85 ≈ 23.5294', () => {
    const s = scn({
      categories: [
        {
          id: 'c1',
          name: 'x',
          items: [
            { id: 'i1', name: '고정', basis: 'per_unit', value: 20 },
            { id: 'i2', name: '비율', basis: 'pct_of_price', value: 0.15 },
          ],
        },
      ],
    });
    expect(compute(s).breakevenPrice).toBeCloseTo(20 / 0.85, 6);
  });

  it('pct 합 ≥ 100% → 손익분기 불가(null)', () => {
    const s = scn({
      categories: [
        {
          id: 'c1',
          name: 'x',
          items: [
            { id: 'i1', name: '수수료', basis: 'pct_of_price', value: 0.6 },
            { id: 'i2', name: '광고', basis: 'pct_of_price', value: 0.4 },
          ],
        },
      ],
    });
    const r = compute(s);
    expect(r.pctOfPriceTotal).toBeCloseTo(1.0, 6);
    expect(r.breakevenPrice).toBeNull();
  });
});

describe('3. pct_of_cogs — COGS 합산 + 순환 없음', () => {
  const s = scn({
    categories: [
      {
        id: 'c1',
        name: '원가',
        items: [
          { id: 'i1', name: '제조', basis: 'per_unit', value: 8, countInCogs: true },
          { id: 'i2', name: '운송', basis: 'per_unit', value: 2, countInCogs: true },
          { id: 'i3', name: 'FBA', basis: 'per_unit', value: 4 }, // countInCogs 아님
          { id: 'i4', name: '관세', basis: 'pct_of_cogs', value: 0.08 },
        ],
      },
    ],
  });

  it('COGS = countInCogs per_unit 합만(8+2=10), pct_of_cogs·비원가 per_unit 제외', () => {
    expect(cogs(s)).toBeCloseTo(10, 6);
  });
  it('관세 = COGS×0.08 = 0.8 (관세 자신은 COGS에 미포함 → 순환 없음)', () => {
    const item = s.categories[0].items[3];
    expect(resolveItem(item, s.sellingPrice, cogs(s))).toBeCloseTo(0.8, 6);
  });
  it('총비용 = 8+2+4+0.8 = 14.8', () => {
    expect(compute(s).costPerUnit).toBeCloseTo(14.8, 6);
  });
});

describe('4. 통화 단일 — 시나리오 통화 하나로만', () => {
  it('결과 통화 = 시나리오 통화, 기본 템플릿은 단일 통화', () => {
    const d = defaultScenario();
    expect(compute(d).currency).toBe(d.currency);
    expect(d.currency).toBe('USD');
    // 항목엔 통화 필드가 없다(통화 혼재 불가능 구조).
    for (const c of d.categories)
      for (const it of c.items) expect('currency' in it).toBe(false);
  });
});

describe('5. 카테고리/항목 add·remove 반영', () => {
  it('항목 추가 시 총비용 증가, 삭제 시 원복', () => {
    const base = scn({
      categories: [{ id: 'c1', name: 'x', items: [{ id: 'i1', name: 'a', basis: 'per_unit', value: 10 }] }],
    });
    expect(compute(base).costPerUnit).toBeCloseTo(10, 6);

    const added = addItem(base, 'c1', { name: 'b', basis: 'per_unit', value: 5 });
    expect(compute(added).costPerUnit).toBeCloseTo(15, 6);

    const newItemId = added.categories[0].items[1].id;
    const removed = removeItem(added, 'c1', newItemId);
    expect(compute(removed).costPerUnit).toBeCloseTo(10, 6);
  });

  it('카테고리 add/remove + updateItem 값 변경 반영', () => {
    let s = scn({ categories: [] });
    s = addCategory(s, '신규');
    const catId = s.categories[0].id;
    s = addItem(s, catId, { basis: 'per_unit', value: 7 });
    expect(compute(s).costPerUnit).toBeCloseTo(7, 6);

    const itemId = s.categories[0].items[0].id;
    s = updateItem(s, catId, itemId, { value: 12 });
    expect(compute(s).costPerUnit).toBeCloseTo(12, 6);

    s = removeCategory(s, catId);
    expect(s.categories).toHaveLength(0);
    expect(compute(s).costPerUnit).toBeCloseTo(0, 6);
  });
});

describe('6. 경계 안전 — NaN/Infinity 방지', () => {
  it('판매가 0 → 마진율 null, ROI(원가 0) null', () => {
    const s = scn({ sellingPrice: 0, categories: [] });
    const r = compute(s);
    expect(r.marginRate).toBeNull();
    expect(r.roi).toBeNull();
    expect(Number.isFinite(r.costPerUnit)).toBe(true);
  });
  it('값이 NaN인 항목은 0으로 취급', () => {
    const s = scn({
      categories: [{ id: 'c1', name: 'x', items: [{ id: 'i1', name: 'a', basis: 'per_unit', value: NaN }] }],
    });
    expect(compute(s).costPerUnit).toBeCloseTo(0, 6);
  });
});
