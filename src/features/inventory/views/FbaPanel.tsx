// FBA(미국) 패널 — 2단(3PL → FBA). reference §5b 현재고 입력 + 두 결정 카드.
// 계산은 순수 함수(calc/fba). "언제 보낼지"(FBA 보충 발송 시점)를 강조 표시.
import { useMemo, useState } from 'react';
import { computeFba } from '../calc/fba';
import { safetyStockFromDays, safetyStockFromLeadTime } from '../calc/primitives';
import type { ItemVelocity } from '../calc/velocity';
import { num, fmt, type SafetyMode } from './shared';

/** 방식별 안전재고 산출. direct는 tier별 직접값. */
function computeSafety(
  mode: SafetyMode,
  v: number,
  leadTime: number,
  days: number,
  factor: number,
  direct: number,
): number {
  if (mode === 'days') return safetyStockFromDays(v, days);
  if (mode === 'factor') return safetyStockFromLeadTime(v, leadTime, factor);
  return Math.max(0, direct);
}

export function FbaPanel({ velocities }: { velocities: ItemVelocity[] }) {
  const [velocity, setVelocity] = useState('5');
  const [selectedItem, setSelectedItem] = useState('');

  // §5b FBA 현재고 구성요소
  const [fbaInbound, setFbaInbound] = useState('17');
  const [fbaOnHand, setFbaOnHand] = useState('240'); // 보유 = 사용가능 + FC이전
  const [fbaFcProcessing, setFbaFcProcessing] = useState('6');
  const [fbaAvailable, setFbaAvailable] = useState('201'); // 보조 품절지표
  const [useOverride, setUseOverride] = useState(false);
  const [overrideValue, setOverrideValue] = useState('263');

  // 참고용(계산 제외) — 표시만
  const [refCustomerOrders, setRefCustomerOrders] = useState('15');
  const [refInvestigating, setRefInvestigating] = useState('7');
  const [refUnfulfillable, setRefUnfulfillable] = useState('2');

  // 3PL
  const [stock3pl, setStock3pl] = useState('100');
  const [onOrder3pl, setOnOrder3pl] = useState('0');

  // 리드타임 / 검토주기 (전부 편집가능, 기본값)
  const [leadTimeFba, setLeadTimeFba] = useState('7'); // L_fba 기본 7일
  const [leadTimeSup, setLeadTimeSup] = useState('30'); // L_sup 기본 30일
  const [reviewDays, setReviewDays] = useState('7'); // R 기본 7일

  // 발주 반올림 (3PL)
  const [lotSize, setLotSize] = useState('');
  const [minOrderQty, setMinOrderQty] = useState('');

  // 안전재고 방식 (fba/3pl 공용 방식, 직접모드만 tier별 값)
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('days');
  const [safetyDays, setSafetyDays] = useState('14');
  const [safetyFactor, setSafetyFactor] = useState('0.5');
  const [ssFbaDirect, setSsFbaDirect] = useState('30');
  const [ss3plDirect, setSs3plDirect] = useState('60');

  const v = num(velocity);
  const lFba = num(leadTimeFba);
  const lSup = num(leadTimeSup);

  const ssFba = computeSafety(safetyMode, v, lFba, num(safetyDays), num(safetyFactor), num(ssFbaDirect));
  const ss3pl = computeSafety(safetyMode, v, lSup, num(safetyDays), num(safetyFactor), num(ss3plDirect));

  const result = useMemo(
    () =>
      computeFba({
        velocity: v,
        fbaInbound: num(fbaInbound),
        fbaOnHand: num(fbaOnHand),
        fbaFcProcessing: num(fbaFcProcessing),
        fbaAvailable: num(fbaAvailable),
        fbaCurrentStockOverride: useOverride ? num(overrideValue) : undefined,
        stock3pl: num(stock3pl),
        onOrder3pl: num(onOrder3pl),
        leadTimeFbaDays: lFba,
        leadTimeSupDays: lSup,
        reviewDays: num(reviewDays),
        safetyStockFba: ssFba,
        safetyStock3pl: ss3pl,
        lotSize: lotSize ? num(lotSize) : undefined,
        minOrderQty: minOrderQty ? num(minOrderQty) : undefined,
      }),
    [
      v, fbaInbound, fbaOnHand, fbaFcProcessing, fbaAvailable, useOverride, overrideValue,
      stock3pl, onOrder3pl, lFba, lSup, reviewDays, ssFba, ss3pl, lotSize, minOrderQty,
    ],
  );

  function applyVelocity(key: string) {
    setSelectedItem(key);
    const found = velocities.find((x) => x.key === key);
    if (found) setVelocity(found.velocity.toFixed(2));
  }

  const summedStock = num(fbaInbound) + num(fbaOnHand) + num(fbaFcProcessing);

  return (
    <>
      {velocities.length > 0 && (
        <div className="panel">
          <h2>매출 데이터 연동 (선택 · US)</h2>
          <div className="filters">
            <div className="field">
              <label>품목 velocity 불러오기 (Amazon.com)</label>
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

      {/* FBA 현재고 입력 (§5b) */}
      <div className="panel">
        <h2>
          현재 FBA 재고 (Seller Central 재고 개요)
          <span className="gross-note">· 인바운드 + 보유 + FC처리중 = {fmt(summedStock, 0)}</span>
        </h2>
        <div className="filters">
          <div className="field">
            <label>인바운드 (배송 중)</label>
            <input type="number" min="0" step="1" value={fbaInbound} onChange={(e) => setFbaInbound(e.target.value)} disabled={useOverride} />
          </div>
          <div className="field">
            <label>보유 (사용가능 + FC이전)</label>
            <input type="number" min="0" step="1" value={fbaOnHand} onChange={(e) => setFbaOnHand(e.target.value)} disabled={useOverride} />
          </div>
          <div className="field">
            <label>주문처리센터 처리 중</label>
            <input type="number" min="0" step="1" value={fbaFcProcessing} onChange={(e) => setFbaFcProcessing(e.target.value)} disabled={useOverride} />
          </div>
          <div className="field">
            <label>└ 그중 사용 가능 (available)</label>
            <input type="number" min="0" step="1" value={fbaAvailable} onChange={(e) => setFbaAvailable(e.target.value)} />
          </div>
        </div>

        <div className="filters" style={{ marginTop: 12 }}>
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input id="ovr" type="checkbox" checked={useOverride} onChange={(e) => setUseOverride(e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="ovr" style={{ margin: 0 }}>현재고 합계를 직접 입력</label>
          </div>
          {useOverride && (
            <div className="field">
              <label>현재 FBA 재고 (합계)</label>
              <input type="number" min="0" step="1" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} />
            </div>
          )}
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
              적용 현재고 = <strong>{fmt(result.currentFbaStock, 0)}</strong> units · 보충 판단 주 기준
            </span>
          </div>
        </div>

        <p className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 10, marginBottom: 6 }}>
          참고(계산 제외): 고객주문·조사중·처리불가는 가용이 아니므로 현재고에 넣지 않습니다.
        </p>
        <div className="filters">
          <div className="field">
            <label>고객 주문 (예약됨)</label>
            <input type="number" min="0" step="1" value={refCustomerOrders} onChange={(e) => setRefCustomerOrders(e.target.value)} />
          </div>
          <div className="field">
            <label>조사 중</label>
            <input type="number" min="0" step="1" value={refInvestigating} onChange={(e) => setRefInvestigating(e.target.value)} />
          </div>
          <div className="field">
            <label>주문 처리 불가</label>
            <input type="number" min="0" step="1" value={refUnfulfillable} onChange={(e) => setRefUnfulfillable(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 파라미터 입력 */}
      <div className="panel">
        <h2>파라미터 — 3PL 재고 · 리드타임 · 안전재고</h2>
        <div className="filters">
          <div className="field">
            <label>일 평균 판매량 (velocity, US)</label>
            <input type="number" min="0" step="0.1" value={velocity} onChange={(e) => setVelocity(e.target.value)} />
          </div>
          <div className="field">
            <label>3PL 재고 (배송중 제외)</label>
            <input type="number" min="0" step="1" value={stock3pl} onChange={(e) => setStock3pl(e.target.value)} />
          </div>
          <div className="field">
            <label>3PL 발주중 (공급사→3PL)</label>
            <input type="number" min="0" step="1" value={onOrder3pl} onChange={(e) => setOnOrder3pl(e.target.value)} />
          </div>
          <div className="field">
            <label>L_fba 3PL→FBA 리드타임 (일)</label>
            <input type="number" min="0" step="1" value={leadTimeFba} onChange={(e) => setLeadTimeFba(e.target.value)} />
          </div>
          <div className="field">
            <label>L_sup 공급사→3PL 리드타임 (일)</label>
            <input type="number" min="0" step="1" value={leadTimeSup} onChange={(e) => setLeadTimeSup(e.target.value)} />
          </div>
          <div className="field">
            <label>검토주기 R (일)</label>
            <input type="number" min="0" step="1" value={reviewDays} onChange={(e) => setReviewDays(e.target.value)} />
          </div>
          <div className="field">
            <label>3PL 발주 로트(배수, 선택)</label>
            <input type="number" min="0" step="1" value={lotSize} onChange={(e) => setLotSize(e.target.value)} placeholder="없음" />
          </div>
          <div className="field">
            <label>3PL MOQ(선택)</label>
            <input type="number" min="0" step="1" value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} placeholder="없음" />
          </div>
        </div>

        <div className="filters" style={{ marginTop: 16 }}>
          <div className="field">
            <label>안전재고 방식</label>
            <select value={safetyMode} onChange={(e) => setSafetyMode(e.target.value as SafetyMode)}>
              <option value="days">일수 기반 (N일치)</option>
              <option value="factor">리드타임×velocity×계수</option>
              <option value="direct">직접 입력 (tier별)</option>
            </select>
          </div>
          {safetyMode === 'days' && (
            <div className="field">
              <label>안전재고 일수</label>
              <input type="number" min="0" step="1" value={safetyDays} onChange={(e) => setSafetyDays(e.target.value)} />
            </div>
          )}
          {safetyMode === 'factor' && (
            <div className="field">
              <label>안전계수</label>
              <input type="number" min="0" step="0.1" value={safetyFactor} onChange={(e) => setSafetyFactor(e.target.value)} />
            </div>
          )}
          {safetyMode === 'direct' && (
            <>
              <div className="field">
                <label>FBA 안전재고 (units)</label>
                <input type="number" min="0" step="1" value={ssFbaDirect} onChange={(e) => setSsFbaDirect(e.target.value)} />
              </div>
              <div className="field">
                <label>3PL 안전재고 (units)</label>
                <input type="number" min="0" step="1" value={ss3plDirect} onChange={(e) => setSs3plDirect(e.target.value)} />
              </div>
            </>
          )}
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
              ss_fba = <strong>{fmt(ssFba)}</strong> · ss_3pl = <strong>{fmt(ss3pl)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 카드 1 — FBA 보충 (언제 보낼지 강조) */}
      <div className="panel">
        <h2>
          ① FBA 보충 (3PL → FBA)
          <span className="gross-note">· {result.needsReplenish ? '지금 보내야 함' : '아직 여유'}</span>
        </h2>
        <div
          className="kpi-card"
          style={{
            marginBottom: 16,
            borderColor: result.needsReplenish ? 'var(--danger)' : 'var(--accent)',
            background: 'var(--panel-2)',
          }}
        >
          <div className="label">언제 보낼지 (발송 권장 시점)</div>
          <div className="value" style={{ color: result.needsReplenish ? 'var(--danger)' : 'var(--accent-strong)' }}>
            {result.daysUntilReplenish === null
              ? '판매 없음(∞)'
              : result.needsReplenish
                ? `지금 발송 · ${result.replenishByDate}`
                : `${fmt(result.daysUntilReplenish)}일 후 (${result.replenishByDate})`}
          </div>
        </div>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="label">현재 FBA 재고</div>
            <div className="value">{fmt(result.currentFbaStock, 0)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">FBA 재주문점 (ROP_fba)</div>
            <div className="value">{fmt(result.fbaReorderPoint)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">권장 보충량 (목표까지)</div>
            <div className="value">{fmt(result.recommendedReplenishQty, 0)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">실제 보낼 수 있는 양</div>
            <div className="value">{fmt(result.actualReplenishQty, 0)}</div>
          </div>
        </div>
        {result.replenishClampedTo3pl && (
          <p style={{ color: 'var(--warn)', fontSize: 'var(--fs-13)', marginTop: 12, marginBottom: 0 }}>
            ⚠ 3PL 재고 부족으로 {fmt(result.replenishShortfall, 0)} units 못 보냄 → 3PL 재주문 시급.
          </p>
        )}
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data">
            <thead>
              <tr><th className="col-name">지표</th><th>값</th><th className="col-name">산식</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-name">FBA 목표 수준</td>
                <td>{fmt(result.fbaTargetLevel)}</td>
                <td className="col-name">v × (L_fba + R) + ss_fba</td>
              </tr>
              <tr>
                <td className="col-name">FBA 품절 예상일수 (available)</td>
                <td>{result.fbaDaysOfSupply === null ? '∞' : `${fmt(result.fbaDaysOfSupply)}일`}</td>
                <td className="col-name">사용가능 / velocity (보수적)</td>
              </tr>
              <tr>
                <td className="col-name">현재고 기준 소진일수</td>
                <td>{result.fbaDaysWithCurrentStock === null ? '∞' : `${fmt(result.fbaDaysWithCurrentStock)}일`}</td>
                <td className="col-name">현재고 / velocity</td>
              </tr>
              <tr>
                <td className="col-name">총 커버리지 (전 파이프라인)</td>
                <td>{result.totalCoverageDays === null ? '∞' : `${fmt(result.totalCoverageDays)}일`}</td>
                <td className="col-name">(현재고 + 3PL 포지션) / velocity · in-transit 1회</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 카드 2 — 3PL 재주문 */}
      <div className="panel">
        <h2>
          ② 3PL 재주문 (공급사 → 3PL)
          <span className="gross-note">· {result.needsReorder3pl ? '지금 재주문 필요' : '재주문 여유'}</span>
        </h2>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="label">3PL 포지션 (재고+발주중)</div>
            <div className="value">{fmt(result.threePlPosition, 0)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">3PL 재주문점 (ROP_3pl)</div>
            <div className="value">{fmt(result.threePlReorderPoint)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">재주문까지 남은 일수</div>
            <div className="value">
              {result.daysUntilReorder3pl === null ? '∞' : `${fmt(result.daysUntilReorder3pl)}일`}
            </div>
          </div>
          <div className="kpi-card">
            <div className="label">권장 발주량</div>
            <div className="value">{fmt(result.recommended3plOrderQty, 0)}</div>
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data">
            <thead>
              <tr><th className="col-name">지표</th><th>값</th><th className="col-name">산식</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-name">3PL 포지션</td>
                <td>{fmt(result.threePlPosition, 0)}</td>
                <td className="col-name">stock3pl + onOrder3pl (★ 인바운드 미포함)</td>
              </tr>
              <tr>
                <td className="col-name">3PL 목표 수준</td>
                <td>{fmt(result.threePlTargetLevel)}</td>
                <td className="col-name">v × (L_sup + R) + ss_3pl</td>
              </tr>
              <tr>
                <td className="col-name">권장 발주량</td>
                <td>{fmt(result.recommended3plOrderQty, 0)}</td>
                <td className="col-name">목표 − 포지션, MOQ·로트 반영</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 10, marginBottom: 0 }}>
          발송/재주문 시점은 오늘(브라우저 로컬) 기준 · 매출 데이터 없어도 수동 입력만으로 계산됩니다.
        </p>
      </div>
    </>
  );
}
