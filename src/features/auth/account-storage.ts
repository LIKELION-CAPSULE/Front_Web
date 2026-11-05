type SnapshotStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>

/** Remove this account's recovery metadata without clearing other accounts or unrelated preferences. */
export function removeAccountSnapshots(storage: SnapshotStorage, userId: number) {
  const prefixes = [`capsule-presence:${userId}:`, `capsule-session:${userId}:`]
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index)
    if (key && prefixes.some(prefix => key.startsWith(prefix))) storage.removeItem(key)
  }
}
