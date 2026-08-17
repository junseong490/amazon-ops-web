// 결과 패널 — 항상 보이는 핵심 지표 + 카테고리별 소계 막대(recharts 재사용).

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../../../core/money/format';
import type { PricingResult } from '../calc/pricing';
import { fmt } from './shared';
import { CountUp } from '../../../components/CountUp';
import { useChartTokens, tooltipStyle } from '../../../components/chartTokens';

function pct(rate: number | null): string {
  return rate === null ? '—' : `${fmt(rate * 100, 1)}%`;
}

export function ResultPanel({ result }: { result: PricingResult }) {
  const chart = useChartTokens();
  const cur = result.currency;
  const profitClass = result.netProfit >= 0 ? 'good' : 'danger';
  const chartData = result.categorySubtotals.map((c) => ({ name: c.name, cost: c.subtotal }));

  return (
    <div className="panel">
      <h2>결과 (통화 {cur})</h2>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">총비용 / 단위</div>
          <div className="value">
            <CountUp value={result.costPerUnit} format={(n) => formatMoney(n, cur)} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">순이익 / 단위</div>
          <div className="value" style={{ color: `var(--${profitClass === 'good' ? 'accent-2' : 'danger'})` }}>
            <CountUp value={result.netProfit} format={(n) => formatMoney(n, cur)} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">마진율</div>
          <div className="value">
            {result.marginRate === null ? (
              '—'
            ) : (
              <CountUp value={result.marginRate * 100} format={(n) => `${fmt(n, 1)}%`} />
            )}
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">손익분기 판매가</div>
          <div className="value">
            {result.breakevenPrice === null ? (
              <span style={{ color: 'var(--danger)' }}>불가</span>
            ) : (
              formatMoney(result.breakevenPrice, cur)
            )}
          </div>
        </div>
      </div>

      <div className="filters" style={{ marginTop: 12 }}>
        <div className="field">
          <label>ROI (순이익 / 원가)</label>
          <span className="value" style={{ fontSize: 'var(--fs-16)' }}>{pct(result.roi)}</span>
        </div>
        <div className="field">
          <label>판매가 대비 % 비용 합</label>
          <span className="value" style={{ fontSize: 'var(--fs-16)' }}>{pct(result.pctOfPriceTotal)}</span>
        </div>
        <div className="field">
          <label>원가(COGS)</label>
          <span className="value" style={{ fontSize: 'var(--fs-16)' }}>{formatMoney(result.cogs, cur)}</span>
        </div>
      </div>

      {result.breakevenPrice === null && (
        <p className="muted" style={{ fontSize: 'var(--fs-12)' }}>
          판매가 비례 비용(%)의 합이 100% 이상이라 어떤 판매가로도 손익분기를 못 넘깁니다. 비율 항목을 낮추세요.
        </p>
      )}

      <div className="chart-card" style={{ marginTop: 12 }}>
        <div className="chart-title">카테고리별 단위 비용</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
            <XAxis type="number" stroke={chart.axis} fontSize={11} />
            <YAxis type="category" dataKey="name" stroke={chart.axis} fontSize={11} width={90} />
            <Tooltip
              cursor={{ fill: chart.grid }}
              formatter={(value) => formatMoney(Number(value), cur)}
              contentStyle={tooltipStyle(chart)}
            />
            <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={chart.series[i % chart.series.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
