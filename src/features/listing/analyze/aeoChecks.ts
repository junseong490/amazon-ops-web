// AEO/GEO 권장사항 체크 A1~A3 (plan.md §15.5) — 전부 순수 함수, I/O 없음.
// ★ 공식 규정 아님(신흥 베스트프랙티스). fail 없음 — info/warn 톤만. SEO와 합산 금지.
import type { CheckResult, ListingInput } from '../types';
import { FAQ_SIGNALS, SPEC_PATTERN, VAGUE_ADJECTIVES, canonicalUnit } from './dictionaries';

const AEO = 'AEO' as const;

// 정규식 전역 매칭(lastIndex 오염 방지 위해 매 호출 새 RegExp).
function matchSpecs(text: string): { value: string; unit: string }[] {
  const re = new RegExp(SPEC_PATTERN.source, 'gi');
  const out: { value: string; unit: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ value: m[1].replace(',', '.'), unit: canonicalUnit(m[2]) });
  }
  return out;
}

// (A1) 모호한 마케팅 문구 vs 구체적 사실. 구체 신호가 적고 모호어가 많으면 warn.
export function checkVagueness(input: ListingInput): CheckResult {
  const text = [...input.bullets, input.description ?? ''].join('\n');
  const lower = text.toLowerCase();
  const dict = VAGUE_ADJECTIVES[input.market];
  let vagueHits = 0;
  const hitWords: string[] = [];
  for (const w of dict) {
    const wl = w.toLowerCase();
    const escaped = wl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isAscii = [...wl].every((ch) => ch.charCodeAt(0) < 128);
    // 영어는 단어 경계, 일본어는 부분 문자열(경계 개념 약함).
    const re = isAscii ? new RegExp(`\\b${escaped}\\b`, 'g') : new RegExp(escaped, 'g');
    const n = (lower.match(re) ?? []).length;
    if (n > 0) {
      vagueHits += n;
      hitWords.push(w);
    }
  }
  const concrete = matchSpecs(text).length;

  if (vagueHits === 0) {
    return {
      id: 'A1',
      layer: AEO,
      level: 'pass',
      title: '구체성 (모호 표현)',
      detail: `모호 형용사 0회 · 구체 스펙 신호 ${concrete}건 — 인용 친화적`,
    };
  }
  if (vagueHits >= 3 && concrete < vagueHits) {
    return {
      id: 'A1',
      layer: AEO,
      level: 'warn',
      title: '구체성 (모호 표현)',
      detail: `모호 형용사 ${vagueHits}회(${hitWords.slice(0, 4).join(', ')}) vs 구체 스펙 ${concrete}건 — 주관적 표현 위주`,
      fix: 'AI는 재질·크기·수량·호환성 같은 인용 가능한 사실을 선호합니다. 구체 스펙 문장을 추가하세요.',
    };
  }
  return {
    id: 'A1',
    layer: AEO,
    level: 'info',
    title: '구체성 (모호 표현)',
    detail: `모호 형용사 ${vagueHits}회(${hitWords.slice(0, 4).join(', ')}) · 구체 스펙 ${concrete}건`,
    fix: '모호 표현 옆에 수치·규격을 덧붙이면 AI 인용 확률이 올라갑니다.',
  };
}

// (A2) 필드 간 스펙 불일치 — 같은 단위인데 값이 다르면 warn. 매칭 못 한 건 조용히 skip(오탐 방지).
export function checkSpecConsistency(input: ListingInput): CheckResult {
  const text = [input.title, ...input.bullets, input.description ?? ''].join('\n');
  const specs = matchSpecs(text);
  const byUnit = new Map<string, Set<string>>();
  for (const s of specs) {
    if (!byUnit.has(s.unit)) byUnit.set(s.unit, new Set());
    byUnit.get(s.unit)!.add(s.value);
  }
  const conflicts: string[] = [];
  for (const [unit, values] of byUnit) {
    if (values.size > 1) {
      conflicts.push(`${[...values].map((v) => `${v}${unit}`).join(' ↔ ')}`);
    }
  }
  if (specs.length === 0) {
    return {
      id: 'A2',
      layer: AEO,
      level: 'info',
      title: '스펙 일관성',
      detail: '추출 가능한 수치+단위 스펙 없음 — 검사 건너뜀',
      fix: '용량·개수·크기 같은 규격을 명시하면 AI 인용에 유리합니다.',
    };
  }
  if (conflicts.length === 0) {
    return {
      id: 'A2',
      layer: AEO,
      level: 'pass',
      title: '스펙 일관성',
      detail: `수치 스펙 ${specs.length}건 · 필드 간 모순 없음`,
    };
  }
  return {
    id: 'A2',
    layer: AEO,
    level: 'warn',
    title: '스펙 일관성',
    detail: `필드 간 스펙 불일치: ${conflicts.join(', ')} — AI가 모순 정보를 만나면 신뢰도를 낮게 평가`,
    fix: '타이틀·불릿·설명의 수치를 하나로 통일하세요.',
  };
}

// (A3) FAQ성 문장 존재 여부 — 설명에 질문에 답하는 형태가 있는지. 순수 권장이라 info 톤.
export function checkFaqPresence(input: ListingInput): CheckResult {
  const desc = (input.description ?? '').trim();
  if (desc.length === 0) {
    return {
      id: 'A3',
      layer: AEO,
      level: 'info',
      title: 'FAQ성 문장',
      detail: '설명 미작성 — 자주 묻는 질문에 답하는 문장을 넣을 여지',
      fix: '호환성·사용법·규격에 답하는 문장을 설명에 추가하면 AI 답변 인용 확률이 올라갑니다.',
    };
  }
  const hit = FAQ_SIGNALS.some((re) => re.test(desc));
  if (hit) {
    return {
      id: 'A3',
      layer: AEO,
      level: 'pass',
      title: 'FAQ성 문장',
      detail: '설명에 질문·답변성 문장 신호 있음 — AI 인용 친화적',
    };
  }
  return {
    id: 'A3',
    layer: AEO,
    level: 'info',
    title: 'FAQ성 문장',
    detail: '설명에 FAQ성(호환성·사용법·규격 응답) 문장 신호 없음',
    fix: '"무엇에 쓰나·호환되나·세척 방법" 같은 질문에 답하는 문장을 넣으세요.',
  };
}

export function runAeoChecks(input: ListingInput): CheckResult[] {
  return [checkVagueness(input), checkSpecConsistency(input), checkFaqPresence(input)];
}
