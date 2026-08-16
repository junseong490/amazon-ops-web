// FBM(일본) 패널 — 단일창고 단순 재주문. 3PL 창고 한 곳에서 직접 고객 출고.
// 계산은 순수 함수(calc/fbm). 안전재고 3방식(일수 기반 기본/계수/직접) 지원.
import { useMemo, useState } from 'react';
import { computeFbm } from '../calc/fbm';
import { safetyStockFromDays, safetyStockFromLeadTime } from '../calc/primitives';
import type { ItemVelocity } from '../calc/velocity';
import { num, fmt, SafetyModeField, type SafetyMode } from './shared';

export function FbmPanel({ velocities }: { velocities: ItemVelocity[] }) {
  const [velocity, setVelocity] = useState('5');
  const [leadTime, setLeadTime] = useState('30'); // L_sup 공급사→3PL 기본 30일
  const [currentStock, setCurrentStock] = useState('80');
  const [onOrder, setOnOrder] = useState('0');
  const [reviewDays, setReviewDays] = useState('7'); // 검토주기 기본 7일
  const [lotSize, setLotSize] = useState('');
  const [minOrderQty, setMinOrderQty] = useState('');
  const [selectedItem, setSelectedItem] = useState('');

  // 안전재고: 일수 기반(기본 14일) / 계수 / 직접
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('days');
  const [safetyDays, setSafetyDays] = useState('14');
  const [safetyFactor, setSafetyFactor] = useState('0.5');
  const [safetyDirect, setSafetyDirect] = useState('30');

  const v = num(velocity);
  const lt = num(leadTime);
  const safetyStock =
    safetyMode === 'days'
      ? safetyStockFromDays(v, num(safetyDays))
      : safetyMode === 'factor'
        ? safetyStockFromLeadTime(v, lt, num(safetyFactor))
        : num(safetyDirect);

  const result = useMemo(
    () =>
      computeFbm({
        velocity: v,
        leadTimeDays: lt,
        currentStock: num(currentStock),
        safetyStock,
        onOrder: num(onOrder),
        reviewDays: num(reviewDays),
        lotSize: lotSize ? num(lotSize) : undefined,
        minOrderQty: minOrderQty ? num(minOrderQty) : undefined,
      }),
    [v, lt, currentStock, safetyStock, onOrder, reviewDays, lotSize, minOrderQty],
  );

  function applyVelocity(key: string) {
    setSelectedItem(key);
    const found = velocities.find((x) => x.key === key);
    if (found) setVelocity(found.velocity.toFixed(2));
  }

  return (
    <>
      {velocities.length > 0 && (
        <div className="panel">
          <h2>매출 데이터 연동 (선택 · JP)</h2>
          <div className="filters">
            <div className="field">
              <label>품목 velocity 불러오기 (Amazon.co.jp)</label>
              <select value={selectedItem} onChange={(e) => applyVelocity(e.target.value)}>
                <option value="">— 품목 선택 —</option>
                {velocities.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label} · {fmt(x.velocity, 2)}/일
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>입력 — FBM 단일창고 (3PL)</h2>
        <div className="filters">
          <div className="field">
            <label>일 평균 판매량 (velocity)</label>
            <input type="number" min="0" step="0.1" value={velocity} onChange={(e) => setVelocity(e.target.value)} />
          </div>
          <div className="field">
            <label>공급 리드타임 L_sup (일)</label>
            <input type="number" min="0" step="1" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
          </div>
          <div className="field">
            <label>현재 재고 (3PL)</label>
            <input type="number" min="0" step="1" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />
          </div>
          <div className="field">
            <label>입고 대기(발주 중)</label>
            <input type="number" min="0" step="1" value={onOrder} onChange={(e) => setOnOrder(e.target.value)} />
          </div>
          <div className="field">
            <label>검토주기 R (일)</label>
            <input type="number" min="0" step="1" value={reviewDays} onChange={(e) => setReviewDays(e.target.value)} />
          </div>
          <div className="field">
            <label>발주 로트(배수, 선택)</label>
            <input type="number" min="0" step="1" value={lotSize} onChange={(e) => setLotSize(e.target.value)} placeholder="없음" />
          </div>
          <div className="field">
            <label>최소주문수량 MOQ(선택)</label>
            <input type="number" min="0" step="1" value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} placeholder="없음" />
          </div>
        </div>

        <div className="filters" style={{ marginTop: 16 }}>
          <SafetyModeField
            mode={safetyMode}
            setMode={setSafetyMode}
            days={safetyDays}
            setDays={setSafetyDays}
            factor={safetyFactor}
            setFactor={setSafetyFactor}
            direct={safetyDirect}
            setDirect={setSafetyDirect}
            computed={safetyStock}
          />
        </div>
      </div>

      <div className="panel">
        <h2>
          결과 — 재주문
          <span className="gross-note">· {result.needsReorder ? '지금 재주문 필요' : '재주문 여유 있음'}</span>
        </h2>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="label">재주문 시점 (ROP)</div>
            <div className="value">{fmt(result.reorderPoint)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">소진 예상일수</div>
            <div className="value">{result.daysOfSupply === null ? '∞' : `${fmt(result.daysOfSupply)}일`}</div>
          </div>
          <div className="kpi-card">
            <div className="label">소진 예상일자</div>
            <div className="value">{result.stockoutDate ?? '—'}</div>
          </div>
          <div className="kpi-card">
            <div className="label">권장 발주량</div>
            <div className="value">{fmt(result.recommendedOrderQty, 0)}</div>
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data">
            <thead>
              <tr>
                <th className="col-name">지표</th>
                <th>값</th>
                <th className="col-name">산식</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-name">재주문 시점</td>
                <td>{fmt(result.reorderPoint)}</td>
                <td className="col-name">velocity × 리드타임 + 안전재고</td>
              </tr>
              <tr>
                <td className="col-name">재주문까지 남은 일수</td>
                <td>{result.daysUntilReorder === null ? '∞' : `${fmt(result.daysUntilReorder)}일`}</td>
                <td className="col-name">(현재고 − 재주문시점) / velocity</td>
              </tr>
              <tr>
                <td className="col-name">목표 보충 수준</td>
                <td>{fmt(result.orderUpToLevel)}</td>
                <td className="col-name">velocity × (리드타임 + 검토주기) + 안전재고</td>
              </tr>
              <tr>
                <td className="col-name">권장 발주량</td>
                <td>{fmt(result.recommendedOrderQty, 0)}</td>
                <td className="col-name">목표 − (현재고 + 입고대기), MOQ·로트 반영</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
