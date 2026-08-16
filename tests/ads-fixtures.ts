// 합성 xlsx 픽스처 — 아마존 SP Bulk 포맷을 모사(inlineStr 셀, sparse, sharedStrings 미사용).
// 실제 샘플은 커밋 금지이므로 왕복 테스트는 이 합성 픽스처로 한다.
import { zipSync, strToU8 } from 'fflate';
import { colLetter } from '../src/features/ads/serialize/patchWorkbook';

export type Cell = string | number | null;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cellXml(ref: string, v: Cell): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return `<c r="${ref}" t="n"><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((row, ri) => {
      const r = ri + 1;
      const cells = row.map((v, ci) => cellXml(`${colLetter(ci)}${r}`, v)).join('');
      return `<row r="${r}">${cells}</row>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="A1"/><sheetData>' +
    body +
    '</sheetData></worksheet>'
  );
}

export interface SheetSpec {
  name: string;
  rows: Cell[][];
}

/** 여러 시트 → 아마존 유사 xlsx 바이트. */
export function buildXlsx(sheets: SheetSpec[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};

  files['[Content_Types].xml'] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('') +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      '</Types>',
  );

  files['_rels/.rels'] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
  );

  files['xl/sharedStrings.xml'] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>',
  );

  files['xl/workbook.xml'] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets
        .map(
          (s, i) =>
            `<sheet name="${esc(s.name)}" r:id="rId${i + 1}" sheetId="${i + 1}"/>`,
        )
        .join('') +
      '</sheets></workbook>',
  );

  files['xl/_rels/workbook.xml.rels'] = strToU8(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
      '</Relationships>',
  );

  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows));
  });

  return zipSync(files, { level: 6 });
}

// --- SP Campaigns 헤더(실측 54컬럼 부분집합, 이름 매핑 검증용으로 순서 유지) ---
export const SP_HEADER: string[] = [
  'Product', // 0
  'Entity', // 1
  'Operation', // 2
  'Campaign ID', // 3
  'Ad Group ID', // 4
  'Portfolio ID', // 5
  'Ad ID', // 6
  'Keyword ID', // 7
  'Product Targeting ID', // 8
  'Campaign Name', // 9
  'Ad Group Name', // 10
];
// 편의: 나머지 컬럼은 필요한 것만 채우고 이름 매핑으로 접근.
export const SP_EXTRA_COLS: Record<string, number> = {
  State: 17,
  Bid: 27,
  'Keyword Text': 28,
  'Match Type': 31,
  'Product Targeting Expression': 35,
  Impressions: 43,
  Clicks: 44,
  Spend: 46,
  Sales: 47,
  Orders: 48,
  Units: 49,
};

export function spHeaderRow(): Cell[] {
  const row: Cell[] = new Array(54).fill(null);
  SP_HEADER.forEach((h, i) => (row[i] = h));
  for (const [name, idx] of Object.entries(SP_EXTRA_COLS)) row[idx] = name;
  return row;
}

export interface SpRowInput {
  entity: string;
  campaignId?: string;
  adGroupId?: string;
  campaignName?: string;
  adGroupName?: string;
  bid?: number;
  keywordText?: string;
  matchType?: string;
  impressions?: number;
  clicks?: number;
  spend?: number;
  sales?: number;
  orders?: number;
  units?: number;
}

export function spRow(input: SpRowInput): Cell[] {
  const row: Cell[] = new Array(54).fill(null);
  row[0] = 'Sponsored Products';
  row[1] = input.entity;
  if (input.campaignId != null) row[3] = input.campaignId;
  if (input.adGroupId != null) row[4] = input.adGroupId;
  if (input.campaignName != null) row[9] = input.campaignName;
  if (input.adGroupName != null) row[10] = input.adGroupName;
  if (input.bid != null) row[SP_EXTRA_COLS.Bid] = input.bid;
  if (input.keywordText != null) row[SP_EXTRA_COLS['Keyword Text']] = input.keywordText;
  if (input.matchType != null) row[SP_EXTRA_COLS['Match Type']] = input.matchType;
  if (input.impressions != null) row[SP_EXTRA_COLS.Impressions] = input.impressions;
  if (input.clicks != null) row[SP_EXTRA_COLS.Clicks] = input.clicks;
  if (input.spend != null) row[SP_EXTRA_COLS.Spend] = input.spend;
  if (input.sales != null) row[SP_EXTRA_COLS.Sales] = input.sales;
  if (input.orders != null) row[SP_EXTRA_COLS.Orders] = input.orders;
  if (input.units != null) row[SP_EXTRA_COLS.Units] = input.units;
  return row;
}

// --- SP Search Term Report ---
export const ST_HEADER: string[] = [
  'Product',
  'Campaign ID',
  'Ad Group ID',
  'Keyword ID',
  'Product Targeting ID',
  'Campaign Name (Informational only)',
  'Ad Group Name (Informational only)',
  'Portfolio Name (Informational only)',
  'State',
  'Campaign State (Informational only)',
  'Bid',
  'Keyword Text',
  'Match Type',
  'Product Targeting Expression',
  'Resolved Product Targeting Expression (Informational only)',
  'Customer Search Term',
  'Impressions',
  'Clicks',
  'Click-through Rate',
  'Spend',
  'Sales',
  'Orders',
  'Units',
  'Conversion Rate',
  'ACOS',
  'CPC',
  'ROAS',
];

export interface StRowInput {
  campaignId?: string;
  adGroupId?: string;
  campaignName?: string;
  adGroupName?: string;
  keywordText?: string;
  matchType?: string;
  customerSearchTerm: string;
  impressions?: number;
  clicks?: number;
  spend?: number;
  sales?: number;
  orders?: number;
  units?: number;
}

export function stRow(input: StRowInput): Cell[] {
  const row: Cell[] = new Array(ST_HEADER.length).fill(null);
  row[0] = 'Sponsored Products';
  if (input.campaignId != null) row[1] = input.campaignId;
  if (input.adGroupId != null) row[2] = input.adGroupId;
  if (input.campaignName != null) row[5] = input.campaignName;
  if (input.adGroupName != null) row[6] = input.adGroupName;
  if (input.keywordText != null) row[11] = input.keywordText;
  if (input.matchType != null) row[12] = input.matchType;
  row[15] = input.customerSearchTerm;
  if (input.impressions != null) row[16] = input.impressions;
  if (input.clicks != null) row[17] = input.clicks;
  if (input.spend != null) row[19] = input.spend;
  if (input.sales != null) row[20] = input.sales;
  if (input.orders != null) row[21] = input.orders;
  if (input.units != null) row[22] = input.units;
  return row;
}
