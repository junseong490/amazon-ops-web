// 헤더 이름 매핑(§5c: 위치 인덱스 금지). 컬럼 순서·개수가 달라도 이름으로 찾는다.
// 영문 헤더 포맷 타깃 — 매칭 실패 시 호출측이 "형식 인식 불가" 안내.

export type Cell = string | number | boolean | null;

const norm = (s: unknown): string => String(s ?? '').trim().toLowerCase();

/** 헤더 행 → { 정규화 헤더명 → 0-based 인덱스 }. 첫 등장 우선. */
export function buildColIndex(headerRow: Cell[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const k = norm(h);
    if (k && !(k in map)) map[k] = i;
  });
  return map;
}

/** 이름으로 인덱스 조회(정규화). 없으면 -1. */
export function col(index: Record<string, number>, name: string): number {
  const k = norm(name);
  return k in index ? index[k] : -1;
}

/** 필수 헤더가 모두 있는지. */
export function hasAllHeaders(index: Record<string, number>, names: string[]): boolean {
  return names.every((n) => col(index, n) >= 0);
}

export function cellStr(row: Cell[], idx: number): string {
  if (idx < 0) return '';
  const v = row[idx];
  return v == null ? '' : String(v).trim();
}

/** 숫자 파싱 — 콤마/통화기호 제거, 실패 시 0. */
export function cellNum(row: Cell[], idx: number): number {
  if (idx < 0) return 0;
  const v = row[idx];
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const cleaned = String(v).replace(/[^0-9.\-eE]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** 입찰 등 "값이 없을 수 있는" 숫자 — 빈칸이면 undefined. */
export function cellNumOpt(row: Cell[], idx: number): number | undefined {
  if (idx < 0) return undefined;
  const v = row[idx];
  if (v == null || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace(/[^0-9.\-eE]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
