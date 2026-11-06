type SnapshotStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>

/** Remove this account's recovery metadata and saved rooms without clearing other accounts. */
export function removeAccountSnapshots(storage: SnapshotStorage, userId: number) {
  const prefixes = [`capsule-presence:${userId}:`, `capsule-session:${userId}:`, `capsule-goal-notice:${userId}:`]
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index)
    if (key && (key === `capsule-saved-rooms:${userId}` || prefixes.some(prefix => key.startsWith(prefix)))) storage.removeItem(key)
  }
}
