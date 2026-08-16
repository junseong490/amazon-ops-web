// 광고 최적화 유닛테스트 — plan §A7 + reference §5c(LOCKED).
// 순수 계산 + 왕복(합성 픽스처) 결정적 검증. 실제 샘플은 커밋 금지 → 합성 픽스처 사용.
import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { computeMetrics } from '../src/features/ads/aggregate/metrics';
import { recommendBid, DEFAULT_BID_PARAMS, roundBid } from '../src/features/ads/recommend/bid';
import type { BidParams } from '../src/features/ads/types';
import {
  suggestFromSearchTerms,
  DEFAULT_SUGGEST_PARAMS,
} from '../src/features/ads/recommend/searchTermSuggest';
import { parseSpCampaigns } from '../src/features/ads/parse/spCampaigns';
import { readWorkbook, WorkbookFormatError } from '../src/features/ads/ingest/readWorkbook';
import { patchWorkbook } from '../src/features/ads/serialize/patchWorkbook';
import { editedFileName } from '../src/features/ads/serialize/download';
import {
  buildXlsx,
  spHeaderRow,
  spRow,
  ST_HEADER,
  stRow,
  SP_EXTRA_COLS,
  type Cell,
} from './ads-fixtures';

function params(over: Partial<BidParams> = {}): BidParams {
  return { ...DEFAULT_BID_PARAMS, ...over };
}
function metrics(over: Partial<Parameters<typeof computeMetrics>[0]>) {
  return computeMetrics({
    impressions: 1000,
    clicks: 0,
    spend: 0,
    sales: 0,
    orders: 0,
    units: 0,
    ...over,
  });
}

// ===== 입찰 산식 =====
describe('T1 클릭0 유지', () => {
  it('clicks=0 → newBid=curBid, keep', () => {
    const r = recommendBid(metrics({ clicks: 0 }), 1.0, params());
    expect(r.newBid).toBe(1.0);
    expect(r.flags).toContain('keep');
  });
  it('노출 있고 클릭0 → no-click 플래그', () => {
    const r = recommendBid(metrics({ impressions: 5000, clicks: 0 }), 1.0, params());
    expect(r.flags).toContain('no-click');
  });
});

describe('T2 저데이터 관망', () => {
  it('clicks=5 < minClicks=10 → 유지, low-data', () => {
    const r = recommendBid(metrics({ clicks: 5, spend: 3 }), 1.0, params());
    expect(r.newBid).toBe(1.0);
    expect(r.flags).toContain('low-data');
  });
});

describe('T3 낭비 완만인하(반토막 아님) + 네거티브 후보 — §5c', () => {
  it('clicks=20, orders=0 → -15%만(=0.85), 반토막 아님', () => {
    const r = recommendBid(metrics({ clicks: 20, spend: 12 }), 1.0, params());
    expect(r.newBid).toBe(0.85); // curBid*(1-0.15), NOT 0.5
    expect(r.flags).toContain('reduce');
    expect(r.flags).toContain('waste');
    expect(r.flags).toContain('negative-candidate'); // clicks≥zeroSaleClicks(15)
  });
  it('clicks=12 (<zeroSaleClicks) → 네거티브 후보 아님', () => {
    const r = recommendBid(metrics({ clicks: 12, spend: 8 }), 1.0, params());
    expect(r.newBid).toBe(0.85);
    expect(r.flags).not.toContain('negative-candidate');
  });
  it('bid floor 준수 — 인하가 floor 아래로 안 감', () => {
    const r = recommendBid(metrics({ clicks: 20, spend: 1 }), 0.02, params({ bidFloor: 0.02 }));
    expect(r.newBid).toBe(0.02);
    expect(r.flags).toContain('floor');
  });
});

describe('T4 판매有 인하(고ACOS) — 하방 보수 클램프', () => {
  it('actualAcos=0.60, target=0.30 → 비율0.5지만 -15% 클램프 → 0.85', () => {
    const r = recommendBid(
      metrics({ clicks: 20, spend: 6, sales: 10, orders: 2 }),
      1.0,
      params({ targetAcos: 0.3, applyRpcCap: false }),
    );
    // 비율법 0.5 → 하방 클램프 max(0.85, ...) → 0.85 (§5c 비대칭)
    expect(r.newBid).toBe(0.85);
    expect(r.flags).toContain('reduce');
  });
});

describe('T5 판매有 인상(저ACOS)', () => {
  it('actualAcos=0.15, target=0.30 → 비율2.0, +30% 클램프 → 1.30', () => {
    const r = recommendBid(
      metrics({ clicks: 40, spend: 6, sales: 40, orders: 8 }),
      1.0,
      params({ targetAcos: 0.3, applyRpcCap: false, maxIncreasePct: 0.3 }),
    );
    expect(r.newBid).toBe(1.3);
    expect(r.flags).toContain('grow');
  });
  it('waste-cut 모드 → 인상 억제(유지)', () => {
    const r = recommendBid(
      metrics({ clicks: 40, spend: 6, sales: 40, orders: 8 }),
      1.0,
      params({ targetAcos: 0.3, applyRpcCap: false, strategyMode: 'waste-cut' }),
    );
    expect(r.newBid).toBe(1.0);
  });
});

describe('T6 RPC 상한 — 인상 억제', () => {
  it('rpc=2.0, target=0.30 → 상한 0.60; 비율법 인상(1.5)을 0.60로 상한', () => {
    // curBid=0.50, clicks=40, sales=80 → rpc=2.0; spend=8 → acos=0.10 → 비율법 0.50*3=1.5(인상)
    // RPC 상한 0.60 < 1.5 → 0.60 (인상 클램프 +30%=0.65 안이라 유지)
    const r = recommendBid(
      metrics({ clicks: 40, spend: 8, sales: 80, orders: 10 }),
      0.5,
      params({ targetAcos: 0.3, applyRpcCap: true }),
    );
    expect(r.newBid).toBe(0.6);
    expect(r.flags).toContain('rpc-cap');
  });
  it('§5c: RPC가 큰 인하를 시사해도 하방은 -15%까지만(노출 보호)', () => {
    // curBid=1.0, ratio·rpc 모두 낮음 → 그래도 한 번에 -15%(0.85)까지만
    const r = recommendBid(
      metrics({ clicks: 40, spend: 8, sales: 80, orders: 10 }),
      1.0,
      params({ targetAcos: 0.3, applyRpcCap: true }),
    );
    expect(r.newBid).toBe(0.85);
  });
});

describe('T7 클램프 순서·하한 / T8 통화 반올림', () => {
  it('bidFloor=0.02 아래로 안 내려감', () => {
    const r = recommendBid(
      metrics({ clicks: 30, spend: 20, sales: 5, orders: 1 }),
      0.02,
      params({ targetAcos: 0.3, bidFloor: 0.02, applyRpcCap: false }),
    );
    expect(r.newBid).toBeGreaterThanOrEqual(0.02);
  });
  it('USD 2자리, JPY 정수', () => {
    expect(roundBid(0.856, 'USD')).toBe(0.86);
    expect(roundBid(45.4, 'JPY')).toBe(45);
    expect(roundBid(45.5, 'JPY')).toBe(46);
  });
  it('품목별 override — targetAcos를 행별로 바꾸면 결과 달라짐', () => {
    const m = metrics({ clicks: 20, spend: 6, sales: 20, orders: 4 }); // acos=0.30
    const a = recommendBid(m, 1.0, params({ targetAcos: 0.3, applyRpcCap: false }));
    const b = recommendBid(m, 1.0, params({ targetAcos: 0.15, applyRpcCap: false }));
    expect(a.newBid).toBe(1.0); // 목표=실제 → 유지
    expect(b.newBid).toBeLessThan(1.0); // 더 빡센 목표 → 인하
  });
});

// ===== 지표 =====
describe('T13 지표 정합성', () => {
  it('Spend/Sales/Clicks/Orders → ACOS/CPC/CVR/ROAS/RPC', () => {
    const m = computeMetrics({ impressions: 1000, clicks: 50, spend: 25, sales: 100, orders: 10, units: 12 });
    expect(m.ctr).toBeCloseTo(0.05, 6);
    expect(m.cpc).toBeCloseTo(0.5, 6);
    expect(m.cvr).toBeCloseTo(0.2, 6);
    expect(m.acos).toBeCloseTo(0.25, 6);
    expect(m.roas).toBeCloseTo(4, 6);
    expect(m.rpc).toBeCloseTo(2, 6);
  });
  it('0분모 → null', () => {
    const m = computeMetrics({ impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, units: 0 });
    expect(m.ctr).toBeNull();
    expect(m.cpc).toBeNull();
    expect(m.acos).toBeNull();
    expect(m.rpc).toBeNull();
  });
});

// ===== 헤더 이름 매핑(컬럼 순서 무관) =====
describe('헤더 이름 매핑 — 컬럼 순서가 달라도 정확', () => {
  it('셔플된 헤더에서도 Bid/Entity/지표를 이름으로 찾음', () => {
    const header: Cell[] = ['Bid', 'Entity', 'Clicks', 'Spend', 'Sales', 'Orders', 'Keyword Text', 'Match Type', 'Operation', 'Campaign ID', 'Ad Group ID'];
    const row: Cell[] = [1.5, 'Keyword', 20, 6, 20, 4, 'lemon juice', 'Exact', null, 'C1', 'G1'];
    const parsed = parseSpCampaigns([header, row], 0);
    expect(parsed.rows).toHaveLength(1);
    const kw = parsed.rows[0];
    expect(kw.currentBid).toBe(1.5);
    expect(kw.keywordText).toBe('lemon juice');
    expect(kw.editable).toBe(true);
    expect(kw.metrics?.acos).toBeCloseTo(0.3, 6);
  });
  it('네거티브는 편집 대상 아님', () => {
    const header: Cell[] = ['Entity', 'Bid', 'Match Type', 'Operation', 'Campaign ID', 'Ad Group ID', 'Keyword Text', 'Clicks', 'Spend', 'Sales', 'Orders'];
    const neg: Cell[] = ['Negative Keyword', null, 'Negative Exact', null, 'C1', 'G1', 'cheap', 0, 0, 0, 0];
    const parsed = parseSpCampaigns([header, neg], 0);
    expect(parsed.rows[0].editable).toBe(false);
  });
  it('필수 헤더 없으면 throw(형식 인식 불가)', () => {
    expect(() => parseSpCampaigns([['Foo', 'Bar'], [1, 2]], 0)).toThrow('SP_HEADERS_UNRECOGNIZED');
  });
});

// ===== 검색어 제안 =====
describe('T14 검색어 제안', () => {
  const stRows = [
    // 고효율 → 신규 키워드 후보(미등록)
    { customerSearchTerm: 'organic lemon juice', campaignId: 'C1', adGroupId: 'G1', metrics: computeMetrics({ impressions: 500, clicks: 30, spend: 10, sales: 100, orders: 8, units: 8 }) },
    // 이미 등록된 키워드 → 제외
    { customerSearchTerm: 'lemon juice', campaignId: 'C1', adGroupId: 'G1', metrics: computeMetrics({ impressions: 500, clicks: 30, spend: 10, sales: 100, orders: 8, units: 8 }) },
    // 무전환 다클릭 → 네거티브 후보
    { customerSearchTerm: 'free lemon', campaignId: 'C1', adGroupId: 'G1', metrics: computeMetrics({ impressions: 500, clicks: 25, spend: 15, sales: 0, orders: 0, units: 0 }) },
  ].map((r) => ({ campaignName: '', adGroupName: '', keywordText: '', matchType: '', ...r }));

  it('고효율=신규 키워드(등록분 제외), 무전환 다클릭=네거티브', () => {
    const res = suggestFromSearchTerms(
      {
        searchTerms: stRows,
        registeredKeywords: new Set(['lemon juice']),
        registeredNegatives: new Set(),
      },
      { ...DEFAULT_SUGGEST_PARAMS, targetAcos: 0.3 },
    );
    expect(res.newKeywords.map((k) => k.customerSearchTerm)).toEqual(['organic lemon juice']);
    expect(res.newKeywords[0].recommendedBid).toBeGreaterThan(0);
    expect(res.negatives.map((n) => n.customerSearchTerm)).toEqual(['free lemon']);
  });
});

// ===== 왕복(합성 픽스처) =====
function makeFixture(): Uint8Array {
  const sp: Cell[][] = [
    spHeaderRow(),
    spRow({ entity: 'Campaign', campaignId: 'C1', campaignName: 'US_LEMON' }),
    spRow({ entity: 'Ad Group', campaignId: 'C1', adGroupId: 'G1', adGroupName: 'AG1' }),
    spRow({ entity: 'Keyword', campaignId: 'C1', adGroupId: 'G1', bid: 1.2, keywordText: 'lemon juice', matchType: 'Exact', impressions: 800, clicks: 20, spend: 12, sales: 0, orders: 0 }),
    spRow({ entity: 'Keyword', campaignId: 'C1', adGroupId: 'G1', bid: 0.9, keywordText: 'organic lemon', matchType: 'Phrase', impressions: 600, clicks: 30, spend: 6, sales: 40, orders: 6 }),
    spRow({ entity: 'Product Targeting', campaignId: 'C1', adGroupId: 'G1', bid: 0.5, impressions: 400, clicks: 15, spend: 5, sales: 20, orders: 3 }),
    spRow({ entity: 'Negative Keyword', campaignId: 'C1', adGroupId: 'G1', keywordText: 'free', matchType: 'Negative Exact' }),
  ];
  const st: Cell[][] = [
    ST_HEADER,
    stRow({ customerSearchTerm: 'organic lemon juice', campaignId: 'C1', adGroupId: 'G1', clicks: 30, spend: 10, sales: 100, orders: 8 }),
    stRow({ customerSearchTerm: 'cheap junk', campaignId: 'C1', adGroupId: 'G1', clicks: 25, spend: 15, sales: 0, orders: 0 }),
  ];
  const config: Cell[][] = [['Version', 'v1'], ['Region', 'NA']];
  return buildXlsx([
    { name: 'Sponsored Products Campaigns', rows: sp },
    { name: 'SP Search Term Report', rows: st },
    { name: 'Config', rows: config },
  ]);
}

describe('readWorkbook — 합성 픽스처 파싱', () => {
  it('SP 시트 + 검색어 시트 인식, 편집 대상 분류', () => {
    const wb = readWorkbook('bulk.xlsx', makeFixture());
    expect(wb.spSheetName).toBe('Sponsored Products Campaigns');
    const editable = wb.rows.filter((r) => r.editable);
    expect(editable.map((r) => r.keywordText ?? r.entity)).toEqual(['lemon juice', 'organic lemon', 'Product Targeting']);
    expect(wb.searchTerms).toHaveLength(2);
  });
  it('형식 불일치 시 WorkbookFormatError', () => {
    const bad = buildXlsx([{ name: 'RandomSheet', rows: [['a', 'b'], [1, 2]] }]);
    expect(() => readWorkbook('bad.xlsx', bad)).toThrow(WorkbookFormatError);
  });
});

describe('T9 무변경 항등 — 변경 0이면 대상 외 전 엔트리 바이트 동일', () => {
  it('bid 변경 없음 → 모든 zip 엔트리 원본과 동일', () => {
    const bytes = makeFixture();
    const wb = readWorkbook('bulk.xlsx', bytes);
    const out = patchWorkbook({ workbook: wb, bidChanges: [], newKeywords: [], negatives: [] });
    const a = unzipSync(bytes);
    const b = unzipSync(out);
    for (const k of Object.keys(a)) {
      expect(strFromU8(b[k])).toBe(strFromU8(a[k]));
    }
  });
});

describe('T10/T11/T12 변경행만 반영 + 비대상 시트·성과·식별자 보존', () => {
  it('Bid 1개 변경 → 그 행 Bid·Operation만 달라지고 그 외 전부 동일', () => {
    const bytes = makeFixture();
    const wb = readWorkbook('bulk.xlsx', bytes);
    const kw = wb.rows.find((r) => r.keywordText === 'lemon juice')!;
    const out = patchWorkbook({
      workbook: wb,
      bidChanges: [{ rowIndex: kw.rowIndex, newBid: 0.85 }],
      newKeywords: [],
      negatives: [],
    });
    const a = unzipSync(bytes);
    const b = unzipSync(out);
    // 대상 시트(sheet1) 외 전부 바이트 동일(Config·검색어·workbook·rels 등)
    for (const k of Object.keys(a)) {
      if (k === 'xl/worksheets/sheet1.xml') continue;
      expect(strFromU8(b[k])).toBe(strFromU8(a[k]));
    }
    // 대상 시트: 셀 단위 diff = 정확히 2셀(Bid AB, Operation C)
    const cells = (xml: string) => {
      const map: Record<string, string> = {};
      for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)) map[m[1]] = m[0];
      return map;
    };
    const ca = cells(strFromU8(a['xl/worksheets/sheet1.xml']));
    const cb = cells(strFromU8(b['xl/worksheets/sheet1.xml']));
    const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]);
    const changed = [...keys].filter((k) => ca[k] !== cb[k]).sort();
    expect(changed).toEqual([`AB${kw.rowIndex}`, `C${kw.rowIndex}`]);
    expect(cb[`AB${kw.rowIndex}`]).toContain('<v>0.85</v>');
    expect(cb[`C${kw.rowIndex}`]).toContain('update');
  });

  it('선택된 create 행(신규 키워드·네거티브)만 추가', () => {
    const bytes = makeFixture();
    const wb = readWorkbook('bulk.xlsx', bytes);
    const out = patchWorkbook({
      workbook: wb,
      bidChanges: [],
      newKeywords: [{ campaignId: 'C1', adGroupId: 'G1', keywordText: 'organic lemon juice', matchType: 'Exact', bid: 0.75 }],
      negatives: [{ campaignId: 'C1', adGroupId: 'G1', keywordText: 'cheap junk', matchType: 'Negative Exact' }],
    });
    // 재파싱: 새 행 2개 추가(Operation=create)
    const wb2 = readWorkbook('bulk.xlsx', out);
    const created = wb2.rows.filter((r) => (r.raw[SP_EXTRA_COLS.Bid] != null || r.entity === 'Negative Keyword') && r.keywordText && ['organic lemon juice', 'cheap junk'].includes(r.keywordText));
    expect(created.some((r) => r.keywordText === 'organic lemon juice' && r.entity === 'Keyword')).toBe(true);
    expect(created.some((r) => r.keywordText === 'cheap junk' && r.entity === 'Negative Keyword')).toBe(true);
    // Config 시트 보존
    const b = unzipSync(out);
    const a = unzipSync(bytes);
    expect(strFromU8(b['xl/worksheets/sheet3.xml'])).toBe(strFromU8(a['xl/worksheets/sheet3.xml']));
  });
});

describe('다운로드 파일명', () => {
  it('원본명-edited-YYYYMMDD.xlsx', () => {
    expect(editedFileName('bulk-abc.xlsx', new Date(2026, 7, 16))).toBe('bulk-abc-edited-20260816.xlsx');
  });
});
