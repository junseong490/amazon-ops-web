// 이행모델 전략 매핑 — 마켓(sales-channel) → FBM/FBA. plan §10.2.
// 현재 확정 사실: JP(Amazon.co.jp)=FBM, US(Amazon.com)=FBA. 확장은 매핑표로만 열어둠.

export type FulfillmentModel = 'FBM' | 'FBA';

/** 마켓(채널) → 기본 이행모델. 사용자가 UI에서 오버라이드 가능. */
export const CHANNEL_MODEL: Record<string, FulfillmentModel> = {
  'Amazon.co.jp': 'FBM',
  'Amazon.com': 'FBA',
};

/**
 * 채널명으로 기본 이행모델을 유추. 미지의 채널은 fallback(기본 FBM).
 * 대소문자·공백은 정규화해 매칭.
 */
export function modelForChannel(
  channel: string,
  fallback: FulfillmentModel = 'FBM',
): FulfillmentModel {
  const key = (channel || '').trim();
  if (key in CHANNEL_MODEL) return CHANNEL_MODEL[key];
  const lower = key.toLowerCase();
  for (const [ch, model] of Object.entries(CHANNEL_MODEL)) {
    if (ch.toLowerCase() === lower) return model;
  }
  return fallback;
}

/** 모델 → 대표 채널(velocity 채널 필터용). */
export const MODEL_CHANNEL: Record<FulfillmentModel, string> = {
  FBM: 'Amazon.co.jp',
  FBA: 'Amazon.com',
};
