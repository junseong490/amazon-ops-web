// 권장 입찰(순수) — plan §A3 + reference §5c(LOCKED).
// 원칙: "노출을 죽이지 않는다" — 하방 조정 보수적(기본 −15%, bid floor 준수,
// 낭비도 반토막 금지). 상방보다 하방을 더 보수적으로(비대칭 클램프).
import type { AdMetrics, BidFlag, BidParams, BidRecommendation } from '../types';

export const DEFAULT_BID_PARAMS: BidParams = {
  targetAcos: 0.25,
  minClicks: 10,
  zeroSaleClicks: 15,
  maxIncreasePct: 0.3,
  maxDecreasePct: 0.15,
  bidFloor: 0.02,
  bidCeiling: null,
  applyRpcCap: true,
  strategyMode: 'balanced',
  currency: 'USD',
};

/** 통화별 입찰 반올림 — USD 2자리, JPY 정수(0.5 반올림). */
export function roundBid(value: number, currency: BidParams['currency']): number {
  if (currency === 'JPY') return Math.round(value);
  return Math.round(value * 100) / 100;
}

/** nb를 [curBid*(1-maxDecreasePct), curBid*(1+maxIncreasePct)]로 비대칭 제한. */
function clampChange(nb: number, curBid: number, p: BidParams): number {
  const up = curBid * (1 + p.maxIncreasePct);
  const down = curBid * (1 - p.maxDecreasePct);
  return Math.min(up, Math.max(down, nb));
}

function pct(x: number | null): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`;
}

/**
 * 키워드/타겟 1행 권장 입찰. targetAcos는 호출측이 행별 override를 반영해 전달한다.
 */
export function recommendBid(
  m: AdMetrics,
  curBid: number,
  params: BidParams,
): BidRecommendation {
  const p = params;
  const round = (v: number) => roundBid(v, p.currency);

  // C1) 클릭 0 — 신호 없음 → 유지.
  if (m.clicks === 0) {
    const flags: BidFlag[] = ['keep'];
    if (m.impressions > 0) flags.push('no-click');
    return { newBid: round(curBid), reason: '클릭 0 — 데이터 없음, 유지', flags };
  }

  // C2) 저데이터(0 < clicks < minClicks) — 과반응 금지 → 유지.
  if (m.clicks < p.minClicks) {
    return {
      newBid: round(curBid),
      reason: `클릭 ${m.clicks} < ${p.minClicks} — 저데이터, 관망`,
      flags: ['low-data', 'keep'],
    };
  }

  // C3) 낭비(clicks ≥ minClicks, orders=0) — 완만 인하(반토막 금지) + 네거티브 후보.
  if (m.orders === 0) {
    const target = curBid * (1 - p.maxDecreasePct); // §5c: 한 번에 −15%까지만
    let nb = Math.max(target, p.bidFloor);
    const flags: BidFlag[] = ['reduce', 'waste'];
    if (nb <= p.bidFloor) flags.push('floor');
    if (m.clicks >= p.zeroSaleClicks) flags.push('negative-candidate');
    nb = round(nb);
    return {
      newBid: nb,
      reason: `클릭 ${m.clicks}·판매 0 → 낭비, 완만 인하(-${Math.round(p.maxDecreasePct * 100)}%)`,
      flags,
    };
  }

  // C4) 판매 있음(ACOS 계산됨) — 목표 ACOS 수렴(비율법 + RPC 상한).
  const actualAcos = m.spend / m.sales; // sales>0 보장
  let nb = curBid * (p.targetAcos / actualAcos); // 비쌈→인하, 효율→인상
  if (p.strategyMode === 'waste-cut') nb = Math.min(nb, curBid); // 인하만
  const flags: BidFlag[] = [];
  if (p.applyRpcCap && m.rpc != null) {
    const cap = m.rpc * p.targetAcos;
    if (cap < nb) {
      nb = cap;
      flags.push('rpc-cap');
    }
  }
  nb = clampChange(nb, curBid, p); // (1) 비대칭 변동 클램프
  nb = Math.max(nb, p.bidFloor); // (2) 하한
  if (p.bidCeiling != null) nb = Math.min(nb, p.bidCeiling);
  if (nb <= p.bidFloor) flags.push('floor');
  nb = round(nb); // (3) 통화 반올림
  const dir: BidFlag = nb > round(curBid) ? 'grow' : nb < round(curBid) ? 'reduce' : 'keep';
  flags.unshift(dir);
  return {
    newBid: nb,
    reason: `ACOS ${pct(actualAcos)} → 목표 ${pct(p.targetAcos)}`,
    flags,
  };
}
