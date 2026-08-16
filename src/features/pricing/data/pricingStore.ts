// 가격 시나리오 로컬 지속(brief §UI: IndexedDB 저장·복원).
// core/store/dataSource.ts 패턴을 그대로 따르되, 공유 DB 버전 충돌을 피하려고
// 전용 DB('amazon-ops-web-pricing')를 쓴다. 브라우저를 벗어나지 않는다.

import type { Scenario } from '../types';

export interface ScenarioStore {
  load(): Promise<Scenario | null>;
  save(scenario: Scenario): Promise<void>;
  clear(): Promise<void>;
}

/** 테스트/SSR/폴백용 인메모리 구현. */
export class InMemoryScenarioStore implements ScenarioStore {
  private data: Scenario | null = null;
  async load(): Promise<Scenario | null> {
    return this.data ? structuredClone(this.data) : null;
  }
  async save(scenario: Scenario): Promise<void> {
    this.data = structuredClone(scenario);
  }
  async clear(): Promise<void> {
    this.data = null;
  }
}

const DB_NAME = 'amazon-ops-web-pricing';
const STORE = 'scenarios';
const KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB 기반 단일 시나리오 캐시. */
export class LocalScenarioStore implements ScenarioStore {
  async load(): Promise<Scenario | null> {
    const db = await openDb();
    try {
      return await new Promise<Scenario | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve((req.result as Scenario) ?? null);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async save(scenario: Scenario): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(scenario, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}

/** 브라우저면 IndexedDB, 아니면 인메모리. */
export function createScenarioStore(): ScenarioStore {
  if (typeof indexedDB !== 'undefined') return new LocalScenarioStore();
  return new InMemoryScenarioStore();
}
