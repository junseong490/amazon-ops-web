// TSV 파서: 구분자 `\t` 고정 (LOCKED §1). 자동감지 금지.
// 아마존 All Orders flat file은 값 내 탭/따옴표 이스케이프가 없는 단순 TSV다.

export interface RawTable {
  header: string[];
  /** 각 데이터 행 = 셀 문자열 배열 */
  rows: string[][];
}

/** BOM 제거 후 줄 단위로 분해, 각 줄을 탭으로 split. */
export function parseTsv(text: string): RawTable {
  // UTF-8 BOM 제거
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split(/\r\n|\r|\n/);
  // 마지막 빈 줄 제거
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (lines.length === 0) {
    return { header: [], rows: [] };
  }
  const header = lines[0].split('\t').map((h) => h.trim());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '') continue;
    rows.push(lines[i].split('\t'));
  }
  return { header, rows };
}
