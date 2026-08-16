// 마켓 현지시각 캘린더 일 버킷 (LOCKED §9, review §1.2).
// sales-channel → IANA tz 매핑 후, 그 tz의 캘린더 일(YYYY-MM-DD)로 버킷팅.
// 고정 offset 금지 — Intl.DateTimeFormat(브라우저 내장, DST 자동 처리)로 변환.

/** sales-channel → IANA time zone. 그 외 마켓은 추가 가능하게 구조화. */
export const CHANNEL_TZ: Record<string, string> = {
  'amazon.com': 'America/Los_Angeles',
  'amazon.co.jp': 'Asia/Tokyo',
  'amazon.co.uk': 'Europe/London',
  'amazon.de': 'Europe/Berlin',
  'amazon.fr': 'Europe/Paris',
  'amazon.it': 'Europe/Rome',
  'amazon.es': 'Europe/Madrid',
  'amazon.ca': 'America/Toronto',
  'amazon.com.mx': 'America/Mexico_City',
  'amazon.com.au': 'Australia/Sydney',
  'amazon.in': 'Asia/Kolkata',
};

/** 미지의 sales-channel은 UTC 폴백. */
export const FALLBACK_TZ = 'UTC';

export interface TzResolution {
  tz: string;
  /** 매핑표에 없어 UTC로 폴백했는지 (경고용) */
  fallback: boolean;
}

export function resolveTz(salesChannel: string): TzResolution {
  const key = (salesChannel || '').trim().toLowerCase();
  const tz = CHANNEL_TZ[key];
  if (tz) return { tz, fallback: false };
  return { tz: FALLBACK_TZ, fallback: true };
}

// tz별 포매터 캐시 (en-CA는 YYYY-MM-DD 형식을 준다)
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatterCache.set(tz, f);
  }
  return f;
}

/**
 * 절대시각(epoch ms) → 지정 tz의 캘린더 일 'YYYY-MM-DD'.
 * DST는 Intl이 자동 처리한다.
 */
export function dateKeyInTz(instantMs: number, tz: string): string {
  const parts = getFormatter(tz).formatToParts(new Date(instantMs));
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '00';
  const d = parts.find((p) => p.type === 'day')?.value ?? '00';
  return `${y}-${m}-${d}`;
}

/** sales-channel 기준으로 절대시각을 마켓 현지 캘린더 일로 변환. */
export function marketDateKey(instantMs: number, salesChannel: string): string {
  const { tz } = resolveTz(salesChannel);
  return dateKeyInTz(instantMs, tz);
}
