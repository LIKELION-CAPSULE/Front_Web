import { useMemo } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { getMyMates } from '@/features/backend/server-api'
import { myMates } from '@/features/backend/records-adapters'
import { useServerData } from '@/features/backend/use-server-data'
import { api } from '@/shared/api/client'
import { availableMates } from './catalog'
import { myMatesByLaunchMate } from './my-mates-source'

export { capsulesFromConnections, estimatedCapsuleCount, myMatesByLaunchMate } from './my-mates-source'

/**
 * 37 내 메이트, by launch mate (catalog.ts): a server mate is matched by id, else by its server name, so the two 「서진」
 * entries (id 2 · 3) are one 서도현 (connected-mate.ts `frontMateOf`). Read again when the account or /home changes
 * (a connection that ended refreshes /home).
 */
export function useMyMates() {
  const { status, home, homeContentVersion } = useBackend()
  const { state } = useDemo()
  const userId = state.profile.loggedIn ? state.profile.userId : undefined
  const key = status === 'ready' && userId ? `${userId}:${homeContentVersion}` : null
  const result = useServerData(key, async () => myMates(await getMyMates(api)), userId === undefined ? null : String(userId))
  const byMate = useMemo(() => myMatesByLaunchMate(result.data ?? [], availableMates(home)), [result.data, home])
  return { ...result, byMate }
}

