import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { getRecords } from '@/features/backend/server-api'
import { mergeRecords, records } from '@/features/backend/records-adapters'
import { useServerData } from '@/features/backend/use-server-data'
import { isCurrentServerData } from '@/features/backend/server-data'
import { api } from '@/shared/api/client'
import type { RecordRange } from '@/features/reports/record-period'
import { loadRecordsScope, recordsRequests, type RecordsData, type RecordsMate } from './records-source'

/**
 * 38 for the records page's range and mate filter (records-source.ts). A filter change starts a new read; an answer
 * that arrives after the next change is dropped (use-server-data.ts). `current`: the data is this range and filter's —
 * otherwise it is the previous filter's, kept for the dimmed screen while this one loads or after it failed (its own
 * range and mate are in it), and its sums must not be shown as this filter's.
 *
 * Reads only launch mates (by `mateId`) — never an unfiltered `/records` call — so non-launch server entries can never
 * mix into 「전체」 totals, buckets or recent items. One persona with two server ids is read once per id.
 */
export function useRecordsData(range: RecordRange, mates: readonly RecordsMate[] | null, selected: RecordsMate | null) {
  const { status, homeContentVersion } = useBackend()
  const { state } = useDemo()
  const userId = state.profile.loggedIn ? state.profile.userId : undefined
  const key = status === 'ready' && userId && mates
    ? [userId, homeContentVersion, range.period, range.startDay, selected?.id ?? 'all', mates.map(mate => `${mate.id}=${mate.serverIds.join('+')}`).join(',')].join('|')
    : null
  const result = useServerData<RecordsData>(key, async () => {
    const reads = recordsRequests(range)
    const read = async (mateId: number) =>
      mergeRecords(await Promise.all(reads.map(async request => records(await getRecords(api, { ...request, mateId })))))
    const readMate = async (mate: RecordsMate) => mergeRecords(await Promise.all(mate.serverIds.map(id => read(id))), { samePeriod: true })
    return loadRecordsScope(range, mates ?? [], selected, readMate)
  }, userId === undefined ? null : String(userId))
  return { ...result, current: isCurrentServerData(result, key) }
}
