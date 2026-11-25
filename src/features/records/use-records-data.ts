import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { getRecords } from '@/features/backend/server-api'
import { mergeRecords, records } from '@/features/backend/records-adapters'
import { useServerData } from '@/features/backend/use-server-data'
import { api } from '@/shared/api/client'
import type { RecordRange } from '@/features/reports/record-period'
import { boardRecords, connectionRecord, recordsRequests, type RecordsData, type RecordsMate } from './records-source'

/**
 * 38 for the records page's range and mate filter (records-source.ts). A filter change starts a new read; an answer
 * that arrives after the next change is dropped (use-server-data.ts).
 *
 * Reads: the scope's sums (one read, or the started months of a year), plus each mate's own read when 「전체」 shows two
 * or more mates (the board colours a day's capsules by mate). One persona with two server ids is read once per id.
 */
export function useRecordsData(range: RecordRange, mates: readonly RecordsMate[] | null, selected: RecordsMate | null) {
  const { status, homeContentVersion } = useBackend()
  const { state } = useDemo()
  const userId = state.profile.loggedIn ? state.profile.userId : undefined
  const key = status === 'ready' && userId && mates
    ? [userId, homeContentVersion, range.period, range.startDay, selected?.id ?? 'all', mates.map(mate => `${mate.id}=${mate.serverIds.join('+')}`).join(',')].join('|')
    : null
  return useServerData<RecordsData>(key, async () => {
    const reads = recordsRequests(range)
    const read = async (mateId?: number) =>
      mergeRecords(await Promise.all(reads.map(async request => records(await getRecords(api, { ...request, ...(mateId ? { mateId } : {}) })))))
    const readMate = async (mate: RecordsMate) => mergeRecords(await Promise.all(mate.serverIds.map(id => read(id))))
    const all = mates ?? []
    const totals = selected ? await readMate(selected) : await read()
    const parts = selected
      ? [{ mate: selected, view: totals }]
      : all.length === 1
        ? [{ mate: all[0]!, view: totals }]
        : await Promise.all(all.map(async mate => ({ mate, view: await readMate(mate) })))
    const mateOf = (serverId: number) => all.find(mate => mate.serverIds.includes(serverId))
    const recent = totals.recent.map(connection => connectionRecord(connection, mateOf(connection.mateId)))
    return {
      totals,
      records: boardRecords(parts, recent),
      recent,
      matesInRange: parts.filter(part => part.view.totalConnectedSeconds > 0).length,
    }
  }, userId === undefined ? null : String(userId))
}
