// SP Search Term Report → SearchTermRow[] (순수, 읽기 전용). 헤더 이름 매핑.
import type { SearchTermRow } from '../types';
import { computeMetrics } from '../aggregate/metrics';
import { type Cell, buildColIndex, cellNum, cellStr, col, hasAllHeaders } from './headers';

export const ST_REQUIRED_HEADERS = ['Customer Search Term', 'Clicks', 'Orders', 'Spend', 'Sales'];

export function parseSearchTerms(table: Cell[][]): SearchTermRow[] {
  const headerRow = table[0] ?? [];
  const colIndex = buildColIndex(headerRow);
  if (!hasAllHeaders(colIndex, ST_REQUIRED_HEADERS)) return [];

  const ci = {
    campaignId: col(colIndex, 'Campaign ID'),
    adGroupId: col(colIndex, 'Ad Group ID'),
    campaignName: col(colIndex, 'Campaign Name (Informational only)'),
    adGroupName: col(colIndex, 'Ad Group Name (Informational only)'),
    keywordText: col(colIndex, 'Keyword Text'),
    matchType: col(colIndex, 'Match Type'),
    customerSearchTerm: col(colIndex, 'Customer Search Term'),
    impressions: col(colIndex, 'Impressions'),
    clicks: col(colIndex, 'Clicks'),
    spend: col(colIndex, 'Spend'),
    sales: col(colIndex, 'Sales'),
    orders: col(colIndex, 'Orders'),
    units: col(colIndex, 'Units'),
  };

  const out: SearchTermRow[] = [];
  for (let i = 1; i < table.length; i += 1) {
    const raw = table[i] ?? [];
    const term = cellStr(raw, ci.customerSearchTerm);
    if (!term) continue;
    out.push({
      campaignId: cellStr(raw, ci.campaignId),
      adGroupId: cellStr(raw, ci.adGroupId),
      campaignName: cellStr(raw, ci.campaignName),
      adGroupName: cellStr(raw, ci.adGroupName),
      keywordText: cellStr(raw, ci.keywordText),
      matchType: cellStr(raw, ci.matchType),
      customerSearchTerm: term,
      metrics: computeMetrics({
        impressions: cellNum(raw, ci.impressions),
        clicks: cellNum(raw, ci.clicks),
        spend: cellNum(raw, ci.spend),
        sales: cellNum(raw, ci.sales),
        orders: cellNum(raw, ci.orders),
        units: cellNum(raw, ci.units),
      }),
    });
  }
  return out;
}
