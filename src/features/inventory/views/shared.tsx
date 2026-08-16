// 재고 뷰 공용 헬퍼 — 숫자 파싱·포맷 + 안전재고 방식 입력 컴포넌트.

/** 숫자 입력(빈 문자열 허용) → number. */
export function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** 소수 자리수 제한 로케일 포맷. */
export function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** 안전재고 방식: 일수 기반(기본) / 계수 / 직접 수량. */
export type SafetyMode = 'days' | 'factor' | 'direct';

interface SafetyModeFieldProps {
  mode: SafetyMode;
  setMode: (m: SafetyMode) => void;
  days: string;
  setDays: (s: string) => void;
  factor: string;
  setFactor: (s: string) => void;
  direct: string;
  setDirect: (s: string) => void;
  computed: number;
  /** 직접 입력 라벨(FBA는 tier별로 다르게) */
  directLabel?: string;
}

/** 안전재고 방식 선택 + 방식별 값 입력 + 산출된 안전재고 표시. */
export function SafetyModeField({
  mode,
  setMode,
  days,
  setDays,
  factor,
  setFactor,
  direct,
  setDirect,
  computed,
  directLabel = '안전재고 (units)',
}: SafetyModeFieldProps) {
  return (
    <>
      <div className="field">
        <label>안전재고 방식</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as SafetyMode)}>
          <option value="days">일수 기반 (N일치)</option>
          <option value="factor">리드타임×velocity×계수</option>
          <option value="direct">직접 입력</option>
        </select>
      </div>
      {mode === 'days' && (
        <div className="field">
          <label>안전재고 일수</label>
          <input type="number" min="0" step="1" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
      )}
      {mode === 'factor' && (
        <div className="field">
          <label>안전계수</label>
          <input type="number" min="0" step="0.1" value={factor} onChange={(e) => setFactor(e.target.value)} />
        </div>
      )}
      {mode === 'direct' && (
        <div className="field">
          <label>{directLabel}</label>
          <input type="number" min="0" step="1" value={direct} onChange={(e) => setDirect(e.target.value)} />
        </div>
      )}
      <div className="field" style={{ justifyContent: 'flex-end' }}>
        <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
          적용 안전재고 = <strong>{fmt(computed)}</strong> units
        </span>
      </div>
    </>
  );
}
