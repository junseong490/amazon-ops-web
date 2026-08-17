// 오케스트레이터 (plan.md §15.7) — 순수 함수: ListingInput + rules → AuditReport.
// ★ SEO와 AEO/GEO는 별도 배열·별도 점수. 절대 합산하지 않는다(§15.5).
import { MARKET_RULES } from '../rules/marketRules';
import type { AuditReport, CheckResult, ListingInput } from '../types';
import { runAeoChecks } from './aeoChecks';
import { runSeoChecks } from './seoChecks';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// SEO 점수: 하드 규칙 → fail·warn을 강하게 감점(info는 감점 없음).
function scoreSeo(checks: CheckResult[]): number {
  let score = 100;
  for (const c of checks) {
    if (c.level === 'fail') score -= 30;
    else if (c.level === 'warn') score -= 10;
  }
  return clamp(score);
}

// AEO/GEO 점수: 권장 → warn만 가벼운 감점(fail 없음, info는 감점 없음). SEO와 독립.
function scoreAeo(checks: CheckResult[]): number {
  let score = 100;
  for (const c of checks) {
    if (c.level === 'warn') score -= 20;
  }
  return clamp(score);
}

export function runAudit(input: ListingInput): AuditReport {
  const rule = MARKET_RULES[input.market];
  const seo = runSeoChecks(input, rule);
  const aeo = runAeoChecks(input);
  return {
    market: input.market,
    seo,
    aeo,
    seoScore: scoreSeo(seo), // ← SEO 체크만으로 산출
    aeoScore: scoreAeo(aeo), // ← AEO 체크만으로 산출(합산 금지)
  };
}
