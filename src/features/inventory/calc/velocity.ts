// 매출 데이터 → 품목별 일 평균 판매량(velocity) 산출 — 순수 함수.
// sales/aggregate를 import 재사용만 한다(집계 로직 수정 금지). 선택적 연동(brief A).

import type { AggregateOptions, SalesRecord } from '../../../types/domain';
import { aggregate } from '../../sales/aggregate/aggregate';

export interface ItemVelocity {
  /** 품목 키 (sku 또는 asin, itemAxis에 따름) */
  key: string;
  /** 표시 라벨 (productName 폴백 포함) */
  label: string;
  /** 기간 내 총 판매수량 */
  totalQty: number;
  /** 판매가 관측된 일수(집계 날짜 버킷 수) */
  days: number;
  /** 일 평균 판매량 = totalQty / days */
  velocity: number;
}

/**
 * 이미 업로드된 매출 레코드에서 품목별 일 평균 판매량을 계산한다.
 * days = 데이터에 존재하는 마켓 현지 캘린더 일 수(최소 1). velocity 내림차순 정렬.
 */
export function itemVelocities(
  records: SalesRecord[],
  options?: Partial<AggregateOptions>,
): ItemVelocity[] {
  if (records.length === 0) return [];
  const byItem = aggregate(records, ['item'], options);
  const byDate = aggregate(records, ['date'], options);
  const days = Math.max(1, byDate.rows.length);

  return byItem.rows
    .map((r) => {
      const key = r.keys[0];
      return {
        key,
        label: byItem.itemLabels?.[key] || key,
        totalQty: r.quantity,
        days,
        velocity: r.quantity / days,
      };
    })
    .sort((a, b) => b.velocity - a.velocity);
}
