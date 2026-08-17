// 바이트/문자 길이 계산 — 순수 함수, I/O 없음 (plan.md §15.7).
// 백엔드 검색어의 "조용한 비인덱싱" 함정을 눈에 보이게 하는 핵심 유틸.
// 문자열 .length(UTF-16 코드유닛)는 절대 쓰지 않는다 — 실제 UTF-8 인코딩 바이트를 센다.
// (byteLen은 범용성이 있어 후일 core/text로 승격 여지 있음 — §15.8, 우선 feature-local.)

// 실제 UTF-8 인코딩 바이트 수. 이모지·서로게이트 페어까지 정확.
// 일본어(히라가나/가타카나/한자)는 문자당 3바이트 → "글자 여유 있어 보여도 초과" 함정 노출.
export function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

// 코드포인트 기준 문자 수(이모지 1자 처리). .length(UTF-16)와 달리 서로게이트 페어를 1자로 센다.
export function codePointLength(str: string): number {
  return [...str].length;
}
