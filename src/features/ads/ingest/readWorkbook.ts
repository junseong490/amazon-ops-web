// xlsx 다중시트 리더(SheetJS CE 읽기) — plan §A6. 원본 바이트를 왕복용으로 보관하고,
// SP Campaigns + SP Search Term Report만 해석. 나머지 시트는 손대지 않는다.
// 헤더 이름으로 시트를 식별 → 형식 인식 실패 시 명확한 오류(가짜 파싱 금지).
import * as XLSX from 'xlsx';
import type { AdWorkbook } from '../types';
import { type Cell, buildColIndex, hasAllHeaders } from '../parse/headers';
import { SP_REQUIRED_HEADERS, parseSpCampaigns } from '../parse/spCampaigns';
import { ST_REQUIRED_HEADERS, parseSearchTerms } from '../parse/searchTerms';

/** 형식 인식 불가 — 지원 벌크 시트를 찾지 못함(JP 로컬라이즈 등). */
export class WorkbookFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkbookFormatError';
  }
}

interface SheetTable {
  name: string;
  table: Cell[][];
  startRow: number;
}

function readSheet(wb: XLSX.WorkBook, name: string): SheetTable {
  const ws = wb.Sheets[name];
  const table = XLSX.utils.sheet_to_json<Cell[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
  let startRow = 0;
  if (ws['!ref']) startRow = XLSX.utils.decode_range(ws['!ref']).s.r;
  return { name, table, startRow };
}

function firstRow(wb: XLSX.WorkBook, name: string): Cell[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  return rows[0] ?? [];
}

/** 헤더 내용으로 필수 컬럼을 모두 가진 첫 시트 이름을 찾는다(이름 로컬라이즈 방어). */
function findSheetByHeaders(wb: XLSX.WorkBook, required: string[]): string | null {
  for (const name of wb.SheetNames) {
    const idx = buildColIndex(firstRow(wb, name));
    if (hasAllHeaders(idx, required)) return name;
  }
  return null;
}

export function readWorkbook(fileName: string, bytes: Uint8Array): AdWorkbook {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new WorkbookFormatError(
      'xlsx 파일을 읽지 못했습니다. Sponsored Products Bulk Operations(.xlsx) 파일인지 확인하세요.',
    );
  }

  const spName = findSheetByHeaders(wb, SP_REQUIRED_HEADERS);
  if (!spName) {
    throw new WorkbookFormatError(
      '형식 인식 불가 — Sponsored Products Campaigns 시트를 찾지 못했습니다. ' +
        '영문 헤더의 SP Bulk Operations 파일이 필요합니다(JP 등 로컬라이즈 양식은 아직 미지원).',
    );
  }

  const sp = readSheet(wb, spName);
  const parsed = parseSpCampaigns(sp.table, sp.startRow);

  const warnings: string[] = [];
  const stName = findSheetByHeaders(wb, ST_REQUIRED_HEADERS);
  let searchTerms: AdWorkbook['searchTerms'] = [];
  if (stName) {
    searchTerms = parseSearchTerms(readSheet(wb, stName).table);
  } else {
    warnings.push('SP Search Term Report 시트를 찾지 못해 검색어 제안은 비활성화됩니다.');
  }

  return {
    fileName,
    rawBytes: bytes,
    spSheetName: spName,
    colIndex: parsed.colIndex,
    rows: parsed.rows,
    searchTerms,
    warnings,
  };
}
