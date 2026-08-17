// 차트(recharts) 색을 index.css 디자인 토큰에서 읽어온다 — 단일 출처.
// recharts는 SVG presentation 속성으로 색을 받아 var(--x)를 직접 못 쓰므로,
// 런타임에 CSS 변수 계산값을 읽어 넘긴다. light/dark 전환에 반응.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

export interface ChartTokens {
  /** 접근성 고려 구분 팔레트(--chart-1..6) */
  series: string[];
  /** 축 텍스트/선 */
  axis: string;
  /** 그리드 라인 */
  grid: string;
  /** 툴팁 배경 */
  tooltipBg: string;
  /** 툴팁 보더 */
  tooltipBorder: string;
}

const EMPTY: ChartTokens = {
  series: [],
  axis: '',
  grid: '',
  tooltipBg: '',
  tooltipBorder: '',
};

function readTokens(): ChartTokens {
  if (typeof window === 'undefined') return EMPTY;
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--chart-${i}`)),
    axis: v('--chart-axis'),
    grid: v('--chart-grid'),
    tooltipBg: v('--chart-tooltip-bg'),
    tooltipBorder: v('--chart-tooltip-border'),
  };
}

/** 현재 테마의 차트 토큰. prefers-color-scheme 변화에 맞춰 갱신된다. */
export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(() => readTokens());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTokens(readTokens());
    update(); // 마운트 후 실제 계산값으로 확정
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return tokens;
}

/** recharts 툴팁 공통 스타일(토큰 기반). */
export function tooltipStyle(t: ChartTokens): CSSProperties {
  return {
    background: t.tooltipBg,
    border: `1px solid ${t.tooltipBorder}`,
    borderRadius: 10,
    color: 'var(--text)',
    boxShadow: 'var(--shadow-pop)',
    fontSize: 12,
  };
}
