// 인코딩 디코드: UTF-8 우선, mojibake 감지 시 Shift_JIS(CP932) 폴백 (LOCKED §3, review §1.4).
// ASCII 컬럼(sku/asin/금액/날짜)은 인코딩과 무관하게 항상 정상 파싱되어야 한다.

export interface DecodeResult {
  text: string;
  encoding: 'utf-8' | 'shift_jis';
}

/** U+FFFD(치환문자) 존재 = UTF-8 디코드 실패 징후 */
function hasReplacementChar(s: string): boolean {
  return s.includes('�');
}

/**
 * 바이트 버퍼를 디코드한다.
 * 1) UTF-8(fatal)로 시도 → 성공하면 utf-8.
 * 2) 실패(치환문자/예외) 시 Shift_JIS로 재디코드 → shift_jis.
 * 3) Shift_JIS도 실패하면 UTF-8 관용 디코드 결과를 반환(품목 라벨은 parse에서 SKU 폴백).
 */
export function decodeBytes(bytes: Uint8Array): DecodeResult {
  // 1) UTF-8 엄격 시도
  try {
    const strict = new TextDecoder('utf-8', { fatal: true });
    const text = strict.decode(bytes);
    if (!hasReplacementChar(text)) {
      return { text, encoding: 'utf-8' };
    }
  } catch {
    // fall through to shift_jis
  }

  // 2) Shift_JIS 폴백
  try {
    const sjis = new TextDecoder('shift_jis', { fatal: false });
    const text = sjis.decode(bytes);
    if (!hasReplacementChar(text)) {
      return { text, encoding: 'shift_jis' };
    }
  } catch {
    // fall through
  }

  // 3) 최후: UTF-8 관용 디코드 (일부 라벨 손상 가능 → parse에서 SKU 폴백)
  const lenient = new TextDecoder('utf-8', { fatal: false });
  return { text: lenient.decode(bytes), encoding: 'utf-8' };
}
