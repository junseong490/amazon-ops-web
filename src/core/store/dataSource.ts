// DataSource 경계 (LOCKED §15, plan §2.2).
// UI·집계 코어는 데이터 출처를 모른다. MVP 구현 = 파일 업로드 + IndexedDB 로컬 캐시.
// 유료 단계에선 같은 인터페이스를 ApiSource(SP-API 프록시) + ServerStore로 교체만 하면 된다.

import type { SalesRecord } from '../../types/domain';

export interface DataSource {
  /** 저장된 정규화 레코드를 읽는다(없으면 빈 배열). */
  loadRecords(): Promise<SalesRecord[]>;
  /** 정규화 레코드 스냅샷을 저장(덮어쓰기). */
  saveRecords(records: SalesRecord[]): Promise<void>;
  /** 저장된 데이터 삭제. */
  clear(): Promise<void>;
}

/** 테스트/SSR/폴백용 인메모리 구현. */
export class InMemorySource implements DataSource {
  private data: SalesRecord[] = [];
  async loadRecords(): Promise<SalesRecord[]> {
    return this.data.slice();
  }
  async saveRecords(records: SalesRecord[]): Promise<void> {
    this.data = records.slice();
  }
  async clear(): Promise<void> {
    this.data = [];
  }
}

const DB_NAME = 'amazon-ops-web';
const STORE = 'sales';
const KEY = 'current-session';

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

/**
 * IndexedDB 기반 로컬 세션 캐시(선택 기능). 브라우저를 벗어나지 않는다.
 * IndexedDB를 못 쓰는 환경이면 InMemorySource로 폴백해서 쓰면 된다.
 */
export class LocalIndexedDbSource implements DataSource {
  async loadRecords(): Promise<SalesRecord[]> {
    const db = await openDb();
    try {
      return await new Promise<SalesRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve((req.result as SalesRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async saveRecords(records: SalesRecord[]): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(records, KEY);
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
export function createDefaultSource(): DataSource {
  if (typeof indexedDB !== 'undefined') return new LocalIndexedDbSource();
  return new InMemorySource();
}
