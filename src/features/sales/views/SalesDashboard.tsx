// 매출 대시보드 (MVP). 국가/기간/품목/상태 필터 + KPI + 차트 + 표.
// 통화 분리 표시, "반품 차감 전(gross)" 라벨, 매출/세·배송/순매출 토글.
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AggregateOptions,
  ParseResult,
  RevenueMode,
  SalesRecord,
} from '../../../types/domain';
import { aggregate } from '../aggregate/aggregate';
import { formatMoney, formatMoneyMap } from '../../../core/money/format';
import { createDefaultSource } from '../../../core/store/dataSource';
import type { RawFile } from '../parse/pipeline';
import { ingestFiles } from '../parse/pipeline';
import { UploadPanel } from './UploadPanel';
import { ClipCell } from '../../../components/ClipCell';
import { CountUp } from '../../../components/CountUp';
import { useChartTokens, tooltipStyle } from '../../../components/chartTokens';

const source = createDefaultSource();

export function SalesDashboard() {
  const chart = useChartTokens();
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [perFile, setPerFile] = useState<ParseResult[]>([]);
  const [busy, setBusy] = useState(false);

  // 필터 상태
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('gross');
  const [itemAxis, setItemAxis] = useState<'sku' | 'asin'>('sku');
  const [excludeCancelled, setExcludeCancelled] = useState(true);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showTaxShipping, setShowTaxShipping] = useState(false);
  const [chartCurrency, setChartCurrency] = useState<string>('');

  // 초기 로드: IndexedDB 캐시 복원
  useEffect(() => {
    source
      .loadRecords()
      .then((r) => {
        if (r.length > 0) setRecords(r);
      })
      .catch(() => {
        /* 캐시 없음/미지원 — 무시 */
      });
  }, []);

  async function handleFiles(files: RawFile[]) {
    setBusy(true);
    try {
      const result = ingestFiles(files);
      // 기존 레코드와 병합하되 order-item-id로 재-dedup
      const merged = dedupById([...records, ...result.records]);
      setRecords(merged);
      setPerFile((prev) => [...prev, ...result.perFile]);
      void source.saveRecords(merged).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRecords([]);
    setPerFile([]);
    void source.clear().catch(() => undefined);
  }

  const channels = useMemo(
    () => Array.from(new Set(records.map((r) => r.salesChannel))).sort(),
    [records],
  );

  const opts: AggregateOptions = useMemo(
    () => ({
      excludeCancelled,
      revenueMode,
      itemAxis,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      statuses: undefined,
    }),
    [excludeCancelled, revenueMode, itemAxis, selectedChannels, dateFrom, dateTo],
  );

  const byDate = useMemo(() => aggregate(records, ['date'], opts), [records, opts]);
  const byChannel = useMemo(() => aggregate(records, ['channel'], opts), [records, opts]);
  const byItem = useMemo(() => aggregate(records, ['item'], opts), [records, opts]);
  const byDateItem = useMemo(() => aggregate(records, ['date', 'item'], opts), [records, opts]);

  const currencies = useMemo(
    () => Object.keys(byChannel.totals.revenueByCurrency).sort(),
    [byChannel],
  );

  // 차트 통화 기본값 보정
  useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(chartCurrency)) {
      setChartCurrency(currencies[0]);
    }
  }, [currencies, chartCurrency]);

  const totalIssues = perFile.reduce((s, f) => s + f.issues.length, 0);

  if (records.length === 0) {
    return (
      <>
        <div className="panel">
          <h2>업로드</h2>
          <UploadPanel onFiles={handleFiles} busy={busy} />
        </div>
        <div className="panel">
          <div className="empty">
            <div className="empty-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <rect x="7" y="12" width="3" height="6" rx="1" />
                <rect x="12" y="8" width="3" height="10" rx="1" />
                <rect x="17" y="5" width="3" height="13" rx="1" />
              </svg>
            </div>
            <div className="empty-title">아직 표시할 매출 데이터가 없습니다</div>
            <div className="empty-sub">
              위 영역에 All Orders 리포트(.txt / TSV)를 업로드하면 국가별·품목별·일별 매출과 KPI가
              자동으로 계산됩니다. 데이터는 브라우저를 벗어나지 않습니다.
            </div>
          </div>
        </div>
      </>
    );
  }

  const cur = chartCurrency || currencies[0] || '';
  const dailyData = byDate.rows.map((r) => ({
    date: r.keys[0],
    revenue: round2(r.revenueByCurrency[cur] || 0),
  }));
  const channelData = [...byChannel.rows]
    .sort((a, b) => (b.revenueByCurrency[cur] || 0) - (a.revenueByCurrency[cur] || 0))
    .map((r) => ({ channel: r.keys[0], revenue: round2(r.revenueByCurrency[cur] || 0) }));
  const itemRowsSorted = [...byItem.rows].sort(
    (a, b) => (b.revenueByCurrency[cur] || 0) - (a.revenueByCurrency[cur] || 0),
  );
  const curTotal = byItem.totals.revenueByCurrency[cur] || 0;

  // 일별×품목별: 날짜 내림차순(최신 먼저), 같은 날짜 안에서는 수량 내림차순
  const dateItemRows = [...byDateItem.rows].sort((a, b) => {
    if (a.keys[0] !== b.keys[0]) return a.keys[0] < b.keys[0] ? 1 : -1;
    return b.quantity - a.quantity;
  });

  return (
    <>
      <div className="panel">
        <h2>업로드</h2>
        <UploadPanel onFiles={handleFiles} busy={busy} />
        <div className="loaded-bar">
          <span className="muted">
            {perFile.length}개 파일 · {records.length}개 라인 로드됨
          </span>
          <button className="btn" onClick={reset}>
            초기화
          </button>
        </div>
        {totalIssues > 0 && (
          <details className="issues">
            <summary>파싱 알림 {totalIssues}건 (인코딩 폴백/스킵/헤더)</summary>
            {perFile.map((f) => (
              <div key={f.fileId} style={{ marginTop: 6 }}>
                <strong>{f.fileName}</strong> · 인코딩 {f.encoding} · 라인 {f.rowCount} · 스킵{' '}
                {f.skippedCount}
                {f.issues.slice(0, 20).map((is, i) => (
                  <div key={i}>
                    · [{is.kind}] {is.message}
                    {is.row ? ` (row ${is.row})` : ''}
                  </div>
                ))}
              </div>
            ))}
          </details>
        )}
      </div>

      {/* 필터 */}
      <div className="panel">
        <h2>필터</h2>
        <div className="filters">
          <div className="field">
            <label>기간 시작</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>기간 끝</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="field">
            <label>매출 정의</label>
            <select
              value={revenueMode}
              onChange={(e) => setRevenueMode(e.target.value as RevenueMode)}
            >
              <option value="gross">매출 (gross)</option>
              <option value="net">순매출 (−할인)</option>
            </select>
          </div>
          <div className="field">
            <label>품목 축</label>
            <select value={itemAxis} onChange={(e) => setItemAxis(e.target.value as 'sku' | 'asin')}>
              <option value="sku">SKU</option>
              <option value="asin">ASIN</option>
            </select>
          </div>
          <div className="field">
            <label>차트 통화</label>
            <select value={cur} onChange={(e) => setChartCurrency(e.target.value)}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>국가/마켓</label>
            <div className="checkbox-row" style={{ flexWrap: 'wrap', maxWidth: 320 }}>
              {channels.map((ch) => (
                <label key={ch} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedChannels.length === 0 || selectedChannels.includes(ch)}
                    onChange={(e) => {
                      setSelectedChannels((prev) => {
                        const base = prev.length === 0 ? channels : prev;
                        return e.target.checked ? base.concat(ch) : base.filter((c) => c !== ch);
                      });
                    }}
                  />
                  {ch}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>옵션</label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={excludeCancelled}
                onChange={(e) => setExcludeCancelled(e.target.checked)}
              />
              취소 라인 제외
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={showTaxShipping}
                onChange={(e) => setShowTaxShipping(e.target.checked)}
              />
              세금·배송 별도 표시
            </label>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="panel">
        <h2>
          요약 KPI <span className="gross-note">· 매출은 반품 차감 전(gross)</span>
        </h2>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-badge g-blue" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 4 8-9" /><path d="M15 7h5v5" /></svg>
            </div>
            <div className="label">
              총매출 ({revenueMode === 'net' ? '순매출' : 'gross'}, 통화별)
            </div>
            <div className="value">
              {currencies.length === 0 ? (
                '—'
              ) : (
                currencies.map((c) => (
                  <span className="cur" key={c}>
                    {formatMoney(byChannel.totals.revenueByCurrency[c] || 0, c)}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-badge g-orange" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>
            </div>
            <div className="label">주문수 (distinct order-id)</div>
            <div className="value">
              <CountUp
                value={byChannel.totals.orderCount}
                format={(n) => Math.round(n).toLocaleString()}
              />
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-badge g-green" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.6" fill="#fff" /></svg>
            </div>
            <div className="label">AOV (통화별)</div>
            <div className="value">
              {currencies.map((c) => (
                <span className="cur" key={c}>
                  {formatMoney(byChannel.totals.aovByCurrency[c] || 0, c)}
                </span>
              ))}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-badge g-pink" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
            </div>
            <div className="label">판매수량</div>
            <div className="value">
              <CountUp
                value={byChannel.totals.quantity}
                format={(n) => Math.round(n).toLocaleString()}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="panel">
        <h2>차트 · 통화 {cur || '—'}</h2>
        <div className="chart-grid">
          <div className="chart-card">
            <div className="chart-title">일별 매출 추이</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="date" stroke={chart.axis} fontSize={11} />
                <YAxis stroke={chart.axis} fontSize={11} />
                <Tooltip
                  cursor={{ fill: chart.grid }}
                  formatter={(value) => formatMoney(Number(value), cur)}
                  contentStyle={tooltipStyle(chart)}
                />
                <Bar dataKey="revenue" fill={chart.series[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <div className="chart-title">국가/마켓별 매출</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="channel" stroke={chart.axis} fontSize={11} />
                <YAxis stroke={chart.axis} fontSize={11} />
                <Tooltip
                  cursor={{ fill: chart.grid }}
                  formatter={(value) => formatMoney(Number(value), cur)}
                  contentStyle={tooltipStyle(chart)}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={chart.series[i % chart.series.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 국가별 표 */}
      <div className="panel">
        <h2>국가/마켓별</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="col-name">마켓</th>
                <th>주문수</th>
                <th>수량</th>
                <th>매출(통화별)</th>
                {showTaxShipping && <th>세금</th>}
                {showTaxShipping && <th>배송·기프트</th>}
              </tr>
            </thead>
            <tbody>
              {byChannel.rows.map((r) => (
                <tr key={r.keys[0]}>
                  <ClipCell text={r.keys[0]} />
                  <td>{r.orderCount.toLocaleString()}</td>
                  <td>{r.quantity.toLocaleString()}</td>
                  <td>{formatMoneyMap(r.revenueByCurrency)}</td>
                  {showTaxShipping && <td>{formatMoneyMap(r.taxByCurrency)}</td>}
                  {showTaxShipping && <td>{formatMoneyMap(r.shippingByCurrency)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 품목별 표 */}
      <div className="panel">
        <h2>품목별 ({itemAxis.toUpperCase()})</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="col-name">품목</th>
                <th className="col-key">키</th>
                <th>수량</th>
                <th>매출(통화별)</th>
                <th>기여율({cur})</th>
              </tr>
            </thead>
            <tbody>
              {itemRowsSorted.map((r) => {
                const share = curTotal > 0 ? ((r.revenueByCurrency[cur] || 0) / curTotal) * 100 : 0;
                return (
                  <tr key={r.keys[0]}>
                    <ClipCell text={byItem.itemLabels?.[r.keys[0]] || r.keys[0]} />
                    <ClipCell text={r.keys[0]} variant="key" />
                    <td>{r.quantity.toLocaleString()}</td>
                    <td>{formatMoneyMap(r.revenueByCurrency)}</td>
                    <td>{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 일별 표 */}
      <div className="panel">
        <h2>일별 (마켓 현지시각 기준)</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="col-name">날짜</th>
                <th>주문수</th>
                <th>수량</th>
                <th>매출(통화별)</th>
              </tr>
            </thead>
            <tbody>
              {byDate.rows.map((r) => (
                <tr key={r.keys[0]}>
                  <td>{r.keys[0]}</td>
                  <td>{r.orderCount.toLocaleString()}</td>
                  <td>{r.quantity.toLocaleString()}</td>
                  <td>{formatMoneyMap(r.revenueByCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 일별 품목별 표 */}
      <div className="panel">
        <h2>일별 품목별 ({itemAxis.toUpperCase()}, 마켓 현지시각 기준)</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="col-name">날짜</th>
                <th className="col-name">품목</th>
                <th className="col-key">키</th>
                <th>수량</th>
                <th>매출(통화별)</th>
              </tr>
            </thead>
            <tbody>
              {dateItemRows.map((r) => (
                <tr key={`${r.keys[0]} ${r.keys[1]}`}>
                  <td>{r.keys[0]}</td>
                  <ClipCell text={byDateItem.itemLabels?.[r.keys[1]] || r.keys[1]} />
                  <ClipCell text={r.keys[1]} variant="key" />
                  <td>{r.quantity.toLocaleString()}</td>
                  <td>{formatMoneyMap(r.revenueByCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function dedupById(records: SalesRecord[]): SalesRecord[] {
  const seen = new Set<string>();
  const out: SalesRecord[] = [];
  for (const r of records) {
    if (seen.has(r.orderItemId)) continue;
    seen.add(r.orderItemId);
    out.push(r);
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
