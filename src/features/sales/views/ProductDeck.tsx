// 품목 성과 하이라이트 "커맨드덱" (Round C). 참고 목업의 다크 네이비 데크 톤을
// 이식하되, 가짜 주문(주문ID·배송상태·출고처리) 대신 우리가 실제로 가진
// 품목별(SKU) 실측 성과만 얹는다. 집계는 SalesDashboard에서 넘어온 실데이터.
import { useState } from 'react';
import { formatMoney } from '../../../core/money/format';

export type DeckTableTab = 'market' | 'daily' | 'daily-item';

export interface DeckItem {
  /** SKU/ASIN 키 */
  key: string;
  /** 표시 라벨(별칭 우선, resolveItemLabel 결과) */
  label: string;
  /** 선택 통화 기준 매출 */
  revenue: number;
  quantity: number;
  /** 전체 매출 대비 기여율 (%) */
  share: number;
  /** 이 품목이 팔린 마켓 중 매출 1위 */
  topMarket: string;
  /** 이 품목이 팔린 마켓 수 */
  marketCount: number;
  /** 매출 내림차순 순위(1-base) */
  rank: number;
}

interface ProductDeckProps {
  /** 매출 내림차순 정렬된 전체 품목(상위 N만 렌더) */
  items: DeckItem[];
  /** 선택 통화 코드 */
  cur: string;
  /** 하단 상세 표 탭 상태(기존 tableTab과 공유 — 별도 상태 없음) */
  tableTab: DeckTableTab;
  onTabChange: (t: DeckTableTab) => void;
  /** "품목별 표에서 보기" — 해당 품목을 표에서 강조·스크롤 */
  onLocate: (key: string) => void;
  /** "별칭 편집" — 별칭 패널 펼치고 스크롤 */
  onEditAlias: (key: string) => void;
  /** "모든 품목 표 보기" — 품목별 표로 이동 */
  onSeeAll: () => void;
}

const TOP_N = 5;
// 아바타 색 변형은 순수 장식(참고 목업의 amber/mint). 데이터 의미 없음.
const AVATAR_VARIANTS = ['', 'amber', 'mint'];

// 데크 탭 = 기존 상세 표 탭과 동일 항목(별도 상태 만들지 않고 tableTab 공유).
const TABS: { id: DeckTableTab; label: string }[] = [
  { id: 'market', label: '국가·품목별' },
  { id: 'daily', label: '일별' },
  { id: 'daily-item', label: '일별 품목별' },
];

// 라벨/키에서 아바타 이니셜 2글자 추출. 순수 표시용.
function initials(label: string, key: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const src = (label || key).replace(/[^A-Za-z0-9]/g, '');
  return (src.slice(0, 2) || '·').toUpperCase();
}

export function ProductDeck({
  items,
  cur,
  tableTab,
  onTabChange,
  onLocate,
  onEditAlias,
  onSeeAll,
}: ProductDeckProps) {
  const top = items.slice(0, TOP_N);
  const [selectedItemKey, setSelectedItemKey] = useState<string>(() => top[0]?.key ?? '');
  // 선택 키가 현재 목록에 없으면(필터/데이터 변경) 첫 항목으로 자연 보정.
  const selected = top.find((it) => it.key === selectedItemKey) ?? top[0];

  if (!selected) return null; // 방어: 표시할 품목이 없음

  return (
    <section className="command-deck" aria-label="품목 성과 하이라이트">
      <header className="deck-header">
        <div className="deck-tabs" role="tablist" aria-label="상세 표 보기 전환">
          {TABS.map((t, i) => {
            const on = tableTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={`deck-tab${on ? ' active' : ''}`}
                onClick={() => onTabChange(t.id)}
              >
                {t.label}
                {i === 0 ? <span aria-label={`품목 ${items.length}개`}>{items.length}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="deck-header-actions">
          <button
            type="button"
            className="deck-icon-button"
            aria-label="전체 품목 표 보기"
            onClick={onSeeAll}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </button>
        </div>
      </header>

      <div className="deck-body">
        <div className="order-pane">
          <div className="order-pane-heading">
            <span>품목 매출 랭킹</span>
            <small>상위 {top.length}개 · 매출순</small>
          </div>
          <div className="order-list">
            {top.map((it, i) => {
              const on = it.key === selected.key;
              const variant = AVATAR_VARIANTS[i % AVATAR_VARIANTS.length];
              return (
                <button
                  key={it.key}
                  type="button"
                  className={`order-row${on ? ' selected' : ''}`}
                  aria-pressed={on}
                  onClick={() => setSelectedItemKey(it.key)}
                >
                  <span className={`product-avatar${variant ? ` ${variant}` : ''}`} aria-hidden="true">
                    {initials(it.label, it.key)}
                  </span>
                  <span className="order-info">
                    <strong title={it.label}>{it.label}</strong>
                    <small>
                      {it.key}
                      {it.topMarket ? ` · ${it.topMarket}` : ''}
                    </small>
                  </span>
                  <span className="order-amount">
                    <strong>{formatMoney(it.revenue, cur)}</strong>
                    <small>기여율 {it.share.toFixed(1)}%</small>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" className="deck-see-all" onClick={onSeeAll}>
            모든 품목 표 보기
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        <aside className="detail-pane" aria-live="polite">
          <div className="detail-topline">
            <span>선택한 품목</span>
            <button
              type="button"
              className="detail-expand"
              aria-label="품목별 표에서 보기"
              onClick={() => onLocate(selected.key)}
            >
              ↗
            </button>
          </div>
          <div className="detail-product">
            <span className="detail-product-icon" aria-hidden="true">
              {initials(selected.label, selected.key)}
            </span>
            <div>
              <p>판매 상품</p>
              <h2 title={selected.label}>{selected.label}</h2>
              <span>SKU {selected.key}</span>
            </div>
          </div>
          <div className="detail-meta">
            <div>
              <span>마켓 수</span>
              <strong>{selected.marketCount}개</strong>
            </div>
            <div>
              <span>수량</span>
              <strong>{selected.quantity.toLocaleString()}개</strong>
            </div>
            <div>
              <span>총 매출</span>
              <strong>{formatMoney(selected.revenue, cur)}</strong>
            </div>
          </div>
          <div className="detail-divider" />
          <div className="detail-summary">
            <span>전체 매출 기여율</span>
            <strong>
              {selected.share.toFixed(1)}%
              <small>#{selected.rank}</small>
            </strong>
          </div>
          <div className="detail-actions">
            <button
              type="button"
              className="secondary-deck-action"
              onClick={() => onLocate(selected.key)}
            >
              품목별 표에서 보기
            </button>
            <button
              type="button"
              className="primary-deck-action"
              onClick={() => onEditAlias(selected.key)}
            >
              별칭 편집
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
