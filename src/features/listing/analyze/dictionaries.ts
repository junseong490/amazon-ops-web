// 사전·정규식 데이터 (plan.md §15.5·§15.7) — 데이터=코드 분리, 마켓별.
// 오탐 불가피 → 이 사전들은 "info~warn까지만"의 보수적 판정에 쓰인다(fail 없음).
import type { Market } from '../types';

// (A1) 모호한 마케팅 형용사 사전 — AI 답변엔진이 인용하기 어려운 주관적 표현.
export const VAGUE_ADJECTIVES: Record<Market, string[]> = {
  US: [
    'best',
    'amazing',
    'premium',
    'revolutionary',
    'ultimate',
    'perfect',
    'incredible',
    'stunning',
    'world-class',
    'top-quality',
    'high-quality',
    'luxurious',
    'innovative',
    'cutting-edge',
    'superior',
  ],
  JP: [
    '最高',
    '究極',
    '革新的',
    'プレミアム',
    '驚き',
    '素晴らしい',
    '完璧',
    '最先端',
    '高品質',
    '高級',
    '世界最高',
    '圧倒的',
  ],
};

// 스터핑/키워드 토큰화 시 제외할 불용어(마켓별). 일본어는 공백 분절이 약해 최소만.
export const STOPWORDS: Record<Market, Set<string>> = {
  US: new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'for',
    'with',
    'of',
    'to',
    'in',
    'on',
    'by',
    'is',
    'are',
    'this',
    'that',
    'your',
    'you',
    'it',
    'as',
    'at',
    'from',
  ]),
  JP: new Set(['の', 'は', 'が', 'を', 'に', 'と', 'も', 'で', 'や', 'へ']),
};

// (A1 구체 신호 / A2 스펙 추출) 숫자+단위 패턴. g 플래그 재사용 주의(호출부에서 lastIndex 관리).
// 값(숫자)과 단위를 캡처. 단위 동의어는 canonicalUnit에서 정규화.
export const SPEC_PATTERN =
  /(\d+(?:[.,]\d+)?)\s*(ml|l|kg|mg|g|mm|cm|m|inches|inch|인치|"|packs|pack|팩|개입|개|매|gb|tb|mah|w|v)/gi;

// 단위 동의어 → 표준 단위 키. 서로 다른 물리량이 섞이지 않도록 보수적으로 매핑.
export function canonicalUnit(raw: string): string {
  const u = raw.toLowerCase();
  switch (u) {
    case 'inch':
    case 'inches':
    case '인치':
    case '"':
      return 'inch';
    case 'pack':
    case 'packs':
    case '팩':
      return 'pack';
    case '개입':
    case '개':
      return 'count';
    default:
      return u;
  }
}

// (A3) FAQ성 문장 신호 — 질문에 답이 되는 형태 휴리스틱(마켓 공통 + 언어별).
export const FAQ_SIGNALS: RegExp[] = [
  /\?/,
  /？/,
  /how to\b/i,
  /compatible with\b/i,
  /can i\b/i,
  /what (is|are)\b/i,
  /인가요/,
  /하려면/,
  /합니까/,
  /방법/,
  /호환/,
  /세척/,
  /사용법/,
  /どうやって/,
  /互換/,
  /使い方/,
  /ですか/,
  /場合/,
];
