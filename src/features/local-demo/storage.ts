export const LOCAL_CACHE_PREFIX = 'capsule-local-beta:cache:'
export const LOCAL_PANEL_OPEN_KEY = 'capsule-dev-panel-open:v1'
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

/** Isolates every existing app preference/recovery cache, even if a real user has the same numeric ID. */
export function createLocalStorageScope(source: StoragePort | null): Storage {
  const memory = new Map<string, string>()
  const keys = () => source
    ? Array.from({ length: source.length }, (_, index) => source.key(index)).filter((key): key is string => !!key?.startsWith(LOCAL_CACHE_PREFIX)).map(key => key.slice(LOCAL_CACHE_PREFIX.length))
    : [...memory.keys()]
  return {
    get length() { return keys().length },
    key: index => keys()[index] ?? null,
    getItem: key => source ? source.getItem(LOCAL_CACHE_PREFIX + key) : memory.get(key) ?? null,
    setItem: (key, value) => { if (source) source.setItem(LOCAL_CACHE_PREFIX + key, value); else memory.set(key, value) },
    removeItem: key => { if (source) source.removeItem(LOCAL_CACHE_PREFIX + key); else memory.delete(key) },
    clear: () => { for (const key of keys()) { if (source) source.removeItem(LOCAL_CACHE_PREFIX + key); else memory.delete(key) } },
  }
}
