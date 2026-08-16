// 키워드/타겟 효율표 — 지표·현재입찰·권장입찰·수정입력·목표ACOS override·플래그.
import { useMemo, useState } from 'react';
import type { AdMetrics, BidFlag } from '../types';
import type { KeywordFilter, KeywordSort, KeywordView } from './model';

interface Props {
  rows: KeywordView[];
  userBidStr: Record<number, string>;
  acosStr: Record<number, string>;
  onUserBid: (rowIndex: number, value: string) => void;
  onAcosOverride: (rowIndex: number, value: string) => void;
}

function money(n: number | null): string {
  return n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(n: number | null): string {
  return n == null ? '—' : `${(n * 100).toFixed(0)}%`;
}
function int(n: number): string {
  return n.toLocaleString();
}

const FLAG_BADGE: Partial<Record<BidFlag, { cls: string; label: string }>> = {
  grow: { cls: 'good', label: '인상' },
  reduce: { cls: 'danger', label: '인하' },
  waste: { cls: 'warn', label: '낭비' },
  'negative-candidate': { cls: 'warn', label: '네거티브후보' },
  'low-data': { cls: 'info', label: '저데이터' },
  'no-click': { cls: 'info', label: '노출만' },
  'rpc-cap': { cls: 'info', label: 'RPC상한' },
  floor: { cls: 'info', label: '하한' },
  keep: { cls: '', label: '유지' },
};

function sortValue(m: AdMetrics, key: KeywordSort): number {
  switch (key) {
    case 'spend': return m.spend;
    case 'sales': return m.sales;
    case 'clicks': return m.clicks;
    case 'acos': return m.acos ?? Number.POSITIVE_INFINITY; // 무전환을 최상단
    case 'cpc': return m.cpc ?? 0;
  }
}

function matchFilter(r: KeywordView, f: KeywordFilter): boolean {
  switch (f) {
    case 'all': return true;
    case 'changed': return r.changed;
    default: return r.flags.includes(f);
  }
}

export function KeywordTable({ rows, userBidStr, acosStr, onUserBid, onAcosOverride }: Props) {
  const [filter, setFilter] = useState<KeywordFilter>('all');
  const [sort, setSort] = useState<KeywordSort>('spend');

  const view = useMemo(() => {
    const filtered = rows.filter((r) => matchFilter(r, filter));
    return filtered.sort((a, b) => sortValue(b.metrics, sort) - sortValue(a.metrics, sort));
  }, [rows, filter, sort]);

  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <div className="panel">
      <h2>
        키워드 · 타겟 효율 / 권장 입찰
        <span className="gross-note">· {rows.length}개 · 변경 {changedCount}개</span>
      </h2>
      <div className="filters">
        <div className="field">
          <label>필터</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as KeywordFilter)}>
            <option value="all">전체</option>
            <option value="changed">변경분만</option>
            <option value="reduce">인하 권장</option>
            <option value="grow">인상 권장</option>
            <option value="waste">낭비</option>
            <option value="negative-candidate">네거티브 후보</option>
            <option value="low-data">저데이터</option>
          </select>
        </div>
        <div className="field">
          <label>정렬(내림차순)</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as KeywordSort)}>
            <option value="spend">지출</option>
            <option value="sales">매출</option>
            <option value="acos">ACOS</option>
            <option value="clicks">클릭</option>
            <option value="cpc">CPC</option>
          </select>
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="data">
          <thead>
            <tr>
              <th className="col-name">키워드 / 타겟</th>
              <th>매치</th>
              <th>노출</th>
              <th>클릭</th>
              <th>지출</th>
              <th>매출</th>
              <th>주문</th>
              <th>ACOS</th>
              <th>CPC</th>
              <th>목표ACOS</th>
              <th>현재입찰</th>
              <th>권장</th>
              <th>수정입찰</th>
              <th>사유 / 플래그</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const dir = r.userBid > r.currentBid ? 'bid-up' : r.userBid < r.currentBid ? 'bid-down' : '';
              return (
                <tr key={r.rowIndex}>
                  <td className="col-name" title={r.label}>
                    <div>{r.label || <span className="muted">(타겟)</span>}</div>
                    <div className="muted" style={{ fontSize: 'var(--fs-11)' }}>
                      {r.campaignName} · {r.adGroupName}
                    </div>
                  </td>
                  <td>{r.matchType || '—'}</td>
                  <td>{int(r.metrics.impressions)}</td>
                  <td>{int(r.metrics.clicks)}</td>
                  <td>{money(r.metrics.spend)}</td>
                  <td>{money(r.metrics.sales)}</td>
                  <td>{int(r.metrics.orders)}</td>
                  <td>{r.metrics.acos == null ? <span className="badge warn">무전환</span> : pct(r.metrics.acos)}</td>
                  <td>{money(r.metrics.cpc)}</td>
                  <td>
                    <input
                      className="acos-input"
                      type="number"
                      min="1"
                      step="1"
                      value={acosStr[r.rowIndex] ?? String(Math.round(r.effectiveTargetAcos * 100))}
                      onChange={(e) => onAcosOverride(r.rowIndex, e.target.value)}
                    />
                  </td>
                  <td>{money(r.currentBid)}</td>
                  <td className={dir}>{money(r.recommendedBid)}</td>
                  <td>
                    <input
                      className="bid-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={userBidStr[r.rowIndex] ?? r.recommendedBid.toFixed(2)}
                      onChange={(e) => onUserBid(r.rowIndex, e.target.value)}
                    />
                  </td>
                  <td>
                    <div className="flag-cell">
                      {r.flags.map((f) => {
                        const b = FLAG_BADGE[f];
                        if (!b) return null;
                        return (
                          <span key={f} className={`badge ${b.cls}`.trim()}>
                            {b.label}
                          </span>
                        );
                      })}
                    </div>
                    <div className="muted" style={{ fontSize: 'var(--fs-11)' }}>{r.reason}</div>
                  </td>
                </tr>
              );
            })}
            {view.length === 0 && (
              <tr>
                <td colSpan={14} className="muted" style={{ textAlign: 'center', padding: 16 }}>
                  조건에 맞는 행이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
