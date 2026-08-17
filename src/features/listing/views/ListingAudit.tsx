// 리스팅 진단기 메인 뷰 (plan.md §15.6 와이어프레임).
// 좌 입력 / 우 결과 2단. macOS 라이트 토큰(화이트 카드·라운드스퀘어 배지·그림자 입체감).
// SEO=파랑 배지, AEO/GEO=보라 배지로 층을 색으로 구분. 결과 영역만 내부 스크롤.
import { useMemo, useState } from 'react';
import { MARKET_LABEL, RULES_DISCLAIMER, MARKET_RULES } from '../rules/marketRules';
import { runAudit } from '../analyze/runAudit';
import { utf8ByteLength, codePointLength } from '../analyze/byteLen';
import type { CheckResult, ListingInput, Market } from '../types';
import { CheckRow } from './CheckRow';

const EMPTY: ListingInput = {
  market: 'US',
  title: '',
  bullets: ['', '', '', '', ''],
  backendSearchTerms: '',
  description: '',
  targetKeywords: [],
};

const MARKETS: Market[] = ['US', 'JP'];

// 층 헤더(SEO=파랑 / AEO=보라) — 카드 상단 배지.
function LayerHeader({
  color,
  label,
  score,
  caption,
}: {
  color: string;
  label: string;
  score: number;
  caption?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px' }}>
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px -4px rgba(20, 20, 50, 0.28)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--fs-16)', color: 'var(--ink)' }}>{label}</div>
        {caption && <div style={{ fontSize: 'var(--fs-11)', color: 'var(--ink-secondary)' }}>{caption}</div>}
      </div>
      <span
        title="종합 점수(배지 우선·점수 보조)"
        style={{
          fontSize: 'var(--fs-12)',
          fontWeight: 700,
          color: 'var(--ink-secondary)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)',
          padding: '3px 10px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {score}/100
      </span>
    </div>
  );
}

function ResultCard({
  color,
  label,
  score,
  caption,
  checks,
}: {
  color: string;
  label: string;
  score: number;
  caption?: string;
  checks: CheckResult[];
}) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--e2)',
        marginBottom: 'var(--sp-4)',
        overflow: 'hidden',
      }}
    >
      <LayerHeader color={color} label={label} score={score} caption={caption} />
      <div>
        {checks.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </div>
    </div>
  );
}

export function ListingAudit() {
  const [input, setInput] = useState<ListingInput>(EMPTY);
  const [ran, setRan] = useState(false);
  const [keywordText, setKeywordText] = useState('');

  const rule = MARKET_RULES[input.market];
  const report = useMemo(() => runAudit(input), [input]);

  // 백엔드 검색어 라이브 이중 카운터(입력 중 즉시 갱신).
  const backendBytes = utf8ByteLength(input.backendSearchTerms);
  const backendChars = codePointLength(input.backendSearchTerms);
  const overBudget = backendBytes > rule.backendByteMax;

  const setField = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) =>
    setInput((s) => ({ ...s, [key]: value }));

  const setBullet = (i: number, value: string) =>
    setInput((s) => ({ ...s, bullets: s.bullets.map((b, idx) => (idx === i ? value : b)) }));

  // 콤마/줄바꿈 분리 → targetKeywords.
  const onKeywords = (text: string) => {
    setKeywordText(text);
    setField(
      'targetKeywords',
      text
        .split(/[\n,]+/)
        .map((k) => k.trim())
        .filter(Boolean),
    );
  };

  return (
    <>
      {/* 상단 바: 마켓 토글 + 신뢰도 배너 */}
      <div className="panel" style={{ marginBottom: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, border: 0, padding: 0 }}>리스팅 진단 (SEO · AEO/GEO)</h2>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }} role="group" aria-label="마켓 선택">
            {MARKETS.map((m) => {
              const active = input.market === m;
              return (
                <button
                  key={m}
                  className={active ? 'btn btn-accent' : 'btn'}
                  aria-pressed={active}
                  onClick={() => setField('market', m)}
                >
                  {MARKET_LABEL[m]}
                </button>
              );
            })}
          </div>
        </div>
        <p className="muted" style={{ fontSize: 'var(--fs-12)', marginBottom: 0, marginTop: 10 }}>
          규칙 출처: 셀러 커뮤니티 + Seller Central 공지 혼합(1차 공식 아님) · <strong>{RULES_DISCLAIMER}</strong>
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.08fr)',
          gap: 'var(--sp-4)',
          alignItems: 'start',
        }}
      >
        {/* 좌: 입력 카드 */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>입력</h2>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>타이틀 (한도 {rule.titleMax}자)</label>
            <input
              type="text"
              value={input.title}
              placeholder="예: 스테인리스 텀블러 500ml 진공 보온병 커피"
              onChange={(e) => setField('title', e.target.value)}
            />
            <span className="muted" style={{ fontSize: 'var(--fs-11)' }}>
              {codePointLength(input.title)}자 / {rule.titleMax}자
            </span>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>불릿 (최대 {rule.bulletMax}개 · 각 {rule.bulletCharMin}~{rule.bulletCharMax}자)</label>
            {input.bullets.map((b, i) => (
              <input
                key={i}
                type="text"
                value={b}
                aria-label={`불릿 ${i + 1}`}
                placeholder={`불릿 ${i + 1}`}
                onChange={(e) => setBullet(i, e.target.value)}
                style={{ marginBottom: 6 }}
              />
            ))}
          </div>

          <div className="field" style={{ marginBottom: 4 }}>
            <label>백엔드 검색어 (바이트 한도 {rule.backendByteMax}B · UTF-8)</label>
            <textarea
              value={input.backendSearchTerms}
              rows={3}
              placeholder="프론트에 없는 동의어·연관어(공백 구분)"
              onChange={(e) => setField('backendSearchTerms', e.target.value)}
            />
          </div>
          {/* 라이브 이중 카운터 — 초과 시 강조 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--fs-12)',
              fontWeight: 700,
              marginBottom: 12,
              color: overBudget ? 'var(--danger)' : 'var(--ink-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            문자 {backendChars}자 · {backendBytes}바이트 / 한도 {rule.backendByteMax}바이트
            {overBudget && <span>· {backendBytes - rule.backendByteMax}B 초과 · 비인덱싱 위험</span>}
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>설명 (선택 · AEO/GEO)</label>
            <textarea
              value={input.description ?? ''}
              rows={3}
              placeholder="사용법·호환성·규격에 답하는 문장을 넣으면 AI 인용에 유리"
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>목표 키워드 (콤마/줄바꿈 구분)</label>
            <textarea
              value={keywordText}
              rows={2}
              placeholder="예: 텀블러, 보온병, 진공"
              onChange={(e) => onKeywords(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setRan(true)}>
            진단하기
          </button>
        </div>

        {/* 우: 결과(내부 스크롤) */}
        <div
          style={{
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {!ran ? (
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="empty" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
                <div className="empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <div className="empty-title">진단 대기 중</div>
                <div className="empty-sub">
                  타이틀·불릿·백엔드 검색어를 입력하고 <strong>진단하기</strong>를 누르면 {MARKET_LABEL[input.market]}{' '}
                  규칙으로 SEO·AEO/GEO를 즉시 진단합니다.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* SEO 블록 — 파랑 배지, S3 최상단 고정 */}
              <ResultCard
                color="var(--grad-blue)"
                label="SEO — 검색 인덱싱 (하드 규칙)"
                score={report.seoScore}
                caption="한도 초과는 실제 노출 손실 — 반드시 고쳐야 함"
                checks={report.seo}
              />
              {/* AEO/GEO 블록 — 보라 배지, 권장 캡션 */}
              <ResultCard
                color="linear-gradient(150deg, #a98bff, #7b5cff)"
                label="AEO / GEO — AI 답변엔진 인용 친화도"
                score={report.aeoScore}
                caption="권장 · 공식 규정 아님 (SEO 점수와 합산하지 않음)"
                checks={report.aeo}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
