// 집계 코어 — 순수 함수 (I/O 없음). 정규화 레코드[] → 집계 결과.
// LOCKED §4·5·8·9·12·13·14 반영. 유료 단계 Node 서버로 그대로 이식 가능.

import type {
  AggregateOptions,
  AggregateResult,
  GroupDim,
  GroupRow,
  MoneyByCurrency,
  SalesRecord,
} from '../../../types/domain';
import { marketDateKey } from '../../../core/time/marketTz';

function addMoney(map: MoneyByCurrency, currency: string, amount: number): void {
  if (!amount) {
    if (map[currency] === undefined) map[currency] = 0;
    return;
  }
  map[currency] = (map[currency] || 0) + amount;
}

/** 라인 매출: gross=item-price 그대로, net=item-price − item-promotion-discount. quantity 재곱 금지. */
export function lineRevenue(rec: SalesRecord, mode: 'gross' | 'net'): number {
  if (mode === 'net') {
    return rec.itemPrice - rec.itemPromotionDiscount;
  }
  return rec.itemPrice;
}

/** 옵션 기본값 */
export function defaultOptions(): AggregateOptions {
  return {
    excludeCancelled: true,
    revenueMode: 'gross',
    itemAxis: 'sku',
    statuses: undefined,
    channels: undefined,
  };
}

/** 필터 적용: 취소 제외(라인 item-status), 기간, 채널, 상태. */
export function applyFilters(records: SalesRecord[], opts: AggregateOptions): SalesRecord[] {
  return records.filter((rec) => {
    if (opts.excludeCancelled && rec.itemStatusClass === 'cancelled') return false;
    if (opts.statuses && opts.statuses.length > 0 && !opts.statuses.includes(rec.itemStatusClass)) {
      return false;
    }
    if (opts.channels && opts.channels.length > 0 && !opts.channels.includes(rec.salesChannel)) {
      return false;
    }
    if (opts.dateFrom || opts.dateTo) {
      const dk = marketDateKey(rec.purchaseInstantMs, rec.salesChannel);
      if (opts.dateFrom && dk < opts.dateFrom) return false;
      if (opts.dateTo && dk > opts.dateTo) return false;
    }
    return true;
  });
}

function keyForDim(rec: SalesRecord, dim: GroupDim, opts: AggregateOptions): string {
  switch (dim) {
    case 'date':
      return marketDateKey(rec.purchaseInstantMs, rec.salesChannel);
    case 'channel':
      return rec.salesChannel;
    case 'item':
      return opts.itemAxis === 'asin' ? rec.asin || rec.sku : rec.sku || rec.asin;
  }
}

interface Acc {
  keys: string[];
  revenueByCurrency: MoneyByCurrency;
  taxByCurrency: MoneyByCurrency;
  shippingByCurrency: MoneyByCurrency;
  quantity: number;
  orders: Set<string>;
}

/**
 * 범용 롤업: groupBy 차원 배열로 그룹핑.
 * - 통화 혼재 합산 금지 → revenueByCurrency 통화별 분리 (LOCKED §8)
 * - orderCount = distinct amazon-order-id (LOCKED §14)
 * - 세금 = item-tax + item-tax류, 배송 = shipping-price+shipping-tax+gift-wrap (매출과 분리, LOCKED §6)
 */
export function aggregate(
  records: SalesRecord[],
  groupBy: GroupDim[],
  options?: Partial<AggregateOptions>,
): AggregateResult {
  const opts: AggregateOptions = { ...defaultOptions(), ...options };
  const filtered = applyFilters(records, opts);

  const groups = new Map<string, Acc>();
  const totalRevenue: MoneyByCurrency = {};
  const totalTax: MoneyByCurrency = {};
  const totalShipping: MoneyByCurrency = {};
  const totalOrders = new Set<string>();
  let totalQty = 0;
  const itemLabels: Record<string, string> = {};

  for (const rec of filtered) {
    const keys = groupBy.map((d) => keyForDim(rec, d, opts));
    const gkey = keys.join('');
    let acc = groups.get(gkey);
    if (!acc) {
      acc = {
        keys,
        revenueByCurrency: {},
        taxByCurrency: {},
        shippingByCurrency: {},
        quantity: 0,
        orders: new Set<string>(),
      };
      groups.set(gkey, acc);
    }

    const rev = lineRevenue(rec, opts.revenueMode);
    const tax = rec.itemTax;
    const ship = rec.shippingPrice + rec.shippingTax + rec.giftWrapPrice + rec.giftWrapTax;

    addMoney(acc.revenueByCurrency, rec.currency, rev);
    addMoney(acc.taxByCurrency, rec.currency, tax);
    addMoney(acc.shippingByCurrency, rec.currency, ship);
    acc.quantity += rec.quantity;
    acc.orders.add(rec.amazonOrderId);

    addMoney(totalRevenue, rec.currency, rev);
    addMoney(totalTax, rec.currency, tax);
    addMoney(totalShipping, rec.currency, ship);
    totalQty += rec.quantity;
    totalOrders.add(rec.amazonOrderId);

    if (groupBy.includes('item')) {
      const itemKey = opts.itemAxis === 'asin' ? rec.asin || rec.sku : rec.sku || rec.asin;
      if (itemKey && !itemLabels[itemKey]) itemLabels[itemKey] = rec.productName;
    }
  }

  const rows: GroupRow[] = Array.from(groups.values()).map((acc) => ({
    keys: acc.keys,
    revenueByCurrency: acc.revenueByCurrency,
    quantity: acc.quantity,
    orderCount: acc.orders.size,
    taxByCurrency: acc.taxByCurrency,
    shippingByCurrency: acc.shippingByCurrency,
  }));

  // 정렬: 날짜 차원이면 dateKey 오름차순, 아니면 첫 통화 매출 내림차순
  rows.sort((a, b) => {
    if (groupBy[0] === 'date') return a.keys[0] < b.keys[0] ? -1 : a.keys[0] > b.keys[0] ? 1 : 0;
    return sumMoney(b.revenueByCurrency) - sumMoney(a.revenueByCurrency);
  });

  const aovByCurrency: MoneyByCurrency = {};
  const orderCount = totalOrders.size;
  for (const cur of Object.keys(totalRevenue)) {
    aovByCurrency[cur] = orderCount > 0 ? totalRevenue[cur] / orderCount : 0;
  }

  return {
    groupBy,
    rows,
    totals: {
      revenueByCurrency: totalRevenue,
      taxByCurrency: totalTax,
      shippingByCurrency: totalShipping,
      quantity: totalQty,
      orderCount,
      aovByCurrency,
    },
    itemLabels: groupBy.includes('item') ? itemLabels : undefined,
  };
}

/** 통화 무시 단순 합 (정렬 보조용 only — 표시에는 쓰지 말 것). */
function sumMoney(m: MoneyByCurrency): number {
  return Object.values(m).reduce((s, v) => s + v, 0);
}

/** 편의: 국가별 / 품목별 / 일별 롤업 */
export function byChannel(records: SalesRecord[], options?: Partial<AggregateOptions>) {
  return aggregate(records, ['channel'], options);
}
export function byItem(records: SalesRecord[], options?: Partial<AggregateOptions>) {
  return aggregate(records, ['item'], options);
}
export function byDate(records: SalesRecord[], options?: Partial<AggregateOptions>) {
  return aggregate(records, ['date'], options);
}
export function byDateChannel(records: SalesRecord[], options?: Partial<AggregateOptions>) {
  return aggregate(records, ['date', 'channel'], options);
}
export function byDateItem(records: SalesRecord[], options?: Partial<AggregateOptions>) {
  return aggregate(records, ['date', 'item'], options);
}
