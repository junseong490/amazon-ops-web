// SEO 하드 규칙 체크 S1~S6 (plan.md §15.4) — 전부 순수 함수, I/O 없음.
// 모든 메시지는 구체 수치 + 다음 행동(fix)을 반드시 포함한다("너무 김" 같은 모호 문구 금지).
import type { CheckResult, ListingInput, MarketRule } from '../types';
import { codePointLength, utf8ByteLength } from './byteLen';
import { STOPWORDS } from './dictionaries';

const SEO = 'SEO' as const;

// 프론트 노출 필드(타이틀+불릿) 토큰화. 소문자·불용어 제거·2자 미만 제거.
function tokenize(text: string, market: ListingInput['market']): string[] {
  const stop = STOPWORDS[market];
  return text
    .toLowerCase()
    .split(/[\s,、。・:;/|()[\]{}"']+/u)
    .map((t) => t.replace(/[.!?]+$/u, ''))
    .filter((t) => t.length >= 2 && !stop.has(t));
}

function entered(bullets: string[]): { text: string; index: number }[] {
  return bullets
    .map((b, index) => ({ text: b.trim(), index }))
    .filter((b) => b.text.length > 0);
}

// (S1) 타이틀 길이 — 코드포인트 기준(이모지 1자).
export function checkTitle(input: ListingInput, rule: MarketRule): CheckResult {
  const title = input.title.trim();
  const len = codePointLength(title);
  const base = `타이틀 ${len}자 · 한도 ${rule.titleMax}자`;
  if (len === 0) {
    return {
      id: 'S1',
      layer: SEO,
      level: 'warn',
      title: '타이틀 길이',
      detail: '타이틀 미작성 — 검색 노출의 핵심 필드가 비어 있음',
      fix: `핵심 키워드를 앞쪽에 배치해 ${rule.titleMax}자 이내로 작성하세요.`,
    };
  }
  if (len > rule.titleMax) {
    return {
      id: 'S1',
      layer: SEO,
      level: 'fail',
      title: '타이틀 길이',
      detail: `${base} · ${len - rule.titleMax}자 초과 — 잘려 노출될 수 있음`,
      fix: `${len - rule.titleMax}자를 줄여 ${rule.titleMax}자 이하로 맞추세요.`,
    };
  }
  if (len < rule.titleMax * 0.5) {
    return {
      id: 'S1',
      layer: SEO,
      level: 'warn',
      title: '타이틀 길이',
      detail: `${base} · 한도의 ${Math.round((len / rule.titleMax) * 100)}%만 사용 — 키워드 기회 손실`,
      fix: `핵심 키워드·속성을 더해 ${Math.ceil(rule.titleMax * 0.5)}자 이상으로 보강하세요.`,
    };
  }
  return {
    id: 'S1',
    layer: SEO,
    level: 'pass',
    title: '타이틀 길이',
    detail: `${base} · 적정`,
  };
}

// (S2) 불릿 개수·길이. 입력된 칸만 검사, 빈 칸은 info 1건으로 요약.
export function checkBullets(input: ListingInput, rule: MarketRule): CheckResult[] {
  const results: CheckResult[] = [];
  const list = entered(input.bullets);
  const emptyCount = input.bullets.length - list.length;

  if (list.length > rule.bulletMax) {
    results.push({
      id: 'S2-count',
      layer: SEO,
      level: 'warn',
      title: '불릿 개수',
      detail: `불릿 ${list.length}개 입력 · 한도 ${rule.bulletMax}개 — ${list.length - rule.bulletMax}개는 미노출 가정`,
      fix: `상위 ${rule.bulletMax}개에 핵심 정보를 몰아넣으세요.`,
    });
  }

  list.forEach((b, i) => {
    const len = codePointLength(b.text);
    if (len > rule.bulletCharMax) {
      results.push({
        id: `S2-b${b.index + 1}`,
        layer: SEO,
        level: 'fail',
        title: `불릿 ${b.index + 1} 길이`,
        detail: `${len}자 · 한도 ${rule.bulletCharMax}자 · ${len - rule.bulletCharMax}자 초과 — 절단 가정`,
        fix: `${len - rule.bulletCharMax}자를 줄여 ${rule.bulletCharMax}자 이하로.`,
      });
    } else if (len < rule.bulletCharMin) {
      results.push({
        id: `S2-b${b.index + 1}`,
        layer: SEO,
        level: 'warn',
        title: `불릿 ${b.index + 1} 길이`,
        detail: `${len}자 · 하한 ${rule.bulletCharMin}자 미만 — 부실`,
        fix: `속성·수치를 더해 ${rule.bulletCharMin}자 이상으로 보강하세요.`,
      });
    } else if (i === 0) {
      // 대표 pass 1건만(중복 나열 방지).
      results.push({
        id: 'S2',
        layer: SEO,
        level: 'pass',
        title: '불릿 길이',
        detail: `입력된 불릿 ${list.length}개 모두 ${rule.bulletCharMin}~${rule.bulletCharMax}자 적정`,
      });
    }
  });

  if (list.length === 0) {
    results.push({
      id: 'S2',
      layer: SEO,
      level: 'warn',
      title: '불릿',
      detail: '불릿 미작성 — 5개 모두 비어 있음',
      fix: `핵심 셀링포인트 ${rule.bulletMax}개를 각 ${rule.bulletCharMin}자 이상 작성하세요.`,
    });
  } else if (emptyCount > 0) {
    results.push({
      id: 'S2-empty',
      layer: SEO,
      level: 'info',
      title: '빈 불릿',
      detail: `${emptyCount}개 미작성 — 노출 기회 손실`,
      fix: `남은 ${emptyCount}칸에도 속성·용도·호환성을 채우세요.`,
    });
  }

  return results;
}

// (S3) 백엔드 검색어 바이트 한도 ★최우선. 항상 "N자 · Mbyte / 한도 Kbyte" 이중 표기.
export function checkBackendBytes(input: ListingInput, rule: MarketRule): CheckResult {
  const terms = input.backendSearchTerms;
  const bytes = utf8ByteLength(terms);
  const chars = codePointLength(terms);
  const max = rule.backendByteMax;
  const counter = `문자 ${chars}자 · ${bytes}바이트 / 한도 ${max}바이트`;

  if (bytes > max) {
    return {
      id: 'S3',
      layer: SEO,
      level: 'fail',
      title: '백엔드 검색어 바이트',
      detail: `${counter} · ${bytes - max}바이트 초과 → 이 필드 전체가 아마존 검색에서 조용히 제외될 수 있음(비인덱싱 위험)`,
      fix: `초과분을 삭제해 ${max}바이트 이하로. (일본어는 문자당 3바이트—몇 자만 줄여도 크게 감소)`,
    };
  }
  if (bytes > max * 0.95) {
    return {
      id: 'S3',
      layer: SEO,
      level: 'warn',
      title: '백엔드 검색어 바이트',
      detail: `${counter} · 한도의 ${Math.round((bytes / max) * 100)}% 사용 — 여유 부족`,
      fix: `추가 키워드 여지가 적습니다. 중복·프론트 단어를 빼 바이트를 확보하세요.`,
    };
  }
  if (terms.trim().length === 0) {
    return {
      id: 'S3',
      layer: SEO,
      level: 'info',
      title: '백엔드 검색어 바이트',
      detail: `${counter} · 미작성 — 검색 키워드 보강 기회`,
      fix: `프론트에 없는 동의어·연관어를 ${max}바이트 이내로 채우세요.`,
    };
  }
  return {
    id: 'S3',
    layer: SEO,
    level: 'pass',
    title: '백엔드 검색어 바이트',
    detail: `${counter} · 여유 ${max - bytes}바이트`,
  };
}

// 프론트 노출 필드 합본(타이틀 + 입력된 불릿).
function frontText(input: ListingInput): string {
  return [input.title, ...input.bullets].join(' ');
}

// (S4) 목표 키워드 포함 여부 — 대소문자·공백 정규화 후 프론트 필드 검사.
export function checkKeywordCoverage(input: ListingInput, _rule: MarketRule): CheckResult {
  const kws = input.targetKeywords.map((k) => k.trim()).filter(Boolean);
  if (kws.length === 0) {
    return {
      id: 'S4',
      layer: SEO,
      level: 'info',
      title: '목표 키워드 포함',
      detail: '목표 키워드 미입력 — 검사 건너뜀',
      fix: '노리는 키워드를 입력하면 프론트 필드 포함 여부를 진단합니다.',
    };
  }
  const front = frontText(input).toLowerCase().replace(/\s+/g, ' ');
  const missing = kws.filter((k) => !front.includes(k.toLowerCase().replace(/\s+/g, ' ')));
  if (missing.length === 0) {
    return {
      id: 'S4',
      layer: SEO,
      level: 'pass',
      title: '목표 키워드 포함',
      detail: `목표 키워드 ${kws.length}개 모두 타이틀·불릿에 포함`,
    };
  }
  return {
    id: 'S4',
    layer: SEO,
    level: 'warn',
    title: '목표 키워드 포함',
    detail: `${missing.length}/${kws.length}개 미포함: ${missing.map((k) => `'${k}'`).join(', ')} — 타이틀·불릿 어디에도 없음`,
    fix: '누락 키워드를 프론트 노출 필드에 최소 1회 넣으세요(백엔드보다 프론트가 우선).',
  };
}

// (S5) 키워드 스터핑 감지 — 프론트 필드 내 동일 토큰 과도 반복.
export function checkStuffing(input: ListingInput, rule: MarketRule): CheckResult {
  const offenders: string[] = [];

  const titleTokens = tokenize(input.title, input.market);
  const titleCount = new Map<string, number>();
  for (const t of titleTokens) titleCount.set(t, (titleCount.get(t) ?? 0) + 1);
  for (const [word, n] of titleCount) {
    if (n > rule.stuffingTitleMax) offenders.push(`타이틀 '${word}' ${n}회`);
  }

  const bulletTokens = tokenize(input.bullets.join(' '), input.market);
  const bulletCount = new Map<string, number>();
  for (const t of bulletTokens) bulletCount.set(t, (bulletCount.get(t) ?? 0) + 1);
  for (const [word, n] of bulletCount) {
    if (n > rule.stuffingBulletMax) offenders.push(`불릿 '${word}' ${n}회`);
  }

  if (offenders.length === 0) {
    return {
      id: 'S5',
      layer: SEO,
      level: 'pass',
      title: '키워드 스터핑',
      detail: '과도 반복 토큰 없음 — 적정',
    };
  }
  return {
    id: 'S5',
    layer: SEO,
    level: 'warn',
    title: '키워드 스터핑',
    detail: `${offenders.join(', ')} 반복 — 스터핑 판정 시 역효과`,
    fix: '동의어·연관어로 분산하세요(같은 단어 반복은 순위에 도움 안 됨).',
  };
}

// (S6) 백엔드↔프론트 중복 — 프론트에 이미 있는 단어는 백엔드에서 바이트 낭비.
export function checkBackendOverlap(input: ListingInput, _rule: MarketRule): CheckResult {
  const backendTokens = new Set(tokenize(input.backendSearchTerms, input.market));
  if (backendTokens.size === 0) {
    return {
      id: 'S6',
      layer: SEO,
      level: 'info',
      title: '백엔드↔프론트 중복',
      detail: '백엔드 검색어 미작성 — 검사 건너뜀',
    };
  }
  const frontTokens = new Set(tokenize(frontText(input), input.market));
  const dup = [...backendTokens].filter((t) => frontTokens.has(t));
  if (dup.length === 0) {
    return {
      id: 'S6',
      layer: SEO,
      level: 'pass',
      title: '백엔드↔프론트 중복',
      detail: '백엔드 검색어가 프론트와 겹치지 않음 — 바이트 효율 양호',
    };
  }
  return {
    id: 'S6',
    layer: SEO,
    level: 'warn',
    title: '백엔드↔프론트 중복',
    detail: `${dup.map((w) => `'${w}'`).join(', ')}는 이미 타이틀/불릿에 있음 — 백엔드 바이트 낭비`,
    fix: '프론트에 있는 단어는 백엔드에서 빼고, 없는 동의어·연관어로 채우세요(S3 바이트 확보).',
  };
}

// S1~S6를 순서대로 실행. ★ S3(백엔드 바이트)를 최상단에 고정한다.
export function runSeoChecks(input: ListingInput, rule: MarketRule): CheckResult[] {
  return [
    checkBackendBytes(input, rule), // S3 ★ 최우선/최상단
    checkTitle(input, rule), // S1
    ...checkBullets(input, rule), // S2
    checkKeywordCoverage(input, rule), // S4
    checkStuffing(input, rule), // S5
    checkBackendOverlap(input, rule), // S6
  ];
}
