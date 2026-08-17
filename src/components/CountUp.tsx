// KPI 숫자 값 변경 시 짧은 count-up 애니메이션(표시 전용, 로직 불변).
// requestAnimationFrame으로 이전 값 → 새 값 보간. prefers-reduced-motion이면 즉시 확정.
import { useEffect, useRef, useState } from 'react';

interface Props {
  /** 표시할 목표 숫자 값 */
  value: number;
  /** 애니메이션 길이(ms) */
  duration?: number;
  /** 숫자 → 표시 문자열(통화·퍼센트 등). 미지정 시 반올림 정수. */
  format?: (n: number) => string;
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 값이 바뀔 때마다 이전 값에서 새 값으로 부드럽게 카운트업. */
export function CountUp({ value, duration = 700, format }: Props) {
  const fmt = format ?? ((n: number) => String(Math.round(n)));
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const to = value;
    const from = fromRef.current;
    if (reducedMotion() || from === to || !Number.isFinite(from) || !Number.isFinite(to)) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, duration]);

  return <span className="count-up">{fmt(display)}</span>;
}
