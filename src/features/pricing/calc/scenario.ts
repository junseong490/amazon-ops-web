// 시나리오 불변(immutable) 편집 헬퍼 — 순수 함수. UI·테스트가 공유한다.
// 모든 함수는 새 Scenario를 반환하며 입력을 변형하지 않는다.

import type { Category, CostItem, Scenario } from '../types';

/** 충돌 없는 id 생성. crypto 미지원 환경 폴백 포함. */
export function uid(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rnd}`;
}

export function setSellingPrice(scenario: Scenario, price: number): Scenario {
  return { ...scenario, sellingPrice: price };
}

export function setMarket(scenario: Scenario, market: string, currency: string): Scenario {
  return { ...scenario, market, currency };
}

export function addCategory(scenario: Scenario, name = '새 카테고리'): Scenario {
  const cat: Category = { id: uid('cat'), name, items: [] };
  return { ...scenario, categories: [...scenario.categories, cat] };
}

export function renameCategory(scenario: Scenario, catId: string, name: string): Scenario {
  return {
    ...scenario,
    categories: scenario.categories.map((c) => (c.id === catId ? { ...c, name } : c)),
  };
}

export function removeCategory(scenario: Scenario, catId: string): Scenario {
  return { ...scenario, categories: scenario.categories.filter((c) => c.id !== catId) };
}

export function addItem(scenario: Scenario, catId: string, item?: Partial<CostItem>): Scenario {
  const newItem: CostItem = {
    id: uid('item'),
    name: item?.name ?? '새 항목',
    basis: item?.basis ?? 'per_unit',
    value: item?.value ?? 0,
    countInCogs: item?.countInCogs,
  };
  return {
    ...scenario,
    categories: scenario.categories.map((c) =>
      c.id === catId ? { ...c, items: [...c.items, newItem] } : c,
    ),
  };
}

export function updateItem(
  scenario: Scenario,
  catId: string,
  itemId: string,
  patch: Partial<CostItem>,
): Scenario {
  return {
    ...scenario,
    categories: scenario.categories.map((c) =>
      c.id === catId
        ? {
            ...c,
            items: c.items.map((it) => (it.id === itemId ? { ...it, ...patch, id: it.id } : it)),
          }
        : c,
    ),
  };
}

export function removeItem(scenario: Scenario, catId: string, itemId: string): Scenario {
  return {
    ...scenario,
    categories: scenario.categories.map((c) =>
      c.id === catId ? { ...c, items: c.items.filter((it) => it.id !== itemId) } : c,
    ),
  };
}
