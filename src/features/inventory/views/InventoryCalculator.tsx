// 재고 계산기 — 수동 입력만으로 재주문 시점·소진일·권장 발주량 계산(brief A).
// 계산은 순수 함수(calc/reorder). 매출 데이터가 있으면 velocity 기본값을 제시(선택 연동).
import { useEffect, useMemo, useState } from 'react';
import { computeInventory, safetyStockFromLeadTime } from '../calc/reorder';
import { itemVelocities, type ItemVelocity } from '../calc/velocity';
import { createDefaultSource } from '../../../core/store/dataSource';
import type { SalesRecord } from '../../../types/domain';

const source = createDefaultSource();

/** 숫자 입력(빈 문자열 허용) → number. */
function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

type SafetyMode = 'direct' | 'factor';

export function InventoryCalculator() {
  // 입력(문자열로 보관해 빈 값 허용)
  const [velocity, setVelocity] = useState('5');
  const [leadTime, setLeadTime] = useState('14');
  const [currentStock, setCurrentStock] = useState('80');
  const [onOrder, setOnOrder] = useState('0');
  const [reviewDays, setReviewDays] = useState('30');
  const [lotSize, setLotSize] = useState('');
  const [minOrderQty, setMinOrderQty] = useState('');

  // 안전재고: 직접 입력 또는 리드타임×velocity×계수
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('factor');
  const [safetyStockInput, setSafetyStockInput] = useState('30');
  const [safetyFactor, setSafetyFactor] = useState('0.5');

  // 매출 연동(선택): 업로드된 데이터가 있으면 품목별 velocity 제시
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [selectedItem, setSelectedItem] = useState('');

  useEffect(() => {
    source
      .loadRecords()
      .then((r) => {
        if (r.length > 0) setRecords(r);
      })
      .catch(() => {
        /* 캐시 없음/미지원 — 수동 입력만으로 동작 */
      });
  }, []);

  const velocities = useMemo<ItemVelocity[]>(() => itemVelocities(records), [records]);

  const velocityNum = num(velocity);
  const leadTimeNum = num(leadTime);

  const safetyStock =
    safetyMode === 'factor'
      ? safetyStockFromLeadTime(velocityNum, leadTimeNum, num(safetyFactor))
      : num(safetyStockInput);

  const result = useMemo(
    () =>
      computeInventory({
        velocity: velocityNum,
        leadTimeDays: leadTimeNum,
        currentStock: num(currentStock),
        safetyStock,
        onOrder: num(onOrder),
        reviewDays: num(reviewDays),
        lotSize: lotSize ? num(lotSize) : undefined,
        minOrderQty: minOrderQty ? num(minOrderQty) : undefined,
      }),
    [velocityNum, leadTimeNum, currentStock, safetyStock, onOrder, reviewDays, lotSize, minOrderQty],
  );

  function applyVelocityFromItem(key: string) {
    setSelectedItem(key);
    const v = velocities.find((x) => x.key === key);
    if (v) setVelocity(v.velocity.toFixed(2));
  }

  return (
    <>
      {/* 매출 연동(있을 때만) */}
      {velocities.length > 0 && (
        <div className="panel">
          <h2>매출 데이터 연동 (선택)</h2>
          <div className="filters">
            <div className="field">
              <label>품목 velocity 불러오기</label>
              <select value={selectedItem} onChange={(e) => applyVelocityFromItem(e.target.value)}>
                <option value="">— 품목 선택 —</option>
                {velocities.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.label} · {fmt(v.velocity, 2)}/일
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                업로드된 매출 {records.length}라인에서 계산한 일 평균 판매량입니다. 선택하면 아래
                velocity에 채워집니다.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 입력 */}
      <div className="panel">
        <h2>입력</h2>
        <div className="filters">
          <div className="field">
            <label>일 평균 판매량 (velocity)</label>
            <input type="number" min="0" step="0.1" value={velocity} onChange={(e) => setVelocity(e.target.value)} />
          </div>
          <div className="field">
            <label>리드타임 (일)</label>
            <input type="number" min="0" step="1" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
          </div>
          <div className="field">
            <label>현재 재고</label>
            <input type="number" min="0" step="1" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />
          </div>
          <div className="field">
            <label>입고 대기(발주 중)</label>
            <input type="number" min="0" step="1" value={onOrder} onChange={(e) => setOnOrder(e.target.value)} />
          </div>
          <div className="field">
            <label>발주 주기/목표 커버(일)</label>
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
          <div className="field">
            <label>안전재고 방식</label>
            <select value={safetyMode} onChange={(e) => setSafetyMode(e.target.value as SafetyMode)}>
              <option value="factor">리드타임×velocity×계수</option>
              <option value="direct">직접 입력</option>
            </select>
          </div>
          {safetyMode === 'direct' ? (
            <div className="field">
              <label>안전재고 (units)</label>
              <input type="number" min="0" step="1" value={safetyStockInput} onChange={(e) => setSafetyStockInput(e.target.value)} />
            </div>
          ) : (
            <div className="field">
              <label>안전계수</label>
              <input type="number" min="0" step="0.1" value={safetyFactor} onChange={(e) => setSafetyFactor(e.target.value)} />
            </div>
          )}
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
              적용 안전재고 = <strong>{fmt(safetyStock)}</strong> units
            </span>
          </div>
        </div>
      </div>

      {/* 출력 */}
      <div className="panel">
        <h2>
          결과
          <span className="gross-note">
            · {result.needsReorder ? '지금 재주문 필요' : '재주문 여유 있음'}
          </span>
        </h2>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="label">재주문 시점 (reorder point)</div>
            <div className="value">{fmt(result.reorderPoint)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">소진 예상일수</div>
            <div className="value">
              {result.daysOfSupply === null ? '∞' : `${fmt(result.daysOfSupply)}일`}
            </div>
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
                <td className="col-name">velocity × (리드타임 + 발주주기) + 안전재고</td>
              </tr>
              <tr>
                <td className="col-name">권장 발주량</td>
                <td>{fmt(result.recommendedOrderQty, 0)}</td>
                <td className="col-name">목표 보충 수준 − (현재고 + 입고대기), MOQ·로트 반영</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 10, marginBottom: 0 }}>
          소진 예상일자는 오늘(브라우저 로컬) 기준 · 매출 데이터가 없어도 수동 입력만으로 계산됩니다.
        </p>
      </div>
    </>
  );
}
