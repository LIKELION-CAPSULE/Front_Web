import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { StudyRecord } from '@/features/demo/types'
import type { MateModelInfo } from '@/features/mates/mate-contract'
import { MatePreview } from '../components/MatePreview.tsx'
import { capsuleRecordsFromStudyRecords, sortCapsules } from './capsule-jar-data.ts'
import { generateDummyCapsules, generateFreshCapsules } from './capsule-jar-dummy.ts'
import { capsuleVisitKey } from './capsule-jar-visit.ts'
import { capsulesForConnection } from './capsule-floor-layout.ts'
import { formatCapsuleDate, totalCapsuleSeconds } from './capsule-jar-data.ts'
import { sampleRelation } from '../mate-sample-data.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'
import type { CapsuleJarHandle } from './CapsuleJar.tsx'
import type { JarBenchmark } from './capsule-jar-scene.ts'
import { useCapsuleVisit } from './use-capsule-visit.ts'
import './capsule-jar-preview.css'

/** The jar itself is a separate chunk; the three.js scene inside it is yet another one, loaded on visibility. */
const CapsuleJar = lazy(() => import('./CapsuleJar.tsx'))

/** Connection presets (each connection becomes a bundle of capsules; the real count is shown in the header). */
const COUNTS = [0, 1, 3, 7, 15, 30] as const
/** Hidden: any other `count` up to this many connections (frame-rate checks with 100–400 capsules). */
const MAX_COUNT = 80
type Source = number | 'real'

function initialSource(value: string | null, hasReal: boolean): Source {
  if (value === 'real' && hasReal) return 'real'
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 && count <= MAX_COUNT ? count : 7
}

/**
 * Development-only preview of the capsule floor scene at `/mates/me?capsules=preview`. Optional query:
 * `count=0|1|3|7|15|30|real` (connections), `reduced=1`, `fallback=1`. Hidden: any `count` up to 80 connections for
 * frame-rate checks; `durations=short` makes every connection 2–4 minutes (3 capsules each).
 */
export default function CapsuleJarPreview({
  records,
  characterId,
  mateId,
  mateName,
  userId,
  model,
}: {
  records: readonly StudyRecord[]
  characterId?: string
  mateId: string
  mateName: string
  userId?: number
  /** The mate's Live2D model (the page loads it); without it the panel shows the v2 hero still. */
  model?: MateModelInfo
}) {
  const [searchParams] = useSearchParams()
  const realCapsules = useMemo(
    () => (characterId ? capsuleRecordsFromStudyRecords(records, characterId) : []),
    [records, characterId],
  )
  const [source, setSource] = useState<Source>(() => initialSource(searchParams.get('count'), Boolean(characterId)))
  const [reduced, setReduced] = useState(searchParams.get('reduced') === '1')
  const [shortDurations] = useState(searchParams.get('durations') === 'short')
  const [fallback, setFallback] = useState(searchParams.get('fallback') === '1')
  const [dropCount, setDropCount] = useState(3)
  const [fresh, setFresh] = useState<CapsuleRecord[]>([])
  const [jarKey, setJarKey] = useState(0)
  const [visitApplies, setVisitApplies] = useState(true)
  const [benchmark, setBenchmark] = useState<JarBenchmark | 'running' | null>(null)
  const [now] = useState(() => Date.now())
  const jarRef = useRef<CapsuleJarHandle>(null)

  const base = useMemo(
    () =>
      source === 'real'
        ? realCapsules
        : generateDummyCapsules(source, { now, seed: 11, ...(shortDurations ? { minutes: [2, 4] as const } : {}) }),
    [source, realCapsules, now, shortDurations],
  )
  const capsules = useMemo(() => sortCapsules([...base, ...fresh]), [base, fresh])
  const firstMetAt = capsules[0]?.startedAt
  const relation = useMemo(() => sampleRelation(totalCapsuleSeconds(capsules)), [capsules])
  const visit = useCapsuleVisit(capsuleVisitKey(userId ?? 'preview', `${mateId}-preview`), base)
  const dropIds = useMemo(
    () => [...(visitApplies ? visit.dropIds : []), ...fresh.map((capsule) => capsule.id)],
    [visitApplies, visit.dropIds, fresh],
  )

  const chooseSource = (next: Source) => {
    setSource(next)
    setFresh([])
    setVisitApplies(false)
    setBenchmark(null)
  }

  const dropFresh = () => {
    const at = Date.now()
    setFresh((current) => [...current, ...generateFreshCapsules(dropCount, { now: at, seed: at })])
  }

  const resetVisit = () => {
    visit.reset()
    setFresh([])
    setVisitApplies(true)
    setJarKey((key) => key + 1)
  }

  const runBenchmark = async () => {
    setBenchmark('running')
    const result = await jarRef.current?.benchmark(3000)
    setBenchmark(result ?? null)
  }

  const capsuleCount = capsules.reduce((sum, capsule) => sum + capsulesForConnection(capsule.durationSeconds), 0)

  return (
    <div className="capsule-jar-preview">
      <div className="capsule-jar-preview-controls" role="group" aria-label="캡슐 보관함 시안 조절">
        <p className="capsule-jar-preview-badge">개발 시안 · /mates/me?capsules=preview</p>
        <div className="capsule-jar-preview-row">
          <span className="capsule-jar-preview-label">연결 횟수</span>
          {COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={source === count}
              onClick={() => chooseSource(count)}
            >
              {count}
            </button>
          ))}
          {characterId && (
            <button type="button" aria-pressed={source === 'real'} onClick={() => chooseSource('real')}>
              실제 기록 {realCapsules.length}
            </button>
          )}
          <output className="capsule-jar-preview-output" data-capsule-count>
            연결 {capsules.length}번 → 캡슐 {capsuleCount}개
          </output>
        </div>
        <div className="capsule-jar-preview-row">
          <label className="capsule-jar-preview-label" htmlFor="capsule-jar-preview-drop">새 연결</label>
          <select
            id="capsule-jar-preview-drop"
            value={dropCount}
            onChange={(event) => setDropCount(Number(event.target.value))}
          >
            {[1, 3, 5, 8, 12].map((count) => (
              <option key={count} value={count}>{count}번</option>
            ))}
          </select>
          <button type="button" onClick={dropFresh}>새 연결 {dropCount}번 떨어뜨리기</button>
          <button type="button" onClick={resetVisit}>지난 방문 초기화</button>
        </div>
        <div className="capsule-jar-preview-row">
          <label>
            <input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />
            움직임 줄이기 강제
          </label>
          <label>
            <input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} />
            2D 대체 강제
          </label>
          <button type="button" onClick={runBenchmark} disabled={benchmark === 'running' || reduced || fallback}>
            성능 측정 3초
          </button>
          {benchmark && benchmark !== 'running' && (
            <output className="capsule-jar-preview-output" data-benchmark>
              {benchmark.instances}개 · {benchmark.fps}fps · p50 {benchmark.frameMsP50}ms · p95 {benchmark.frameMsP95}ms
            </output>
          )}
          {benchmark === 'running' && <output className="capsule-jar-preview-output">측정 중…</output>}
        </div>
      </div>

      <div className="capsule-jar-preview-panel my-mates-scene">
      <Suspense fallback={<div className="capsule-jar-preview-loading" aria-busy="true" />}>
        <CapsuleJar
          key={`${jarKey}-${fallback ? 'fallback' : 'webgl'}`}
          // The page's panel: the big Live2D mate over the floor (frame-rate checks run with both canvases drawing).
          mateLayer={
            <MatePreview
              mode="detail"
              mateId={mateId}
              model={model}
              scope={`capsule-jar-preview:${mateId}`}
              name={mateName}
              paused={false}
              suppressSpeech
              showAgeBadge={false}
              stageClassName="my-mates-live"
              onRetry={() => {}}
            />
          }
          caption={
            <>
              <p className="my-mates-caption-name">{mateName}</p>
              <p className="my-mates-caption-stage">{`${relation.stage}단계 · ${relation.stageName}`}</p>
              {firstMetAt && <p className="my-mates-caption-date">처음 만난 날 {formatCapsuleDate(firstMetAt).slice(0, 10)}</p>}
            </>
          }
          ref={jarRef}
          mateId={mateId}
          mateName={mateName}
          capsules={capsules}
          dropIds={dropIds}
          forceReducedMotion={reduced}
          forceFallback={fallback}
        />
      </Suspense>
      </div>
    </div>
  )
}
