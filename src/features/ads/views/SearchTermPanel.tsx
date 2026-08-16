// 검색어 제안 — 신규 키워드/네거티브 후보. 체크박스 선택분만 벌크 create 행에 반영(§5c).
import type { NegativeSuggestion, NewKeywordSuggestion } from '../types';

interface Props {
  newKeywords: NewKeywordSuggestion[];
  negatives: NegativeSuggestion[];
  selectedNew: Set<string>;
  selectedNeg: Set<string>;
  onToggleNew: (term: string) => void;
  onToggleNeg: (term: string) => void;
  onSelectAllNew: (on: boolean) => void;
  onSelectAllNeg: (on: boolean) => void;
  disabled?: boolean;
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SearchTermPanel({
  newKeywords,
  negatives,
  selectedNew,
  selectedNeg,
  onToggleNew,
  onToggleNeg,
  onSelectAllNew,
  onSelectAllNeg,
  disabled,
}: Props) {
  if (disabled) {
    return (
      <div className="panel">
        <h2>검색어 제안</h2>
        <div className="empty">
          <div className="empty-title">SP Search Term Report 시트가 없어 제안을 만들 수 없습니다</div>
          <div className="empty-sub">검색어 성과가 포함된 Bulk 파일을 업로드하면 신규 키워드·네거티브 후보를 제시합니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>
        검색어 제안
        <span className="gross-note">· 선택분만 벌크에 create 행으로 반영</span>
      </h2>

      <h3 style={{ fontSize: 'var(--fs-14)', margin: '10px 0 6px' }}>
        신규 키워드 후보(고효율) — {newKeywords.length}개
        {newKeywords.length > 0 && (
          <>
            {' '}
            <button className="btn" style={{ marginLeft: 8 }} onClick={() => onSelectAllNew(true)}>전체선택</button>{' '}
            <button className="btn" onClick={() => onSelectAllNew(false)}>해제</button>
          </>
        )}
      </h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th className="col-name">검색어 → Exact 키워드</th>
              <th>캠페인 · 광고그룹</th>
              <th>주문</th>
              <th>ACOS</th>
              <th>권장입찰</th>
            </tr>
          </thead>
          <tbody>
            {newKeywords.map((k) => (
              <tr key={k.customerSearchTerm}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedNew.has(k.customerSearchTerm)}
                    onChange={() => onToggleNew(k.customerSearchTerm)}
                  />
                </td>
                <td className="col-name">{k.customerSearchTerm}</td>
                <td className="muted">{k.campaignName || k.campaignId} · {k.adGroupName || k.adGroupId}</td>
                <td>{k.orders}</td>
                <td>{k.acos == null ? '—' : `${(k.acos * 100).toFixed(0)}%`}</td>
                <td>{money(k.recommendedBid)}</td>
              </tr>
            ))}
            {newKeywords.length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 12 }}>후보 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 'var(--fs-14)', margin: '16px 0 6px' }}>
        네거티브 후보(무전환 다클릭) — {negatives.length}개
        {negatives.length > 0 && (
          <>
            {' '}
            <button className="btn" style={{ marginLeft: 8 }} onClick={() => onSelectAllNeg(true)}>전체선택</button>{' '}
            <button className="btn" onClick={() => onSelectAllNeg(false)}>해제</button>
          </>
        )}
      </h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th className="col-name">검색어 → Negative Exact</th>
              <th>캠페인 · 광고그룹</th>
              <th>클릭</th>
              <th>지출</th>
            </tr>
          </thead>
          <tbody>
            {negatives.map((n) => (
              <tr key={n.customerSearchTerm}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedNeg.has(n.customerSearchTerm)}
                    onChange={() => onToggleNeg(n.customerSearchTerm)}
                  />
                </td>
                <td className="col-name">{n.customerSearchTerm}</td>
                <td className="muted">{n.campaignName || n.campaignId} · {n.adGroupName || n.adGroupId}</td>
                <td>{n.clicks}</td>
                <td>{money(n.spend)}</td>
              </tr>
            ))}
            {negatives.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 12 }}>후보 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
