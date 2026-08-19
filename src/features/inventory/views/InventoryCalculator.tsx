// 재고 계산기 — 마켓(이행모델)별 분기. JP=FBM(단일창고) / US=FBA(2단 보충).
// 계산은 순수 함수(calc/**). 매출 데이터가 있으면 채널별 velocity를 제시(선택 연동).
import { useEffect, useMemo, useState } from 'react';
import { itemVelocities, type ItemVelocity } from '../calc/velocity';
import { MODEL_CHANNEL, type FulfillmentModel } from '../calc/strategy';
import { createDefaultSource } from '../../../core/store/dataSource';
import type { SalesRecord } from '../../../types/domain';
import { FbmPanel } from './FbmPanel';
import { FbaPanel } from './FbaPanel';

const source = createDefaultSource();

export function InventoryCalculator() {
  const [model, setModel] = useState<FulfillmentModel>('FBM');
  const [records, setRecords] = useState<SalesRecord[]>([]);

  useEffect(() => {
    source
      .loadRecords()
      .then((r) => {
        if (r.length > 0) setRecords(r);
      })
      .catch(() => {
        /* 캐시 없음/미지원 — 수동 입력만으로 동작 */
      });
  }, []);

  // 이행모델의 대표 채널로 velocity를 분리(합산 오염 방지, plan §10.6).
  const velocities = useMemo<ItemVelocity[]>(
    () => (records.length > 0 ? itemVelocities(records, { channels: [MODEL_CHANNEL[model]] }) : []),
    [records, model],
  );

  return (
    <>
      <div className="panel">
        <h2>마켓 / 이행모델</h2>
        <div className="filters">
          <div className="field">
            <label>마켓 선택</label>
            <select value={model} onChange={(e) => setModel(e.target.value as FulfillmentModel)}>
              <option value="FBM">일본 (JP)</option>
              <option value="FBA">미국 (US)</option>
            </select>
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
              {model === 'FBM'
                ? '창고 1곳에서 직접 고객에게 출고.'
                : 'FBA에 재고를 언제·얼마나 보낼지 계산.'}
            </span>
          </div>
        </div>
      </div>

      {model === 'FBM' ? <FbmPanel velocities={velocities} /> : <FbaPanel velocities={velocities} />}
    </>
  );
}
