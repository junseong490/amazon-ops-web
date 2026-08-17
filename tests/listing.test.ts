// 리스팅 진단기 유닛테스트 (plan.md §15.7 "Vitest 골든 케이스").
// 순수 analyze/* 만 검증 — 기존 core/tests는 손대지 않는다.
import { describe, expect, it } from 'vitest';
import { utf8ByteLength, codePointLength } from '../src/features/listing/analyze/byteLen';
import { checkBackendBytes, checkTitle } from '../src/features/listing/analyze/seoChecks';
import { checkSpecConsistency } from '../src/features/listing/analyze/aeoChecks';
import { runAudit } from '../src/features/listing/analyze/runAudit';
import { MARKET_RULES } from '../src/features/listing/rules/marketRules';
import type { ListingInput, Market } from '../src/features/listing/types';

function input(partial: Partial<ListingInput> = {}): ListingInput {
  return {
    market: 'US',
    title: '',
    bullets: ['', '', '', '', ''],
    backendSearchTerms: '',
    description: '',
    targetKeywords: [],
    ...partial,
  };
}

describe('byteLen — UTF-8 실제 바이트', () => {
  it('ASCII는 1바이트/문자, .length와 일치', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('a'.repeat(249))).toBe(249);
  });

  it('일본어는 문자당 3바이트 — TextEncoder 실측과 대조', () => {
    // 'あ'(U+3042) = E3 81 82 = 3바이트. .length(UTF-16)는 1이지만 바이트는 3.
    expect('あ'.length).toBe(1);
    expect(utf8ByteLength('あ')).toBe(3);
    expect(utf8ByteLength('あいう')).toBe(9);
    // 표준 TextEncoder 결과와 정확히 일치해야 한다.
    const s = 'テストキーワード商品';
    expect(utf8ByteLength(s)).toBe(new TextEncoder().encode(s).length);
    expect(utf8ByteLength(s)).toBe(30); // 10자 × 3바이트
    // 이모지(서로게이트 페어)는 코드포인트 1자·4바이트.
    expect(codePointLength('😀')).toBe(1);
    expect(utf8ByteLength('😀')).toBe(4);
  });
});

describe('S3 — 백엔드 바이트 한도 경계값 (US 249)', () => {
  const rule = MARKET_RULES.US;

  it('한도-1(248B): fail 아님', () => {
    const r = checkBackendBytes(input({ backendSearchTerms: 'a'.repeat(248) }), rule);
    expect(utf8ByteLength('a'.repeat(248))).toBe(248);
    expect(r.level).not.toBe('fail');
  });

  it('정확히 한도(249B): fail 아님', () => {
    const r = checkBackendBytes(input({ backendSearchTerms: 'a'.repeat(249) }), rule);
    expect(r.level).not.toBe('fail');
  });

  it('한도+1(250B): fail + 비인덱싱 위험 문구', () => {
    const r = checkBackendBytes(input({ backendSearchTerms: 'a'.repeat(250) }), rule);
    expect(r.level).toBe('fail');
    expect(r.detail).toContain('250바이트');
    expect(r.detail).toContain('비인덱싱');
    expect(r.detail).toContain('1바이트 초과');
  });

  it('일본어 JP 한도(500B) 초과 감지 — 문자당 3바이트', () => {
    const jp = 'あ'.repeat(167); // 501바이트 > 500
    expect(utf8ByteLength(jp)).toBe(501);
    const r = checkBackendBytes(input({ market: 'JP', backendSearchTerms: jp }), MARKET_RULES.JP);
    expect(r.level).toBe('fail');
    // 이중 카운터: 문자 수와 바이트 수를 둘 다 표기.
    expect(r.detail).toContain('167자');
    expect(r.detail).toContain('501바이트');
  });
});

describe('S1 — 타이틀 75자 경계', () => {
  const rule = MARKET_RULES.US;

  it('정확히 75자: fail 아님(pass)', () => {
    const t = 'a'.repeat(75);
    const r = checkTitle(input({ title: t }), rule);
    expect(codePointLength(t)).toBe(75);
    expect(r.level).toBe('pass');
  });

  it('76자: fail + 초과 수치', () => {
    const r = checkTitle(input({ title: 'a'.repeat(76) }), rule);
    expect(r.level).toBe('fail');
    expect(r.detail).toContain('1자 초과');
  });
});

describe('A2 — 필드 간 스펙 불일치 감지', () => {
  it('타이틀 500ml ↔ 불릿 450ml → warn', () => {
    const r = checkSpecConsistency(
      input({
        title: '보온병 500ml 스테인리스',
        bullets: ['용량 450ml 대용량', '', '', '', ''],
      }),
    );
    expect(r.level).toBe('warn');
    expect(r.detail).toContain('500');
    expect(r.detail).toContain('450');
  });

  it('스펙이 일치하면 warn 아님', () => {
    const r = checkSpecConsistency(
      input({ title: '보온병 500ml', bullets: ['용량 500ml', '', '', '', ''] }),
    );
    expect(r.level).not.toBe('warn');
  });
});

describe('SEO/AEO 점수 미합산 — 별도 필드·독립 산출', () => {
  it('seo/aeo는 별도 배열, S3가 SEO 최상단', () => {
    const rep = runAudit(input({ backendSearchTerms: 'a'.repeat(250) }));
    expect(Array.isArray(rep.seo)).toBe(true);
    expect(Array.isArray(rep.aeo)).toBe(true);
    expect(rep.seo).not.toBe(rep.aeo);
    expect(rep.seo[0].id).toBe('S3'); // 최우선/최상단 고정
    expect(rep.aeo.every((c) => c.layer === 'AEO')).toBe(true);
    expect(rep.seo.every((c) => c.layer === 'SEO')).toBe(true);
  });

  it('SEO fail이 있어도 aeoScore는 독립(합산 안 함)', () => {
    // 백엔드 초과(SEO fail) + AEO는 깨끗 → seoScore<100, aeoScore=100.
    const base = input({ backendSearchTerms: 'a'.repeat(250) });
    const rep = runAudit(base);
    expect(rep.seoScore).toBeLessThan(100);
    expect(rep.aeoScore).toBe(100);

    // 설명에만 모호어를 추가 → AEO warn 유발(SEO 필드는 불변).
    const withVague = runAudit({
      ...base,
      description: 'best amazing premium ultimate widget',
    });
    // SEO 점수는 그대로(합산이면 바뀌었을 것) — 독립 증명.
    expect(withVague.seoScore).toBe(rep.seoScore);
    // AEO 점수만 내려간다.
    expect(withVague.aeoScore).toBeLessThan(rep.aeoScore);
  });
});

// 마켓별 규칙이 상수 1곳에서만 전환되는지(확장성).
describe('마켓 규칙 전환', () => {
  it('US=249B / JP=500B', () => {
    const markets: Market[] = ['US', 'JP'];
    expect(markets.map((m) => MARKET_RULES[m].backendByteMax)).toEqual([249, 500]);
  });
});
