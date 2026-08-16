// 가격·마진 시뮬레이터 메인 뷰(brief §UI).
// 판매가·통화 입력 + 카테고리/항목 CRUD → 결과 즉시. IndexedDB 저장·복원.
import { useEffect, useMemo, useRef, useState } from 'react';
import { compute } from '../calc/pricing';
import {
  addCategory,
  addItem,
  removeCategory,
  removeItem,
  renameCategory,
  setMarket,
  setSellingPrice,
  updateItem,
} from '../calc/scenario';
import { createScenarioStore } from '../data/pricingStore';
import { defaultScenario } from '../data/template';
import type { CostBasis, CostItem, Scenario } from '../types';
import { ResultPanel } from './ResultPanel';
import { BASIS_META, BASIS_ORDER, num, toPercentInput } from './shared';

const store = createScenarioStore();

// 마켓 → 통화 매핑. 통화 혼재 금지: 마켓을 바꾸면 통화도 함께 바뀐다.
const MARKETS: { market: string; currency: string; label: string }[] = [
  { market: 'US', currency: 'USD', label: '미국 (US · USD)' },
  { market: 'JP', currency: 'JPY', label: '일본 (JP · JPY)' },
  { market: 'EU', currency: 'EUR', label: '유럽 (EU · EUR)' },
  { market: 'UK', currency: 'GBP', label: '영국 (UK · GBP)' },
];

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: CostItem;
  onChange: (patch: Partial<CostItem>) => void;
  onRemove: () => void;
}) {
  const meta = BASIS_META[item.basis];
  const isPercent = meta.unit === 'percent';
  return (
    <tr>
      <td>
        <input
          type="text"
          value={item.name}
          aria-label="항목 이름"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </td>
      <td>
        <select
          value={item.basis}
          aria-label="계산 기준"
          title={meta.hint}
          onChange={(e) => onChange({ basis: e.target.value as CostBasis })}
        >
          {BASIS_ORDER.map((b) => (
            <option key={b} value={b} title={BASIS_META[b].hint}>
              {BASIS_META[b].label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            step={isPercent ? '0.1' : '0.01'}
            value={isPercent ? toPercentInput(item.value) : String(item.value)}
            aria-label="값"
            onChange={(e) => onChange({ value: isPercent ? num(e.target.value) / 100 : num(e.target.value) })}
          />
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>{isPercent ? '%' : '금액'}</span>
        </div>
      </td>
      <td style={{ textAlign: 'center' }}>
        {item.basis === 'per_unit' ? (
          <input
            type="checkbox"
            aria-label="원가(COGS) 포함"
            title="체크하면 상품원가(COGS) 합계에 포함 — 관세·ROI 계산 기준"
            checked={!!item.countInCogs}
            onChange={(e) => onChange({ countInCogs: e.target.checked })}
          />
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <button className="btn" onClick={onRemove} title="항목 삭제">삭제</button>
      </td>
    </tr>
  );
}

export function PricingSimulator() {
  const [scenario, setScenario] = useState<Scenario>(() => defaultScenario());
  const [loaded, setLoaded] = useState(false);

  // 최초 로드: 저장분 있으면 복원, 없으면 템플릿 유지.
  useEffect(() => {
    let alive = true;
    store
      .load()
      .then((s) => {
        if (alive && s) setScenario(s);
      })
      .catch(() => {
        /* 캐시 없음/미지원 — 템플릿으로 동작 */
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  // 변경 시 자동 저장(최초 로드 완료 후에만).
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      store.save(scenario).catch(() => {});
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [scenario, loaded]);

  const result = useMemo(() => compute(scenario), [scenario]);

  const resetTemplate = () => {
    const fresh = defaultScenario();
    setScenario(fresh);
    store.save(fresh).catch(() => {});
  };

  return (
    <>
      <div className="panel">
        <h2>판매가 · 마켓</h2>
        <div className="filters">
          <div className="field">
            <label>마켓 / 통화</label>
            <select
              value={scenario.market}
              onChange={(e) => {
                const m = MARKETS.find((x) => x.market === e.target.value)!;
                setScenario((s) => setMarket(s, m.market, m.currency));
              }}
            >
              {MARKETS.map((m) => (
                <option key={m.market} value={m.market}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>판매가 ({scenario.currency})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={String(scenario.sellingPrice)}
              onChange={(e) => setScenario((s) => setSellingPrice(s, num(e.target.value)))}
            />
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={resetTemplate} title="기본 템플릿으로 초기화">기본 템플릿으로 초기화</button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 'var(--fs-12)' }}>
          통화 혼재 금지: 시나리오는 한 통화로만 계산합니다. 마켓을 바꾸면 통화가 함께 바뀝니다.
        </p>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>비용 카테고리 · 항목</h2>
          <button className="btn" onClick={() => setScenario((s) => addCategory(s))}>+ 카테고리 추가</button>
        </div>

        {scenario.categories.map((cat) => (
          <div key={cat.id} className="chart-card" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                type="text"
                value={cat.name}
                aria-label="카테고리 이름"
                style={{ fontWeight: 600, flex: '0 0 200px' }}
                onChange={(e) => setScenario((s) => renameCategory(s, cat.id, e.target.value))}
              />
              <button className="btn" onClick={() => setScenario((s) => addItem(s, cat.id))}>+ 항목</button>
              <button
                className="btn"
                style={{ marginLeft: 'auto' }}
                onClick={() => setScenario((s) => removeCategory(s, cat.id))}
                title="카테고리 삭제"
              >
                카테고리 삭제
              </button>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ minWidth: 140 }}>항목</th>
                    <th style={{ minWidth: 140 }}>계산 기준</th>
                    <th style={{ minWidth: 120 }}>값</th>
                    <th title="상품원가(COGS) 합계 포함 여부">원가 포함</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cat.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">항목이 없습니다. “+ 항목”으로 추가하세요.</td>
                    </tr>
                  ) : (
                    cat.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onChange={(patch) => setScenario((s) => updateItem(s, cat.id, item.id, patch))}
                        onRemove={() => setScenario((s) => removeItem(s, cat.id, item.id))}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 10 }}>
          계산 기준: <strong>단위당 금액</strong>=개당 절대비용 · <strong>판매가 %</strong>=판매가 비례(수수료·광고) ·{' '}
          <strong>원가 %</strong>=상품원가 비례(관세 등). 항목·카테고리는 자유롭게 추가·삭제·편집하세요.
        </p>
      </div>

      <ResultPanel result={result} />
    </>
  );
}
