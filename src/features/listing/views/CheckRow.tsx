// 체크 1행 — 라운드스퀘어 상태 배지(그라디언트+흰 stroke 라인아이콘) + 제목 + 수치 + fix.
// 접근성: 색 단독 금지 — pass/warn/fail/info 텍스트 라벨을 반드시 병기(정본 §14.9 계승).
import type { CheckLevel, CheckResult } from '../types';

const LEVEL_META: Record<CheckLevel, { label: string; grad: string; ink: string }> = {
  pass: { label: '통과', grad: 'var(--grad-green)', ink: 'var(--success)' },
  warn: { label: '주의', grad: 'var(--grad-orange)', ink: 'var(--warn)' },
  fail: { label: '실패', grad: 'linear-gradient(150deg, #ff8a7a, #d92d20)', ink: 'var(--danger)' },
  info: { label: '정보', grad: 'var(--grad-blue)', ink: 'var(--accent)' },
};

function LevelIcon({ level }: { level: CheckLevel }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#fff',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (level) {
    case 'pass':
      return (
        <svg {...common}>
          <path d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'fail':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'warn':
      return (
        <svg {...common}>
          <path d="M12 4l9 16H3z" />
          <path d="M12 10v4M12 17.5v.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8v.5" />
        </svg>
      );
  }
}

export function CheckRow({ check }: { check: CheckResult }) {
  const meta = LEVEL_META[check.level];
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        borderTop: '1px solid var(--border)',
        alignItems: 'flex-start',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: 'none',
          width: 30,
          height: 30,
          borderRadius: 10,
          background: meta.grad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px -4px rgba(20, 20, 50, 0.28)',
          marginTop: 1,
        }}
      >
        <LevelIcon level={check.level} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 'var(--fs-13)', color: 'var(--ink)' }}>{check.title}</strong>
          <span
            style={{
              fontSize: 'var(--fs-11)',
              fontWeight: 700,
              color: meta.ink,
              border: `1px solid color-mix(in srgb, ${meta.ink} 40%, transparent)`,
              background: `color-mix(in srgb, ${meta.ink} 8%, white)`,
              borderRadius: 'var(--radius-pill)',
              padding: '1px 8px',
            }}
          >
            {meta.label}
          </span>
        </div>
        <div style={{ fontSize: 'var(--fs-12)', color: 'var(--ink)', marginTop: 3 }}>{check.detail}</div>
        {check.fix && (
          <div style={{ fontSize: 'var(--fs-12)', color: 'var(--ink-secondary)', marginTop: 2 }}>
            → {check.fix}
          </div>
        )}
      </div>
    </div>
  );
}
