// 효율 지표 재계산(순수) — plan §A2. 원시값(Spend/Sales/Clicks/Orders/Impressions)에서
// 파생 지표를 재계산해 아마존 반올림·기간 불일치를 방어한다. 0분모는 null.
import type { AdMetrics } from '../types';

export interface RawPerf {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
}

function ratio(num: number, den: number): number | null {
  if (!(den > 0)) return null;
  return num / den;
}

export function computeMetrics(p: RawPerf): AdMetrics {
  return {
    impressions: p.impressions,
    clicks: p.clicks,
    spend: p.spend,
    sales: p.sales,
    orders: p.orders,
    units: p.units,
    ctr: ratio(p.clicks, p.impressions),
    cpc: ratio(p.spend, p.clicks),
    cvr: ratio(p.orders, p.clicks),
    acos: ratio(p.spend, p.sales),
    roas: ratio(p.sales, p.spend),
    rpc: ratio(p.sales, p.clicks),
  };
}
