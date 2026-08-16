// 업로드 파이프라인: bytes → decode → TSV → parse. 여러 파일을 order-item-id로 교차 dedup.

import type { ParseIssue, ParseResult, SalesRecord } from '../../../types/domain';
import { decodeBytes } from '../../../core/ingest/decode';
import { parseTsv } from '../../../core/ingest/tsv';
import { parseTable } from './parse';

export interface RawFile {
  name: string;
  bytes: Uint8Array;
}

export interface IngestResult {
  records: SalesRecord[];
  perFile: ParseResult[];
  issues: ParseIssue[];
}

let fileSeqCounter = 0;
function nextFileId(name: string): string {
  fileSeqCounter += 1;
  return `${name}#${fileSeqCounter}`;
}

/** 단일 파일 bytes → ParseResult */
export function ingestOne(file: RawFile): ParseResult {
  const { text, encoding } = decodeBytes(file.bytes);
  const table = parseTsv(text);
  return parseTable({
    table,
    fileName: file.name,
    fileId: nextFileId(file.name),
    encoding,
  });
}

/** 여러 파일 → 교차 dedup된 레코드 집합. 마켓 섞여도 됨. */
export function ingestFiles(files: RawFile[]): IngestResult {
  const perFile: ParseResult[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();
  const records: SalesRecord[] = [];

  for (const file of files) {
    const result = ingestOne(file);
    perFile.push(result);
    issues.push(...result.issues);
    for (const rec of result.records) {
      if (seen.has(rec.orderItemId)) continue; // 파일 간 중복도 제거
      seen.add(rec.orderItemId);
      records.push(rec);
    }
  }

  return { records, perFile, issues };
}
