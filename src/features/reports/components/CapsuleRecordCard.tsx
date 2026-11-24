import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { capsuleLogo } from '@/shared/design/brand-logo'
import { Icon } from '@/shared/ui/Icon'
import { ProgressRing } from '@/shared/ui/ProgressRing'
import {
  CAPSULE_RECORD_COPY as COPY,
  recordAmount,
  recordCardDate,
  recordEndedLabel,
  type CapsuleRecordCardProps,
  type CapsuleRecordStats,
} from '../capsule-record'
import '../capsule-record-card.css'

/**
 * The connection record (SCR-21), and its stage-up state (SCR-22): the mate on the left, fading into the page with
 * hearts and sparkles around them and their closing line centred below, and the result card on the right. Its
 * content rises in order (brand → header → results → affinity → actions) via `data-reveal` steps.
 */
export function CapsuleRecordCard(props: CapsuleRecordCardProps) {
  const { titleId, mateName, portrait, quote, levelUp } = props
  return (
    <CapsuleRecordLayout
      mate={
        <>
          <div className="capsule-record-mate-art">{portrait}</div>
          <MateDecor levelUp={levelUp} />
          {quote && (
            <figure className="capsule-record-quote" {...reveal(5)}>
              <figcaption><Icon name="chat" size={16} />{mateName}</figcaption>
              <blockquote><p>{quote}</p></blockquote>
            </figure>
          )}
        </>
      }
    >
      <ResultDecor />
      <section
        className={levelUp ? 'capsule-record-card capsule-record-card--levelup connection-record-window' : 'capsule-record-card connection-record-window'}
        aria-labelledby={titleId}
      >
        <CardSparkles />
        <div className="capsule-record-brand-row" {...reveal(0)}>
          <span className="capsule-record-brand">
            <img src={capsuleLogo.symbol.color} width={22} height={21} alt="" />
            <span>CAPSULE · {recordCardDate(props.endedAt)}</span>
          </span>
          {levelUp ? (
            <span className="capsule-record-badge capsule-record-badge--levelup">
              <StarGlyph />
              {COPY.levelUpBadge}
            </span>
          ) : props.stage.current && (
            <span className="capsule-record-badge">
              <Icon name="user" size={16} />
              {props.stage.current}
            </span>
          )}
        </div>
        <RecordHeader {...props} />
        <RecordStats stats={props.stats} />
        {levelUp ? <LevelUpBlock {...props} /> : <RecordAffinity {...props} />}
        {props.remembered && (
          <p className="capsule-record-remembered" {...reveal(4)}>
            <span>{COPY.remembered}</span> “{props.remembered}”
          </p>
        )}
        {props.notice && <div className="capsule-record-notice" {...reveal(4)}>{props.notice}</div>}
        <div className="capsule-record-actions" {...reveal(4)}>
          <Link to={props.homeTo} className="capsule-record-home">
            <Icon name="home" size={18} />
            {COPY.home}
          </Link>
          {props.reconnect && <div className="capsule-record-reconnect">{props.reconnect}</div>}
        </div>
      </section>
    </CapsuleRecordLayout>
  )
}

/** The two-column frame, shared with the loading and error states. */
export function CapsuleRecordLayout({ mate, children }: { mate: ReactNode; children: ReactNode }) {
  return (
    <div className="capsule-record">
      <div className="capsule-record-mate">{mate}</div>
      <div className="capsule-record-result">{children}</div>
    </div>
  )
}

function RecordHeader({ titleId, mateName, modeLabel, endedAt, levelUp, stats }: CapsuleRecordCardProps) {
  const summary = recordAmount(stats.togetherSeconds ?? stats.connectionSeconds)
  const ratio = stats.togetherSeconds !== null && stats.connectionSeconds > 0
    ? Math.min(100, (stats.togetherSeconds / stats.connectionSeconds) * 100)
    : null
  return (
    <header className="capsule-record-head" {...reveal(1)}>
      <div className="capsule-record-head-main">
        <h1 id={titleId} className="capsule-record-title">
          {levelUp ? COPY.levelUpTitle : COPY.title}
          {!levelUp && <Icon name="heart" size={26} className="capsule-record-title-heart" />}
        </h1>
        <p className="capsule-record-subtitle">{levelUp ? COPY.levelUpSubtitle : COPY.subtitle}</p>
        {!levelUp && (
          <p className="capsule-record-summary">
            {COPY.summaryBefore}
            <strong>{summary.value}<small>{summary.unit}</small></strong>
            {COPY.summaryAfter}
          </p>
        )}
      </div>
      <div className="capsule-record-meta">
        <p className="capsule-record-meta-mate">{modeLabel ? `${mateName} · ${modeLabel}` : mateName}</p>
        <p className="capsule-record-meta-time">
          <Icon name="clock" size={14} />
          <time dateTime={new Date(endedAt).toISOString()}>{recordEndedLabel(endedAt)} {COPY.completed}</time>
        </p>
        {ratio !== null && (
          <div className="capsule-record-ring">
            <ProgressRing value={ratio} label={`${COPY.togetherRing} 비율`} size={64} />
            <span>{COPY.togetherRing}</span>
          </div>
        )}
      </div>
    </header>
  )
}

function RecordStats({ stats }: { stats: CapsuleRecordStats }) {
  const together = stats.togetherSeconds === null
    ? <StatNote>{COPY.togetherOff}</StatNote>
    : stats.togetherSeconds < 1
      ? <StatNote>{COPY.togetherNone}</StatNote>
      : <StatValue {...recordAmount(stats.togetherSeconds)} />
  const dialogue = stats.dialogueCount === undefined
    ? <StatNote>{COPY.dialogueUnknown}</StatNote>
    : stats.dialogueCount === 0
      ? <StatNote>{COPY.dialogueNone}</StatNote>
      : <StatValue value={stats.dialogueCount.toLocaleString('ko-KR')} unit={COPY.dialogueUnit} />
  return (
    <dl className="capsule-record-stats" {...reveal(2)}>
      <Stat icon="clock" label={COPY.together}>{together}</Stat>
      <Stat icon="chat" label={COPY.connection}><StatValue {...recordAmount(stats.connectionSeconds)} /></Stat>
      <Stat icon="chat" label={COPY.dialogue}>{dialogue}</Stat>
    </dl>
  )
}

/** Regular record: the stage (unchanged), time to the next stage, and its progress. */
function RecordAffinity({ mateName, stage, nextStageCaption, stageProgress }: CapsuleRecordCardProps) {
  if (!stage.current && !nextStageCaption && stageProgress === undefined) return null
  return (
    <section className="capsule-record-affinity" aria-label={COPY.affinity(mateName)} {...reveal(3)}>
      <h2>{COPY.affinity(mateName)}</h2>
      <div className="capsule-record-affinity-row">
        {stage.current && (
          <p className="capsule-record-stage-text">
            {stage.previous ?? stage.current} <span aria-hidden="true">→</span><span className="sr-only">에서</span> {stage.current}
          </p>
        )}
        {nextStageCaption && <p className="capsule-record-next">{nextStageCaption}</p>}
      </div>
      <StageProgress value={stageProgress} />
    </section>
  )
}

/** Stage-up: the stage pills, LEVEL UP!, progress to the next stage, and the expression that opened. */
function LevelUpBlock({ mateName, stage, nextStageCaption, stageProgress, unlock }: CapsuleRecordCardProps) {
  return (
    <section className="capsule-record-levelup-block" aria-label={COPY.affinity(mateName)} {...reveal(3)}>
      <div className="capsule-record-stage-change">
        <span className="sr-only">
          {stage.previous && `${stage.previous}에서 `}{stage.current}
        </span>
        {stage.previous && (
          <>
            <span className="capsule-record-stage capsule-record-stage--previous" aria-hidden="true">{stage.previous}</span>
            <span className="capsule-record-stage-arrow" aria-hidden="true"><Icon name="arrow" size={26} /></span>
          </>
        )}
        <span className="capsule-record-stage capsule-record-stage--current" aria-hidden="true">
          <Icon name="heart" size={18} fill="currentColor" />
          {stage.current}
        </span>
      </div>
      <p className="capsule-record-levelup">
        <Sparkle className="capsule-record-levelup-spark capsule-record-levelup-spark--left" />
        <span className="capsule-record-levelup-text">{COPY.levelUp}</span>
        <Sparkle className="capsule-record-levelup-spark capsule-record-levelup-spark--right" />
      </p>
      {(nextStageCaption || stageProgress !== undefined) && (
        <div className="capsule-record-levelup-progress">
          {nextStageCaption && <p className="capsule-record-next">{nextStageCaption}</p>}
          <StageProgress value={stageProgress} />
        </div>
      )}
      {unlock && (
        <div className="capsule-record-unlock">
          <span className="capsule-record-unlock-icon"><Icon name="sparkle" size={22} /></span>
          <span className="capsule-record-unlock-copy">
            <strong>{COPY.unlockTitle}</strong>
            <span>{unlock.kind} 「{unlock.label}」 · {COPY.unlockSub}</span>
          </span>
          {unlock.onView && (
            <button type="button" className="capsule-record-unlock-view" aria-pressed={unlock.viewing} onClick={unlock.onView}>
              <Icon name="play" size={14} />
              {unlock.viewing ? COPY.viewing : COPY.view}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function StageProgress({ value }: { value?: number }) {
  if (value === undefined) return null
  return (
    <div className="capsule-record-progress" aria-hidden="true">
      <span style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

function Stat({ icon, label, children }: { icon: 'clock' | 'chat'; label: string; children: ReactNode }) {
  return (
    <div className="capsule-record-stat">
      <dt><Icon name={icon} size={18} />{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function StatValue({ value, unit }: { value: string; unit: string }) {
  return <span className="capsule-record-stat-value">{value}<small>{unit}</small></span>
}

function StatNote({ children }: { children: ReactNode }) {
  return <span className="capsule-record-stat-note">{children}</span>
}

/** Hearts and sparkles around the mate (more of them on a stage-up). */
function MateDecor({ levelUp }: { levelUp: boolean }) {
  return (
    <div className="capsule-record-mate-decor" aria-hidden="true">
      <Heart className="capsule-record-heart capsule-record-heart--a" />
      <Heart className="capsule-record-heart capsule-record-heart--b" />
      <Sparkle className="capsule-record-spark capsule-record-spark--a" />
      <Sparkle className="capsule-record-spark capsule-record-spark--b" />
      <Sparkle className="capsule-record-spark capsule-record-spark--c" />
      {levelUp && (
        <>
          <Heart className="capsule-record-heart capsule-record-heart--c" />
          <Heart className="capsule-record-heart capsule-record-heart--d" />
          <Sparkle className="capsule-record-spark capsule-record-spark--d" />
        </>
      )}
    </div>
  )
}

/** The orbit line with its star, and a few sparkles, floating around the card (outside it, clear of the text). */
function ResultDecor() {
  return (
    <div className="capsule-record-result-decor" aria-hidden="true">
      <svg className="capsule-record-orbit" viewBox="0 0 220 120">
        <path d="M2 118 C 80 108, 160 70, 218 2" />
        <path className="capsule-record-orbit-star" d="M168 50 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4z" />
      </svg>
      <Sparkle className="capsule-record-spark capsule-record-spark--e" />
      <Sparkle className="capsule-record-spark capsule-record-spark--f" />
    </div>
  )
}

/** Two small sparkles in the card's free corners. */
function CardSparkles() {
  return (
    <div className="capsule-record-card-decor" aria-hidden="true">
      <Sparkle className="capsule-record-spark capsule-record-spark--g" />
      <Sparkle className="capsule-record-spark capsule-record-spark--h" />
    </div>
  )
}

function Heart({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-8.6-9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.6 11C19 15.6 12 20 12 20z" />
    </svg>
  )
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 1.5c.5 5.6 4.9 10 10.5 10.5-5.6.5-10 4.9-10.5 10.5C11.5 16.9 7.1 12.5 1.5 12 7.1 11.5 11.5 7.1 12 1.5z" />
    </svg>
  )
}

function StarGlyph() {
  return (
    <svg className="capsule-record-star" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="m12 2.6 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" />
    </svg>
  )
}

/** `data-reveal` with its order; the stylesheet turns the order into a delay. */
function reveal(step: number) {
  return { 'data-reveal': '', style: { '--reveal-step': step } as CSSProperties }
}
