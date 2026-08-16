// 입찰 파라미터 입력(전부 편집) — §5c 기본값. 하방 보수 강조.
import type { BidParams } from '../types';

interface Props {
  params: BidParams;
  onChange: (patch: Partial<BidParams>) => void;
  negativeCandidateClicks: number;
  onNegativeClicksChange: (v: number) => void;
}

function pctToStr(v: number): string {
  return String(Math.round(v * 100));
}
function strToPct(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n / 100 : 0;
}
function numOr(s: string, fallback: number): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

export function AdsParams({ params, onChange, negativeCandidateClicks, onNegativeClicksChange }: Props) {
  return (
    <div className="panel">
      <h2>
        입찰 파라미터
        <span className="gross-note">· 하방 보수적(노출 보호)</span>
      </h2>
      <div className="filters">
        <div className="field">
          <label>전역 목표 ACOS (%)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={pctToStr(params.targetAcos)}
            onChange={(e) => onChange({ targetAcos: strToPct(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>전략</label>
          <select
            value={params.strategyMode}
            onChange={(e) => onChange({ strategyMode: e.target.value as BidParams['strategyMode'] })}
          >
            <option value="balanced">균형 (상·하 모두)</option>
            <option value="waste-cut">낭비컷 (인하만)</option>
            <option value="growth">성장 (인상 허용)</option>
          </select>
        </div>
        <div className="field">
          <label>통화</label>
          <select
            value={params.currency}
            onChange={(e) => onChange({ currency: e.target.value as BidParams['currency'] })}
          >
            <option value="USD">USD (미국) · 2자리</option>
            <option value="JPY">JPY (일본) · 정수</option>
          </select>
        </div>
        <div className="field">
          <label>최대 인상폭 (%)</label>
          <input
            type="number"
            min="0"
            step="5"
            value={pctToStr(params.maxIncreasePct)}
            onChange={(e) => onChange({ maxIncreasePct: strToPct(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>최대 인하폭 (%) · 보수</label>
          <input
            type="number"
            min="0"
            step="5"
            value={pctToStr(params.maxDecreasePct)}
            onChange={(e) => onChange({ maxDecreasePct: strToPct(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>입찰 하한 (bid floor)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={String(params.bidFloor)}
            onChange={(e) => onChange({ bidFloor: numOr(e.target.value, 0.02) })}
          />
        </div>
        <div className="field">
          <label>입찰 상한 (선택)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="없음"
            value={params.bidCeiling == null ? '' : String(params.bidCeiling)}
            onChange={(e) => onChange({ bidCeiling: e.target.value === '' ? null : numOr(e.target.value, 0) })}
          />
        </div>
        <div className="field">
          <label>저데이터 최소 클릭</label>
          <input
            type="number"
            min="0"
            step="1"
            value={String(params.minClicks)}
            onChange={(e) => onChange({ minClicks: Math.round(numOr(e.target.value, 10)) })}
          />
        </div>
        <div className="field">
          <label>네거티브 판정 클릭</label>
          <input
            type="number"
            min="0"
            step="1"
            value={String(negativeCandidateClicks)}
            onChange={(e) => {
              const v = Math.round(numOr(e.target.value, 15));
              onNegativeClicksChange(v);
              onChange({ zeroSaleClicks: v });
            }}
          />
        </div>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={params.applyRpcCap}
              onChange={(e) => onChange({ applyRpcCap: e.target.checked })}
            />{' '}
            RPC 상한 적용
          </label>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 8 }}>
        하방 조정은 1회 최대 −{Math.round(params.maxDecreasePct * 100)}%로 제한하고 bid floor 아래로 내리지
        않습니다(§5c: 노출을 죽이지 않는다). 낭비 키워드는 완만 인하 + 네거티브 후보로 제안합니다.
      </p>
    </div>
  );
}
