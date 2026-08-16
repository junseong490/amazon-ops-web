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

const CHART_COLORS = ['#4f9cf9', '#59c3a3', '#e0a458', '#b98cf0', '#e06c75', '#7fd1e8'];

const source = createDefaultSource();

export function SalesDashboard() {
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
        <div className="panel empty">
          아직 데이터가 없습니다. All Orders 리포트(.txt)를 업로드하면 국가별·품목별·일별 매출이
          표시됩니다.
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
  const itemData = itemRowsSorted.slice(0, 10).map((r) => ({
    item: byItem.itemLabels?.[r.keys[0]] || r.keys[0],
    revenue: round2(r.revenueByCurrency[cur] || 0),
  }));
  const curTotal = byItem.totals.revenueByCurrency[cur] || 0;

  return (
    <>
      <div className="panel">
        <h2>업로드</h2>
        <UploadPanel onFiles={handleFiles} busy={busy} />
        <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
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
            <div className="label">주문수 (distinct order-id)</div>
            <div className="value">{byChannel.totals.orderCount.toLocaleString()}</div>
          </div>
          <div className="kpi-card">
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
            <div className="label">판매수량</div>
            <div className="value">{byChannel.totals.quantity.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="panel">
        <h2>차트 · 통화 {cur || '—'}</h2>
        <div className="chart-grid">
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              일별 매출 추이
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b3b4e" />
                <XAxis dataKey="date" stroke="#9fb0c0" fontSize={11} />
                <YAxis stroke="#9fb0c0" fontSize={11} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), cur)}
                  contentStyle={{ background: '#172230', border: '1px solid #2b3b4e' }}
                />
                <Bar dataKey="revenue" fill={CHART_COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              국가/마켓별 매출
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b3b4e" />
                <XAxis dataKey="channel" stroke="#9fb0c0" fontSize={11} />
                <YAxis stroke="#9fb0c0" fontSize={11} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), cur)}
                  contentStyle={{ background: '#172230', border: '1px solid #2b3b4e' }}
                />
                <Bar dataKey="revenue">
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              품목 Top 10 ({itemAxis.toUpperCase()})
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={itemData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b3b4e" />
                <XAxis type="number" stroke="#9fb0c0" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="item"
                  stroke="#9fb0c0"
                  fontSize={11}
                  width={120}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), cur)}
                  contentStyle={{ background: '#172230', border: '1px solid #2b3b4e' }}
                />
                <Bar dataKey="revenue" fill={CHART_COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 국가별 표 */}
      <div className="panel">
        <h2>국가/마켓별</h2>
        <table className="data">
          <thead>
            <tr>
              <th>마켓</th>
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
                <td>{r.keys[0]}</td>
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

      {/* 품목별 표 */}
      <div className="panel">
        <h2>품목별 ({itemAxis.toUpperCase()})</h2>
        <table className="data">
          <thead>
            <tr>
              <th>품목</th>
              <th>키</th>
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
                  <td>{byItem.itemLabels?.[r.keys[0]] || r.keys[0]}</td>
                  <td className="muted">{r.keys[0]}</td>
                  <td>{r.quantity.toLocaleString()}</td>
                  <td>{formatMoneyMap(r.revenueByCurrency)}</td>
                  <td>{share.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 일별 표 */}
      <div className="panel">
        <h2>일별 (마켓 현지시각 기준)</h2>
        <table className="data">
          <thead>
            <tr>
              <th>날짜</th>
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
