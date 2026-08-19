/**
 * KPI 카드용 미니 스파크라인 — 순수 인라인 SVG/HTML(외부 차트 라이브러리 없음).
 *
 * 실데이터 시계열(일별 매출·주문수·AOV·수량)의 "형상"만 보여준다.
 * %델타·수치 라벨은 넣지 않는다(업로드 리포트 기간이 임의라 "전일 대비"가 무의미).
 * 데이터가 1점 이하면 그릴 게 없으므로 null을 반환해 자리를 우아하게 접는다.
 */
type SparkVariant = 'line' | 'spark' | 'area' | 'bars';

interface SparklineProps {
  points: number[];
  variant: SparkVariant;
}

// SVG 좌표계(mockup .mini-line viewBox와 동일)
const W = 80;
const H = 40;
const PAD = 3;

export function Sparkline({ points, variant }: SparklineProps) {
  // 1점 이하는 시계열이라 부를 수 없다 → 스파크라인 생략(빈 상태 방어).
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1; // 전부 동일값이면 평평한 선

  if (variant === 'bars') {
    // 막대: 최소값도 얇게라도 보이도록 12%~100%로 매핑.
    return (
      <div className="mini-bars" aria-hidden="true">
        {points.map((v, i) => (
          <span
            key={i}
            style={{ height: `${12 + ((v - min) / range) * 88}%` }}
          />
        ))}
      </div>
    );
  }

  const n = points.length;
  const x = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - 2 * PAD);

  const stroke = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const fill = `${stroke} L ${x(n - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;

  return (
    <svg className={`mini-line ${variant}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path className="chart-fill" d={fill} />
      <path className="chart-stroke" d={stroke} />
    </svg>
  );
}
