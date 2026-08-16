// 왕복(재생성) — plan §A5 1순위: XML 외과수술 패치. spike로 동일성 검증됨.
// 원본 워크북을 fflate로 unzip → SP 시트에서 변경행 Bid·Operation만 교체 + 선택된
// 신규/네거티브 키워드를 create 행으로 추가 → 재zip. 나머지 시트·서식·메타 100% 보존.
// Operation 등 문자열은 inlineStr로 써 sharedStrings 변경을 회피한다.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { AdWorkbook } from '../types';
import { col } from '../parse/headers';

export interface BidChange {
  /** 스프레드시트 실제 행번호(AdRow.rowIndex). */
  rowIndex: number;
  newBid: number;
}
export interface CreateKeyword {
  campaignId: string;
  adGroupId: string;
  keywordText: string;
  matchType: string; // 'Exact' 등
  bid: number;
}
export interface CreateNegative {
  campaignId: string;
  adGroupId: string;
  keywordText: string;
  matchType: string; // 'Negative Exact'
}

export interface PatchInput {
  workbook: AdWorkbook;
  bidChanges: BidChange[];
  newKeywords: CreateKeyword[];
  negatives: CreateNegative[];
}

// --- 컬럼 문자 <-> 인덱스 ---
export function colLetter(idx0: number): string {
  let n = idx0 + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function decodeCol(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function strCellXml(letter: string, r: number, text: string): string {
  return `<c r="${letter}${r}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
}
function numCellXml(letter: string, r: number, value: number): string {
  return `<c r="${letter}${r}" t="n"><v>${value}</v></c>`;
}

/** row 내부 문자열에 셀을 컬럼 순서 유지하며 삽입. */
function insertCellInOrder(inner: string, targetIdx0: number, cellXml: string): string {
  const re = /<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
  let m: RegExpExecArray | null;
  let pos = inner.length;
  while ((m = re.exec(inner))) {
    if (decodeCol(m[1]) > targetIdx0) {
      pos = m.index;
      break;
    }
  }
  return inner.slice(0, pos) + cellXml + inner.slice(pos);
}

/** SP 시트 xml 경로를 workbook.xml + rels로 해석. */
export function resolveSheetPath(files: Record<string, Uint8Array>, sheetName: string): string {
  const wb = strFromU8(files['xl/workbook.xml']);
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels']);
  const sheetTag = [...wb.matchAll(/<sheet [^>]*\/>/g)]
    .map((mm) => mm[0])
    .find((t) => {
      const nm = /name="([^"]*)"/.exec(t);
      return nm ? nm[1] === sheetName : false;
    });
  if (!sheetTag) throw new Error('WORKBOOK_SHEET_NOT_FOUND');
  const rid = /r:id="([^"]*)"/.exec(sheetTag)?.[1];
  const relTag = [...rels.matchAll(/<Relationship [^>]*\/>/g)]
    .map((mm) => mm[0])
    .find((t) => new RegExp(`Id="${rid}"`).test(t));
  const target = relTag ? /Target="([^"]*)"/.exec(relTag)?.[1] : undefined;
  if (!target) throw new Error('WORKBOOK_REL_NOT_FOUND');
  const clean = target.replace(/^\//, '').replace(/^xl\//, '');
  return `xl/${clean}`;
}

function patchRow(
  xml: string,
  r: number,
  mutate: (inner: string) => string,
): string {
  const m = new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?</row>`).exec(xml);
  if (!m) throw new Error(`ROW_NOT_FOUND:${r}`);
  const full = m[0];
  const openEnd = full.indexOf('>') + 1;
  const open = full.slice(0, openEnd);
  const inner = full.slice(openEnd, full.length - '</row>'.length);
  const rebuilt = open + mutate(inner) + '</row>';
  return xml.slice(0, m.index) + rebuilt + xml.slice(m.index + full.length);
}

export function patchWorkbook(input: PatchInput): Uint8Array {
  const { workbook, bidChanges, newKeywords, negatives } = input;
  const files = unzipSync(workbook.rawBytes);
  const path = resolveSheetPath(files, workbook.spSheetName);
  let xml = strFromU8(files[path]);

  const ci = workbook.colIndex;
  const idx = (name: string) => col(ci, name);
  const opIdx = idx('Operation');
  const bidIdx = idx('Bid');
  const opLtr = colLetter(opIdx);
  const bidLtr = colLetter(bidIdx);

  // 1) 변경행: Bid 값 교체 + Operation='update'.
  for (const ch of bidChanges) {
    xml = patchRow(xml, ch.rowIndex, (inner) => {
      let out = inner;
      // Bid: 기존 값만 교체(스타일 보존), 없으면 순서 삽입.
      const bidRe = new RegExp(`(<c r="${bidLtr}${ch.rowIndex}"[^>]*><v>)[^<]*(</v></c>)`);
      if (bidRe.test(out)) {
        out = out.replace(bidRe, `$1${ch.newBid}$2`);
      } else {
        out = insertCellInOrder(out, bidIdx, numCellXml(bidLtr, ch.rowIndex, ch.newBid));
      }
      // Operation: 있으면 교체, 없으면 순서 삽입.
      const opRe = new RegExp(`<c r="${opLtr}${ch.rowIndex}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
      const opCell = strCellXml(opLtr, ch.rowIndex, 'update');
      out = opRe.test(out)
        ? out.replace(opRe, opCell)
        : insertCellInOrder(out, opIdx, opCell);
      return out;
    });
  }

  // 2) create 행 추가(선택된 신규 키워드·네거티브만).
  const createRows = buildCreateRows(ci, xml, newKeywords, negatives);
  if (createRows.length > 0) {
    const marker = '</sheetData>';
    const at = xml.lastIndexOf(marker);
    xml = xml.slice(0, at) + createRows.join('') + xml.slice(at);
  }

  files[path] = strToU8(xml);
  return zipSync(files, { level: 6 });
}

function maxRowNumber(xml: string): number {
  let max = 1;
  for (const m of xml.matchAll(/<row r="(\d+)"/g)) {
    const n = Number.parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max;
}

function buildCreateRows(
  ci: Record<string, number>,
  xml: string,
  newKeywords: CreateKeyword[],
  negatives: CreateNegative[],
): string[] {
  if (newKeywords.length === 0 && negatives.length === 0) return [];
  const idx = (name: string) => col(ci, name);
  const cProduct = idx('Product');
  const cEntity = idx('Entity');
  const cOp = idx('Operation');
  const cCamp = idx('Campaign ID');
  const cGroup = idx('Ad Group ID');
  const cState = idx('State');
  const cBid = idx('Bid');
  const cKw = idx('Keyword Text');
  const cMatch = idx('Match Type');

  let r = maxRowNumber(xml);
  const rows: string[] = [];

  const emit = (fields: { idx: number; xml: (r: number) => string }[]) => {
    r += 1;
    const cells = fields
      .filter((f) => f.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .map((f) => f.xml(r))
      .join('');
    rows.push(`<row r="${r}">${cells}</row>`);
  };

  for (const k of newKeywords) {
    emit([
      { idx: cProduct, xml: (rr) => strCellXml(colLetter(cProduct), rr, 'Sponsored Products') },
      { idx: cEntity, xml: (rr) => strCellXml(colLetter(cEntity), rr, 'Keyword') },
      { idx: cOp, xml: (rr) => strCellXml(colLetter(cOp), rr, 'create') },
      { idx: cCamp, xml: (rr) => strCellXml(colLetter(cCamp), rr, k.campaignId) },
      { idx: cGroup, xml: (rr) => strCellXml(colLetter(cGroup), rr, k.adGroupId) },
      { idx: cState, xml: (rr) => strCellXml(colLetter(cState), rr, 'enabled') },
      { idx: cBid, xml: (rr) => numCellXml(colLetter(cBid), rr, k.bid) },
      { idx: cKw, xml: (rr) => strCellXml(colLetter(cKw), rr, k.keywordText) },
      { idx: cMatch, xml: (rr) => strCellXml(colLetter(cMatch), rr, k.matchType) },
    ]);
  }
  for (const n of negatives) {
    emit([
      { idx: cProduct, xml: (rr) => strCellXml(colLetter(cProduct), rr, 'Sponsored Products') },
      { idx: cEntity, xml: (rr) => strCellXml(colLetter(cEntity), rr, 'Negative Keyword') },
      { idx: cOp, xml: (rr) => strCellXml(colLetter(cOp), rr, 'create') },
      { idx: cCamp, xml: (rr) => strCellXml(colLetter(cCamp), rr, n.campaignId) },
      { idx: cGroup, xml: (rr) => strCellXml(colLetter(cGroup), rr, n.adGroupId) },
      { idx: cState, xml: (rr) => strCellXml(colLetter(cState), rr, 'enabled') },
      { idx: cKw, xml: (rr) => strCellXml(colLetter(cKw), rr, n.keywordText) },
      { idx: cMatch, xml: (rr) => strCellXml(colLetter(cMatch), rr, n.matchType) },
    ]);
  }
  return rows;
}
