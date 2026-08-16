// 통화 포맷 유틸. 통화별 분리 표시 전제(LOCKED §8) — 혼재 합산은 하지 않는다.

const fmtCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string): Intl.NumberFormat {
  const key = currency || 'XXX';
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: key,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2,
      });
    } catch {
      // 알 수 없는 통화 코드 → 숫자 + 코드
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    }
    fmtCache.set(key, f);
  }
  return f;
}

/** 금액을 통화 기호와 함께 포맷. 알 수 없는 통화면 "1,234.5 CUR". */
export function formatMoney(amount: number, currency: string): string {
  try {
    return getFormatter(currency).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

/** MoneyByCurrency → "US$1,234.00 · ¥5,000" 형태의 요약 문자열. */
export function formatMoneyMap(map: Record<string, number>): string {
  const entries = Object.entries(map);
  if (entries.length === 0) return '—';
  return entries.map(([cur, amt]) => formatMoney(amt, cur)).join(' · ');
}
