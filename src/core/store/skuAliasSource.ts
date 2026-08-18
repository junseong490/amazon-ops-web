// SKU/ASIN 별칭(짧은 이름) 영구 저장소 경계.
// dataSource.ts와 같은 패턴: 인터페이스 + 브라우저 구현(localStorage) + 폴백(InMemory).
// 값이 작은 key-value 맵이라 IndexedDB 대신 localStorage 단일 키(JSON)로 구현한다.
// (sessionStorage/in-memory 단독은 새로고침·재방문 후 유실되므로 쓰지 않는다.)

export interface SkuAliasSource {
  /** 저장된 별칭 맵을 읽는다(없으면 빈 객체). key = sku 또는 asin (itemAxis 그대로). */
  loadAliases(): Promise<Record<string, string>>;
  /** 별칭 저장. alias === '' 면 해당 키 별칭 삭제(원본 이름으로 복귀). */
  saveAlias(key: string, alias: string): Promise<void>;
  /** 저장된 별칭 전체 삭제. */
  clear(): Promise<void>;
}

/** 테스트/SSR/폴백용 인메모리 구현. */
export class InMemoryAliasSource implements SkuAliasSource {
  private data: Record<string, string> = {};
  async loadAliases(): Promise<Record<string, string>> {
    return { ...this.data };
  }
  async saveAlias(key: string, alias: string): Promise<void> {
    const trimmed = alias.trim();
    if (trimmed === '') delete this.data[key];
    else this.data[key] = trimmed;
  }
  async clear(): Promise<void> {
    this.data = {};
  }
}

export const ALIAS_STORAGE_KEY = 'amazon-ops-web:sku-aliases';

/**
 * localStorage 기반 영구 저장(선택 기능). 브라우저를 벗어나지 않는다.
 * 단일 키에 JSON 맵으로 저장하므로 새로고침·재방문 후에도 유지된다.
 */
export class LocalStorageAliasSource implements SkuAliasSource {
  constructor(private readonly storage: Storage) {}

  async loadAliases(): Promise<Record<string, string>> {
    const raw = this.storage.getItem(ALIAS_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === 'string') out[k] = v;
        }
        return out;
      }
      return {};
    } catch {
      return {};
    }
  }

  async saveAlias(key: string, alias: string): Promise<void> {
    const map = await this.loadAliases();
    const trimmed = alias.trim();
    if (trimmed === '') delete map[key];
    else map[key] = trimmed;
    this.storage.setItem(ALIAS_STORAGE_KEY, JSON.stringify(map));
  }

  async clear(): Promise<void> {
    this.storage.removeItem(ALIAS_STORAGE_KEY);
  }
}

/** 브라우저면 localStorage, 아니면 인메모리. */
export function createDefaultSkuAliasSource(): SkuAliasSource {
  if (typeof localStorage !== 'undefined') return new LocalStorageAliasSource(localStorage);
  return new InMemoryAliasSource();
}
