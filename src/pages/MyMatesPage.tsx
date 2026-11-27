import { AppPanel } from '@/shared/ui/AppPanel'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates, type AvailableMate } from '@/features/mates/catalog'
import { chaerinArtwork, mateArtwork, matePortrait } from '@/features/mates/artwork'
import { formatFirstMetDate } from '@/features/mates/my-mates-utils'
import { capsulesFromConnections, estimatedCapsuleCount, useMyMates } from '@/features/mates/use-my-mates'
import { AFFINITY_STAGE_COUNT, resolveMateFeatures } from '@/features/mates/mate-features'
import { MatePreview } from '@/features/mates/components/MatePreview'
import { MateSwitcher, type MateSwitcherItem } from '@/features/mates/components/MateSwitcher'
import { formatTogether, totalCapsuleSeconds } from '@/features/mates/capsule-jar/capsule-jar-data'
import { capsulesForConnection } from '@/features/mates/capsule-jar/capsule-floor-layout'
import type { CapsuleJarHandle } from '@/features/mates/capsule-jar/CapsuleJar'
import { MateTimeColumn } from '@/features/mates/components/MateTimeColumn'
import { PixelSnow } from '@/features/mates/pixel-snow/PixelSnow'
import { waistFraming } from '@/features/mates/my-mates-framing'
import { capsuleJarTheme } from '@/features/mates/capsule-jar/capsule-jar-theme'
import { affinityProgressView } from '@/features/mates/affinity-progress'
import { normalizeAffinityStage, notMetAffinity } from '@/features/mates/affinity-stages'
import { mateWorldsForStage, worldContentFromServer } from '@/features/mates/mate-worlds'
import { useMateWorldContent, WORLD_SAMPLES_ON } from '@/features/mates/use-mate-worlds'
import type { StudySettlement } from '@/shared/api/types'
import { capsuleVisitKey } from '@/features/mates/capsule-jar/capsule-jar-visit'
import { useCapsuleVisit } from '@/features/mates/capsule-jar/use-capsule-visit'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { CapsuleEmptyState } from '@/shared/ui/CapsuleEmptyState'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { useConnectMate } from '@/features/mates/use-connect-mate'
import { MateMenu } from '@/features/mates/components/MateMenu'
import { Icon } from '@/shared/ui/Icon'
import '@/features/mates/mates.css'
import '@/features/mates/my-mates.css'

/** The mate panel (big Live2D mate over the capsule floor): its own chunk; the three.js scene inside loads once it is on screen. */
const CapsuleJar = lazy(() => import('@/features/mates/capsule-jar/CapsuleJar'))

// Capsule scene preview (`?capsules=preview`): development / local dummy mode only. In production builds the
// branch is a constant `null`, so the preview is not bundled at all.
const CapsuleJarPreview = import.meta.env.DEV
  ? lazy(() => import('@/features/mates/capsule-jar/CapsuleJarPreview'))
  : null

type DevSamples = typeof import('@/features/mates/dev-samples')

/**
 * Sample affinity / world stories and preview mates: development only. `import.meta.env.DEV` is a build-time constant,
 * so in production this hook returns null and the dynamic import (and the samples) are not bundled.
 */
function useDevSamples(): DevSamples | null {
  const [samples, setSamples] = useState<DevSamples | null>(null)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    let cancelled = false
    void import('@/features/mates/dev-samples').then((module) => {
      if (!cancelled) setSamples(module)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return import.meta.env.DEV ? samples : null
}

function isReviewMyMatesLoading(): boolean {
  return (
    import.meta.env.DEV &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reviewScenario === 'my-mates-loading'
  )
}

function MyMatesWindowFrame({ loadingScreen, children }: { loadingScreen?: 'my-mates'; children: React.ReactNode }) {
  return (
    <AppPanel title="내 메이트" hideTitle className="my-mates-window" loadingScreen={loadingScreen} bodyClassName="my-mates-window-body">
      {children}
    </AppPanel>
  )
}

/** The mate's v2 card still; mates without bundled stills use the server's portrait. */
function cardArtFor(mate: AvailableMate) {
  return mateArtwork(mate.id)?.card ?? matePortrait(mate.id, mate.image)
}

export default function MyMatesPage() {
  const { home, activeSummary, status, mateDetails, loadMateDetail, resetMateConversation } = useBackend()
  const [resetDone, setResetDone] = useState<string | null>(null)
  // 37 내 메이트: totals, affinity, the unlocks and the latest connections, by launch mate.
  const server = useMyMates()
  const { state } = useDemo()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modelAttempt, setModelAttempt] = useState(0)
  const [listView, setListView] = useState(false)
  /** The first scene pours in fully; after picking another mate the pour is short. */
  const [pourKind, setPourKind] = useState<'enter' | 'switch'>('enter')
  const devSamples = useDevSamples()
  const jarRef = useRef<CapsuleJarHandle>(null)

  const features = resolveMateFeatures(import.meta.env.DEV, searchParams.get('features'))
  // Every development-only branch below starts with `import.meta.env.DEV` so production builds drop it entirely.
  const previewMates =
    import.meta.env.DEV && devSamples && searchParams.get('mates') === 'demo' ? devSamples.PREVIEW_MATES : null
  const loading = status === 'loading' || (server.status === 'loading' && !server.data) || isReviewMyMatesLoading()

  // Every open mate, the most recently connected first (the first one is shown when `?mate=` is absent): a running
  // connection first, then by 37 `lastConnectedAt`.
  const mates = useMemo(() => {
    const latest = (mate: AvailableMate) =>
      state.activeSession?.mateId === mate.id || Boolean(state.activeSession?.characterIds.includes(mate.characterId)) ||
      String(activeSummary?.mateId) === mate.characterId
        ? Number.MAX_SAFE_INTEGER
        : server.byMate.get(mate.id)?.lastConnectedAt ?? 0
    return availableMates(home)
      .slice()
      .sort((a, b) => latest(b) - latest(a))
  }, [home, state.activeSession, activeSummary, server.byMate])

  const requestedMateId = searchParams.get('mate')
  const previewMate = import.meta.env.DEV ? previewMates?.find((mate) => mate.id === requestedMateId) : undefined
  const selectedMate = (requestedMateId ? mates.find((mate) => mate.id === requestedMateId) : undefined) ?? mates[0]
  const selectedId = previewMate?.id ?? selectedMate?.id
  const detail = selectedMate ? mateDetails[selectedMate.id] : undefined
  const mine = selectedMate ? server.byMate.get(selectedMate.id) : undefined
  // 「○○ 만나러 가기」 starts the connection right away, the same path as the home card's arrow (credits and an
  // ongoing connection are handled there); 「프로필 보기」 below it opens the mate's page.
  const meet = useConnectMate(selectedMate)
  // 세계관 examples (development with the local mock, and preview mates); production: none (mate-worlds.ts).
  const worldSamples = useMateWorldContent({
    enabled: features.world,
    mateId: previewMate ? 'chaerin' : selectedMate?.id,
    mateName: previewMate?.name ?? selectedMate?.name,
    mateImage: selectedMate?.image,
    samples: WORLD_SAMPLES_ON || Boolean(previewMate),
  })

  // The big Live2D mate: the hero still shows first; the model is fetched only after the entry pour is over (the
  // scene reports it, so it is on screen too) and the browser is idle, then MatePreview crossfades to it.
  const [liveFor, setLiveFor] = useState<string | null>(null)
  const liveAllowed = Boolean(selectedId) && liveFor === selectedId
  const capsulePreview = Boolean(import.meta.env.DEV) && searchParams.get('capsules') === 'preview'
  const onSceneSettled = useCallback(() => {
    if (!selectedId) return
    const allow = () => setLiveFor(selectedId)
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(allow, { timeout: 1500 })
    else window.setTimeout(allow, 200)
  }, [selectedId])
  useEffect(() => {
    if (!selectedMate || !loadMateDetail || detail || !(liveAllowed || capsulePreview)) return
    void loadMateDetail(selectedMate.id, modelAttempt > 0).catch(() => {})
  }, [selectedMate, loadMateDetail, detail, modelAttempt, liveAllowed, capsulePreview])

  const selectMate = useCallback(
    (mateId: string) => {
      setPourKind('switch')
      const next = new URLSearchParams(searchParams)
      if (next.get('mate') !== mateId) {
        next.set('mate', mateId)
        setSearchParams(next)
      }
    },
    [searchParams, setSearchParams],
  )

  const capsules = useMemo(() => {
    if (import.meta.env.DEV && previewMate && devSamples) {
      return devSamples.generateDummyCapsules(previewMate.count, { seed: previewMate.seed, idPrefix: previewMate.id })
    }
    // 37 lists a mate's newest five connections: those are the jar's capsules (each opens its record card).
    return capsulesFromConnections(mine?.recent ?? [])
  }, [previewMate, devSamples, mine])
  const visit = useCapsuleVisit(capsuleVisitKey(state.profile.userId, selectedId ?? 'none'), capsules)

  if (CapsuleJarPreview && searchParams.get('capsules') === 'preview') {
    return (
      <Suspense fallback={null}>
        <CapsuleJarPreview
          records={state.records}
          characterId={selectedMate?.characterId}
          mateId={selectedMate?.id ?? 'chaerin'}
          mateName={selectedMate?.name ?? '채린'}
          userId={state.profile.userId}
          model={detail?.model}
        />
      </Suspense>
    )
  }

  if (loading) {
    return (
      <MyMatesWindowFrame loadingScreen="my-mates">
        <div aria-busy="true">
          <span className="sr-only" role="status">
            내 메이트 정보를 불러오고 있어요.
          </span>
          <div className="my-mates-skeleton-scene skeleton-line" aria-hidden="true" />
          <div className="my-mates-skeleton-bar" aria-hidden="true">
            <span className="skeleton-line" />
            <span className="skeleton-line" />
          </div>
        </div>
      </MyMatesWindowFrame>
    )
  }

  if (server.status === 'error' && !server.data) {
    return (
      <MyMatesWindowFrame>
        <div className="my-mates-empty-box" role="alert">
          <p className="my-mates-empty-title">내 메이트 정보를 불러오지 못했어요.</p>
          <Button onClick={server.retry}>다시 시도</Button>
        </div>
      </MyMatesWindowFrame>
    )
  }

  if (!selectedMate || !selectedId) {
    return (
      <MyMatesWindowFrame>
        <CapsuleEmptyState
          className="my-mates-empty-box"
          message="아직 만날 수 있는 메이트가 없어요."
          action={<ButtonLink to="/">홈으로 가기</ButtonLink>}
        />
      </MyMatesWindowFrame>
    )
  }

  const mateName = previewMate?.name ?? selectedMate.name
  const totalSeconds = previewMate ? totalCapsuleSeconds(capsules) : mine?.totalConnectedSeconds ?? 0
  const firstMetAt = previewMate ? capsules[0]?.startedAt ?? null : mine?.firstMetAt ?? null

  // Affinity: the server's stage when it sends one, sample data in development (mate-features.ts decides). Production
  // without a server stage: a mate never met starts at 「1단계 · 처음 만남」 with every world locked; a mate met but
  // sent no stage shows no card (nothing is guessed).
  // The stage is put on the one stage table (affinity-stages.ts) by its name; a stage sent without names (37 `stageName:
  // null`) takes the table's names, its times and progress staying the server's.
  // Development only: `?affinity=1…5` puts the page at that stage with sample progress (the local mock tool sets it).
  const serverStage = normalizeAffinityStage(mine?.relation?.stage, mine?.relation?.stageName, mine?.relation?.nextStageName)
  const devStage = import.meta.env.DEV ? Number(searchParams.get('affinity')) : Number.NaN
  const neverMet = !previewMate && (mine?.connectionCount ?? 0) === 0
  const relation: (Partial<StudySettlement> & { stage: number; stageName: string }) | null = features.affinity
    ? import.meta.env.DEV && devSamples && Number.isInteger(devStage) && devStage >= 1 && devStage <= 5
      ? devSamples.sampleRelation(devSamples.sampleSecondsForStage(devStage))
      : serverStage && !previewMate
      ? { ...mine?.relation, ...serverStage, nextStageName: serverStage.nextStageName ?? undefined }
      : import.meta.env.DEV
        ? (devSamples?.sampleRelation(totalSeconds) ?? null)
        : neverMet
          ? notMetAffinity()
          : null
    : null
  // 세계관 (mate-worlds.ts): five places, opened by the stage above. What they are: the server's (none until its type
  // is named: 「준비 중」) in api mode, the planning examples in development with the local mock and on preview mates.
  // Never met: all locked.
  const worlds = features.world && relation
    ? mateWorldsForStage(relation.stage, {
        met: previewMate ? capsules.length > 0 : (mine?.connectionCount ?? 0) > 0 || (import.meta.env.DEV && devStage >= 1),
        content: worldSamples ?? worldContentFromServer(mine?.unlocks),
      })
    : null
  // The one progress on the page: the affinity stage (the panel caption shows the stage, the column the rest).
  const affinity = relation ? affinityProgressView(relation, AFFINITY_STAGE_COUNT, formatTogether) : null

  const switcherMates: MateSwitcherItem[] = [
    ...mates.map((mate) => ({ id: mate.id, name: mate.name, image: cardArtFor(mate) })),
    ...(import.meta.env.DEV && previewMates ? previewMates : []).map((mate) => ({ id: mate.id, name: mate.name, image: chaerinArtwork.card, tint: mate.tint })),
  ]

  // The panel's mate: the big Live2D bust (gaze follows the pointer; the v2 hero still under reduced motion, while
  // loading and on failure).
  // Development preview mates reuse 채린's art in their own colours (a CSS filter on the whole layer).
  const mateLayer = (
    <div className="my-mates-live-tint" style={previewMate?.tint ? { filter: previewMate.tint } : undefined}>
    <MatePreview
      mode="detail"
      mateId={selectedMate.id}
      model={previewMate || !liveAllowed ? undefined : detail?.model}
      scope={`my-mates-panel:${state.profile.userId ?? 'guest'}:${selectedMate.id}:${modelAttempt}`}
      image={matePortrait(selectedMate.id, selectedMate.image)}
      name={mateName}
      paused={listView}
      suppressSpeech
      showAgeBadge={false}
      stageClassName="my-mates-live"
      framing={waistFraming}
      onRetry={() => setModelAttempt((value) => value + 1)}
    />
    </div>
  )
  const caption = (
    <>
      <p className="my-mates-caption-name">{mateName}</p>
      {firstMetAt && <p className="my-mates-caption-date">처음 만난 날 {formatFirstMetDate(firstMetAt)}</p>}
    </>
  )
  // The jar holds the newest five connections; the count covers all of them (37 totals, estimated past the five).
  const capsuleCount = previewMate || !mine
    ? capsules.reduce((sum, capsule) => sum + capsulesForConnection(capsule.durationSeconds), 0)
    : estimatedCapsuleCount(mine)
  // The list toggle sits in the recent block's title row; the main action takes the column's full width. While the
  // column holds fewer rows than the list has, it says how many more the list shows (the column never scrolls).
  const listToggle = (hidden: number) => (
    <button type="button" className="my-mates-list-toggle" aria-pressed={listView} onClick={() => setListView(!listView)}>
      {listView ? '장면으로 보기' : hidden > 0 ? `나머지 ${hidden}개 · 목록 보기` : '목록으로 보기'}
    </button>
  )
  const actions = (
    <>
      {import.meta.env.DEV && previewMate ? (
        <span className="my-mates-meet my-mates-meet--disabled" aria-disabled="true" data-tour="my-mates-meet">시안 메이트예요</span>
      ) : (
        // The tour's 「만나러 와」 step points at both actions together, so its line never covers 「프로필 보기」.
        <div className="my-mates-meet-group" data-tour="my-mates-meet">
          {meet.error && <FeedbackMessage tone="error">{meet.error}</FeedbackMessage>}
          {resetDone === selectedMate.id && <FeedbackMessage tone="success">대화를 초기화했어요.</FeedbackMessage>}
          <Button className="my-mates-meet" loading={meet.busy} onClick={() => void meet.connect({ pickup: true })}>
            {`${mateName} 만나러 가기`}
            <Icon name="chevron" size={16} />
          </Button>
          <div className="my-mates-profile-row">
            <Link to={`/mates/${selectedMate.id}`} className="my-mates-profile-link">프로필 보기</Link>
            {/* ⋯: 「대화 초기화」 (47, MateMenu). */}
            {resetMateConversation && (
              <MateMenu key={selectedMate.id} mateId={selectedMate.id} mateName={mateName} onReset={() => setResetDone(selectedMate.id)} />
            )}
          </div>
        </div>
      )}
    </>
  )

  return (
    <MyMatesWindowFrame>
      {/* Pixel snow behind the page, richer with the affinity stage (stage 1 snow when affinity is off); it shows
          through the glass blocks as soft lights. */}
      <PixelSnow stage={relation?.stage ?? 1} glowBehind=".mate-game-block, .mate-switcher-chip" />
      <div className="my-mates-layout">
        <div className="my-mates-switcher-slot">
          <MateSwitcher mates={switcherMates} selectedId={selectedId} onSelect={selectMate} />
        </div>

        <div className="my-mates-scene" data-tour="my-mates-scene">
          <Suspense fallback={<div className="my-mates-scene-loading" aria-busy="true" />}>
            <CapsuleJar
              // One scene per mate: nothing of the previous mate's opening or record card can linger.
              key={selectedId}
              ref={jarRef}
              pour={pourKind}
              mateId={selectedId}
              mateName={mateName}
              capsules={capsules}
              dropIds={visit.dropIds}
              mateLayer={mateLayer}
              caption={caption}
              onSettled={onSceneSettled}
              showHeader={false}
              listView={listView}
              onListViewChange={setListView}
            />
          </Suspense>
        </div>

        <MateTimeColumn
          totalSeconds={totalSeconds}
          connections={capsules}
          connectionCount={previewMate ? undefined : mine?.connectionCount ?? 0}
          capsuleCount={capsuleCount}
          newIds={visit.dropIds}
          affinity={affinity}
          worlds={worlds}
          worldKey={`${selectedId}:${relation?.stage ?? 0}`}
          mateName={mateName}
          theme={capsuleJarTheme(selectedId)}
          onOpen={(id) => jarRef.current?.openCapsule(id)}
          onPoint={(id) => jarRef.current?.highlight(id)}
          listToggle={listToggle}
          emptyAction={
            import.meta.env.DEV && previewMate ? undefined : (
              <Button size="sm" variant="secondary" loading={meet.busy} onClick={() => void meet.connect({ pickup: true })}>
                첫 연결 시작하기
              </Button>
            )
          }
          actions={actions}
        />
      </div>
    </MyMatesWindowFrame>
  )
}
