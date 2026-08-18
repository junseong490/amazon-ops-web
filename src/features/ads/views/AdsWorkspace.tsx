// 광고 최적화 오케스트레이터 — 업로드 → 효율표·권장입찰(§5c) → 검색어 제안(선택) →
// 왕복 XML 패치로 변경분만 반영한 벌크 xlsx 다운로드. 계산은 순수 코어, 여기선 조립만.
import { useMemo, useState } from 'react';
import type { AdWorkbook, BidParams } from '../types';
import { readWorkbook, WorkbookFormatError } from '../ingest/readWorkbook';
import { registeredKeywordSet, registeredNegativeSet } from '../parse/spCampaigns';
import { DEFAULT_BID_PARAMS, recommendBid, roundBid } from '../recommend/bid';
import { DEFAULT_SUGGEST_PARAMS, suggestFromSearchTerms } from '../recommend/searchTermSuggest';
import { patchWorkbook, type BidChange } from '../serialize/patchWorkbook';
import { downloadXlsx, editedFileName } from '../serialize/download';
import type { KeywordView } from './model';
import { AdsUpload } from './AdsUpload';
import { AdsParams } from './AdsParams';
import { KeywordTable } from './KeywordTable';
import { SearchTermPanel } from './SearchTermPanel';
import { ReviewDownload } from './ReviewDownload';

export function AdsWorkspace() {
  const [workbook, setWorkbook] = useState<AdWorkbook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<BidParams>(DEFAULT_BID_PARAMS);
  const [negativeClicks, setNegativeClicks] = useState(DEFAULT_SUGGEST_PARAMS.negativeCandidateClicks);
  const [userBidStr, setUserBidStr] = useState<Record<number, string>>({});
  const [acosStr, setAcosStr] = useState<Record<number, string>>({});
  const [selectedNew, setSelectedNew] = useState<Set<string>>(new Set());
  const [selectedNeg, setSelectedNeg] = useState<Set<string>>(new Set());
  const [genError, setGenError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdsTab>('bid');

  function handleFile(name: string, bytes: Uint8Array) {
    setError(null);
    setGenError(null);
    try {
      const wb = readWorkbook(name, bytes);
      setWorkbook(wb);
      setUserBidStr({});
      setAcosStr({});
      setSelectedNew(new Set());
      setSelectedNeg(new Set());
    } catch (e) {
      setWorkbook(null);
      setError(
        e instanceof WorkbookFormatError
          ? e.message
          : `파일을 읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // 권장 입찰·효율 파생(순수 코어 호출).
  const views = useMemo<KeywordView[]>(() => {
    if (!workbook) return [];
    const out: KeywordView[] = [];
    for (const r of workbook.rows) {
      if (!r.editable || r.metrics == null || r.currentBid == null) continue;
      const overrideStr = acosStr[r.rowIndex];
      const overridePct = overrideStr != null ? parseFloat(overrideStr) : NaN;
      const effTarget = Number.isFinite(overridePct) ? overridePct / 100 : params.targetAcos;
      const rec = recommendBid(r.metrics, r.currentBid, { ...params, targetAcos: effTarget });
      const userStr = userBidStr[r.rowIndex];
      const userNum = userStr != null && userStr !== '' ? parseFloat(userStr) : rec.newBid;
      const userBid = Number.isFinite(userNum) ? userNum : rec.newBid;
      const changed = roundBid(userBid, params.currency) !== roundBid(r.currentBid, params.currency);
      out.push({
        rowIndex: r.rowIndex,
        entity: r.entity === 'Product Targeting' ? 'Product Targeting' : 'Keyword',
        label: r.keywordText ?? r.targetingExpr ?? '',
        campaignName: r.campaignName ?? r.campaignId ?? '',
        adGroupName: r.adGroupName ?? r.adGroupId ?? '',
        matchType: r.matchType ?? '',
        metrics: r.metrics,
        currentBid: r.currentBid,
        effectiveTargetAcos: effTarget,
        recommendedBid: rec.newBid,
        reason: rec.reason,
        flags: rec.flags,
        userBid,
        changed,
      });
    }
    return out;
  }, [workbook, params, userBidStr, acosStr]);

  const suggestions = useMemo(() => {
    if (!workbook) return { newKeywords: [], negatives: [] };
    return suggestFromSearchTerms(
      {
        searchTerms: workbook.searchTerms,
        registeredKeywords: registeredKeywordSet(workbook.rows),
        registeredNegatives: registeredNegativeSet(workbook.rows),
      },
      {
        ...DEFAULT_SUGGEST_PARAMS,
        targetAcos: params.targetAcos,
        negativeCandidateClicks: negativeClicks,
        currency: params.currency,
      },
    );
  }, [workbook, params.targetAcos, params.currency, negativeClicks]);

  const bidChanges: BidChange[] = useMemo(
    () =>
      views
        .filter((v) => v.changed)
        .map((v) => ({ rowIndex: v.rowIndex, newBid: roundBid(v.userBid, params.currency) })),
    [views, params.currency],
  );

  const selectedNewList = suggestions.newKeywords.filter((k) => selectedNew.has(k.customerSearchTerm));
  const selectedNegList = suggestions.negatives.filter((n) => selectedNeg.has(n.customerSearchTerm));

  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function handleGenerate() {
    if (!workbook) return;
    setGenError(null);
    try {
      const out = patchWorkbook({
        workbook,
        bidChanges,
        newKeywords: selectedNewList.map((k) => ({
          campaignId: k.campaignId,
          adGroupId: k.adGroupId,
          keywordText: k.customerSearchTerm,
          matchType: k.matchType,
          bid: k.recommendedBid,
        })),
        negatives: selectedNegList.map((n) => ({
          campaignId: n.campaignId,
          adGroupId: n.adGroupId,
          keywordText: n.customerSearchTerm,
          matchType: n.matchType,
        })),
      });
      downloadXlsx(out, editedFileName(workbook.fileName));
    } catch (e) {
      setGenError(`벌크 생성 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <>
      <div className="panel">
        <h2>광고 벌크 업로드 (Sponsored Products)</h2>
        <AdsUpload onFile={handleFile} />
        {error && (
          <div className="empty" style={{ marginTop: 12 }}>
            <div className="empty-title">형식 인식 불가</div>
            <div className="empty-sub">{error}</div>
          </div>
        )}
        {workbook && (
          <div className="loaded-bar" style={{ marginTop: 12 }}>
            <span className="muted">
              <strong>{workbook.fileName}</strong> · 편집 대상 {views.length}개 · 검색어 {workbook.searchTerms.length}행
            </span>
            <button className="btn" onClick={() => { setWorkbook(null); setError(null); }}>
              초기화
            </button>
          </div>
        )}
        {workbook && workbook.warnings.length > 0 && (
          <ul className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 8 }}>
            {workbook.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
          </ul>
        )}
      </div>

      {workbook && (
        <>
          <AdsTabs active={tab} onChange={setTab} />

          {/* 탭 1 "입찰 조정": 파라미터 + 키워드 효율표. 언마운트하지 않고 display만 토글해 입력 상태 보존 */}
          <div style={{ display: tab === 'bid' ? undefined : 'none' }}>
            <AdsParams
              params={params}
              onChange={(patch) => setParams((p) => ({ ...p, ...patch }))}
              negativeCandidateClicks={negativeClicks}
              onNegativeClicksChange={setNegativeClicks}
            />
            <KeywordTable
              rows={views}
              userBidStr={userBidStr}
              acosStr={acosStr}
              onUserBid={(ri, v) => setUserBidStr((m) => ({ ...m, [ri]: v }))}
              onAcosOverride={(ri, v) => setAcosStr((m) => ({ ...m, [ri]: v }))}
            />
          </div>

          {/* 탭 2 "검색어 제안" */}
          <div style={{ display: tab === 'search' ? undefined : 'none' }}>
            <SearchTermPanel
              newKeywords={suggestions.newKeywords}
              negatives={suggestions.negatives}
              selectedNew={selectedNew}
              selectedNeg={selectedNeg}
              onToggleNew={(t) => setSelectedNew((s) => toggle(s, t))}
              onToggleNeg={(t) => setSelectedNeg((s) => toggle(s, t))}
              onSelectAllNew={(on) =>
                setSelectedNew(on ? new Set(suggestions.newKeywords.map((k) => k.customerSearchTerm)) : new Set())
              }
              onSelectAllNeg={(on) =>
                setSelectedNeg(on ? new Set(suggestions.negatives.map((n) => n.customerSearchTerm)) : new Set())
              }
              disabled={workbook.searchTerms.length === 0}
            />
          </div>

          {/* 탭 3 "검토·다운로드" */}
          <div style={{ display: tab === 'review' ? undefined : 'none' }}>
            <ReviewDownload
              bidChangeCount={bidChanges.length}
              newKeywordCount={selectedNewList.length}
              negativeCount={selectedNegList.length}
              onGenerate={handleGenerate}
              error={genError}
            />
          </div>
        </>
      )}
    </>
  );
}

type AdsTab = 'bid' | 'search' | 'review';

// 광고 화면 탭 전환용 세그먼트 컨트롤. 매출 화면(SalesTableTabs)과 동일한 방식/스타일 —
// index.css 불변 요구에 따라 전역 클래스 없이 로컬 인라인 스타일로만 구성.
function AdsTabs({
  active,
  onChange,
}: {
  active: AdsTab;
  onChange: (t: AdsTab) => void;
}) {
  const tabs: { id: AdsTab; label: string }[] = [
    { id: 'bid', label: '입찰 조정' },
    { id: 'search', label: '검색어 제안' },
    { id: 'review', label: '검토·다운로드' },
  ];
  return (
    <div
      role="tablist"
      aria-label="광고 작업 보기 전환"
      style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        padding: 4,
        marginBottom: 'var(--sp-4)',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        width: 'fit-content',
      }}
    >
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: '1px solid transparent',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: on ? 700 : 500,
              color: on ? 'var(--accent)' : 'var(--muted)',
              background: on ? 'var(--bg)' : 'transparent',
              boxShadow: on ? 'var(--e1)' : 'none',
              transition: 'color 120ms ease, background 120ms ease',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
