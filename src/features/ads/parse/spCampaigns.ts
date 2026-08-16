// SP Campaigns 시트 → AdRow[] (순수). 헤더 이름 매핑, Entity별 분류, 지표 재계산.
// raw 원형 + rowIndex(스프레드시트 실제 행번호) 보존 → 왕복 패치 키.
import type { AdEntity, AdRow } from '../types';
import { computeMetrics } from '../aggregate/metrics';
import { type Cell, buildColIndex, cellNum, cellNumOpt, cellStr, col, hasAllHeaders } from './headers';

/** SP Campaigns 인식에 필요한 최소 헤더(영문). */
export const SP_REQUIRED_HEADERS = [
  'Entity',
  'Operation',
  'Bid',
  'Campaign ID',
  'Ad Group ID',
  'Keyword Text',
  'Match Type',
];

const KNOWN_ENTITIES: ReadonlySet<string> = new Set([
  'Campaign',
  'Ad Group',
  'Product Ad',
  'Keyword',
  'Negative Keyword',
  'Product Targeting',
  'Negative Product Targeting',
  'Bidding Adjustment',
]);

function toEntity(v: string): AdEntity {
  return (KNOWN_ENTITIES.has(v) ? v : 'Other') as AdEntity;
}

export interface ParsedSp {
  colIndex: Record<string, number>;
  rows: AdRow[];
}

/**
 * @param table  전체 시트 2D 배열(0=헤더행).
 * @param startRow 시트 !ref 시작 행(0-based). 스프레드시트 행번호 = startRow + arrayIdx + 1.
 */
export function parseSpCampaigns(table: Cell[][], startRow: number): ParsedSp {
  const headerRow = table[0] ?? [];
  const colIndex = buildColIndex(headerRow);
  if (!hasAllHeaders(colIndex, SP_REQUIRED_HEADERS)) {
    throw new Error('SP_HEADERS_UNRECOGNIZED');
  }

  const ci = {
    entity: col(colIndex, 'Entity'),
    campaignId: col(colIndex, 'Campaign ID'),
    adGroupId: col(colIndex, 'Ad Group ID'),
    campaignName: col(colIndex, 'Campaign Name'),
    adGroupName: col(colIndex, 'Ad Group Name'),
    keywordText: col(colIndex, 'Keyword Text'),
    matchType: col(colIndex, 'Match Type'),
    targetingExpr: col(colIndex, 'Product Targeting Expression'),
    bid: col(colIndex, 'Bid'),
    impressions: col(colIndex, 'Impressions'),
    clicks: col(colIndex, 'Clicks'),
    spend: col(colIndex, 'Spend'),
    sales: col(colIndex, 'Sales'),
    orders: col(colIndex, 'Orders'),
    units: col(colIndex, 'Units'),
  };

  const rows: AdRow[] = [];
  for (let i = 1; i < table.length; i += 1) {
    const raw = table[i] ?? [];
    // 완전 빈 행은 건너뛰되 rowIndex 정합은 유지(빈 행은 원본에 없다고 가정).
    const entityStr = cellStr(raw, ci.entity);
    if (!entityStr && raw.every((c) => c == null || c === '')) continue;
    const entity = toEntity(entityStr);
    const matchType = cellStr(raw, ci.matchType);
    const isNegative =
      entity === 'Negative Keyword' ||
      entity === 'Negative Product Targeting' ||
      /^negative/i.test(matchType);
    const editable = (entity === 'Keyword' || entity === 'Product Targeting') && !isNegative;

    const metrics = computeMetrics({
      impressions: cellNum(raw, ci.impressions),
      clicks: cellNum(raw, ci.clicks),
      spend: cellNum(raw, ci.spend),
      sales: cellNum(raw, ci.sales),
      orders: cellNum(raw, ci.orders),
      units: cellNum(raw, ci.units),
    });

    rows.push({
      rowIndex: startRow + i + 1,
      entity,
      raw: raw.slice(),
      campaignId: cellStr(raw, ci.campaignId) || undefined,
      adGroupId: cellStr(raw, ci.adGroupId) || undefined,
      campaignName: cellStr(raw, ci.campaignName) || undefined,
      adGroupName: cellStr(raw, ci.adGroupName) || undefined,
      keywordText: cellStr(raw, ci.keywordText) || undefined,
      matchType: matchType || undefined,
      targetingExpr: cellStr(raw, ci.targetingExpr) || undefined,
      currentBid: cellNumOpt(raw, ci.bid),
      editable,
      metrics,
    });
  }

  return { colIndex, rows };
}

/** 이미 등록된 (positive) 키워드 텍스트 집합(소문자). */
export function registeredKeywordSet(rows: AdRow[]): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    if (r.entity === 'Keyword' && r.keywordText) s.add(r.keywordText.trim().toLowerCase());
  }
  return s;
}

/** 이미 등록된 네거티브 키워드 텍스트 집합(소문자). */
export function registeredNegativeSet(rows: AdRow[]): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    if (r.entity === 'Negative Keyword' && r.keywordText) s.add(r.keywordText.trim().toLowerCase());
  }
  return s;
}
