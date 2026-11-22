import { useState } from 'react'
import {
  DEFAULT_DESKTOP_CONTROLS,
  DEFAULT_EXPRESSION_MAPPING,
  EXPRESSION_FILE_OPTIONS,
  MATE_REACTION_LABELS,
  MATE_REACTION_STATES,
  TIME_OF_DAY_OPTIONS,
  type DesktopControls,
  type MateReactionState,
} from './desktop-config'
import '../login-backgrounds.css'

const DEV_PANEL_OPEN_STORAGE_KEY = 'capsule-desktop-dev-panel:open'

function readInitialCollapsed(): boolean {
  try {
    return window.localStorage.getItem(DEV_PANEL_OPEN_STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

export interface DesktopDevPanelProps {
  controls: DesktopControls
  fps: number | null
  reactionState: MateReactionState
  degradationStage: 0 | 1 | 2 | 3
  onUpdateControls: (patch: Partial<DesktopControls>) => void
  onForceReaction: (state: MateReactionState) => void
  onTriggerShiny: () => void
  onResetWindows: () => void
  onSetDegradationStage: (stage: 0 | 1 | 2 | 3) => void
}

/** Dev-only desktop tuning panel. Excluded from production builds via import.meta.env.DEV. */
export default function DesktopDevPanel({
  controls,
  fps,
  reactionState,
  degradationStage,
  onUpdateControls,
  onForceReaction,
  onTriggerShiny,
  onResetWindows,
  onSetDegradationStage,
}: DesktopDevPanelProps) {
  const [collapsed, setCollapsed] = useState(readInitialCollapsed)
  const [selectedExpState, setSelectedExpState] = useState<MateReactionState>('greet')

  const handleToggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(DEV_PANEL_OPEN_STORAGE_KEY, next ? '0' : '1')
      } catch {
        // Ignore storage restrictions
      }
      return next
    })
  }

  return (
    <aside
      aria-label="바탕화면 개발 도구"
      className={collapsed ? 'login-bg-dev-panel login-bg-dev-panel--collapsed' : 'login-bg-dev-panel'}
    >
      <div className="login-bg-dev-header">
        <div className="login-bg-dev-title">
          <span>Desktop Dev</span>
          {fps !== null && <span className="login-bg-dev-fps">{fps} FPS</span>}
        </div>
        <button
          type="button"
          className="login-bg-dev-collapse"
          onClick={handleToggleCollapsed}
        >
          {collapsed ? '열기' : '접기'}
        </button>
      </div>

      {!collapsed && (
        <div className="login-bg-dev-body">
          <div className="login-bg-dev-group">
            <span className="login-bg-dev-group-label">시간대 배경화면</span>
            <div className="desktop-dev-state-grid">
              {TIME_OF_DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="login-bg-dev-chip"
                  aria-pressed={controls.timeMode === opt.value}
                  onClick={() => onUpdateControls({ timeMode: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="login-bg-dev-group">
            <span className="login-bg-dev-group-label">숨은 CAPSULE 튜브</span>
            <label className="login-bg-dev-row">
              <span className="login-bg-dev-row-head">
                <span>글자 대비</span>
                <span className="login-bg-dev-row-val">{controls.hiddenContrast}%</span>
              </span>
              <input
                type="range"
                className="login-bg-dev-range"
                min={0}
                max={100}
                value={controls.hiddenContrast}
                onChange={(e) => onUpdateControls({ hiddenContrast: Number(e.target.value) })}
              />
            </label>
            <label className="login-bg-dev-row">
              <span className="login-bg-dev-row-head">
                <span>크기 / 장식 밀도</span>
                <span className="login-bg-dev-row-val">
                  {controls.hiddenScale.toFixed(2)}× · {controls.decoyDensity.toFixed(1)}×
                </span>
              </span>
              <div className="desktop-dev-pair">
                <input
                  type="range"
                  aria-label="숨은 글자 크기"
                  className="login-bg-dev-range"
                  min={0.8}
                  max={1.9}
                  step={0.02}
                  value={controls.hiddenScale}
                  onChange={(e) => onUpdateControls({ hiddenScale: Number(e.target.value) })}
                />
                <input
                  type="range"
                  aria-label="장식 튜브 밀도"
                  className="login-bg-dev-range"
                  min={0}
                  max={3}
                  step={0.5}
                  value={controls.decoyDensity}
                  onChange={(e) => onUpdateControls({ decoyDensity: Number(e.target.value) })}
                />
              </div>
            </label>
            <label className="login-bg-dev-row">
              <span className="login-bg-dev-row-head">
                <span>위치 X / Y</span>
                <span className="login-bg-dev-row-val">
                  {controls.hiddenOffsetX} / {controls.hiddenOffsetY}
                </span>
              </span>
              <div className="desktop-dev-pair">
                <input
                  type="range"
                  aria-label="숨은 글자 X 위치"
                  className="login-bg-dev-range"
                  min={-40}
                  max={40}
                  value={controls.hiddenOffsetX}
                  onChange={(e) => onUpdateControls({ hiddenOffsetX: Number(e.target.value) })}
                />
                <input
                  type="range"
                  aria-label="숨은 글자 Y 위치"
                  className="login-bg-dev-range"
                  min={-30}
                  max={30}
                  value={controls.hiddenOffsetY}
                  onChange={(e) => onUpdateControls({ hiddenOffsetY: Number(e.target.value) })}
                />
              </div>
            </label>
            <label className="login-bg-dev-row">
              <span className="login-bg-dev-row-head">
                <span>빛 각도</span>
                <span className="login-bg-dev-row-val">
                  {controls.hiddenLightAngle === null ? '자동' : `${controls.hiddenLightAngle}°`}
                </span>
              </span>
              <input
                type="range"
                className="login-bg-dev-range"
                min={0}
                max={360}
                value={controls.hiddenLightAngle ?? 90}
                onChange={(e) => onUpdateControls({ hiddenLightAngle: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="login-bg-dev-group">
            <span className="login-bg-dev-group-label">배경 캡슐 &amp; 저성능 단계 ({degradationStage}단계)</span>
            <label className="login-bg-dev-row">
              <span className="login-bg-dev-row-head">
                <span>캡슐 개수 / 속도</span>
                <span className="login-bg-dev-row-val">
                  {controls.capsuleCount}개 · {controls.capsuleSpeed}
                </span>
              </span>
              <div className="desktop-dev-pair">
                <input
                  type="range"
                  aria-label="캡슐 개수"
                  className="login-bg-dev-range"
                  min={10}
                  max={40}
                  value={controls.capsuleCount}
                  onChange={(e) => onUpdateControls({ capsuleCount: Number(e.target.value) })}
                />
                <input
                  type="range"
                  aria-label="캡슐 속도"
                  className="login-bg-dev-range"
                  min={0}
                  max={80}
                  value={controls.capsuleSpeed}
                  onChange={(e) => onUpdateControls({ capsuleSpeed: Number(e.target.value) })}
                />
              </div>
            </label>
            <label className="login-bg-dev-row">
              <span className="login-bg-dev-row-head">
                <span>보라 강조 캡슐 비율</span>
                <span className="login-bg-dev-row-val">{controls.purpleAccentRatio}%</span>
              </span>
              <input
                type="range"
                className="login-bg-dev-range"
                min={0}
                max={60}
                value={controls.purpleAccentRatio}
                onChange={(e) => onUpdateControls({ purpleAccentRatio: Number(e.target.value) })}
              />
            </label>
            <label className="login-bg-dev-row">
              <span className="login-bg-dev-row-head">
                <span>이로치 등장 확률</span>
                <span className="login-bg-dev-row-val">{controls.shinySpawnChance}%</span>
              </span>
              <input
                type="range"
                className="login-bg-dev-range"
                min={0}
                max={100}
                value={controls.shinySpawnChance}
                onChange={(e) => onUpdateControls({ shinySpawnChance: Number(e.target.value) })}
              />
            </label>
            <div className="login-bg-dev-toggle-row">
              <button type="button" className="login-bg-dev-chip" onClick={onTriggerShiny}>
                이로치 지금 등장
              </button>
              <button
                type="button"
                className="login-bg-dev-chip"
                aria-pressed={controls.live2dEnabled}
                onClick={() => onUpdateControls({ live2dEnabled: !controls.live2dEnabled })}
              >
                Live2D: {controls.live2dEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="login-bg-dev-tabs" role="group" aria-label="저성능 단계 테스트">
              {([0, 1, 2, 3] as const).map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className="login-bg-dev-chip"
                  aria-pressed={degradationStage === stage}
                  onClick={() => onSetDegradationStage(stage)}
                >
                  {stage === 0 ? '정상' : `${stage}단계`}
                </button>
              ))}
            </div>
          </div>

          <div className="login-bg-dev-group">
            <span className="login-bg-dev-group-label">시선 배율 (눈동자 / 고개)</span>
            <label className="login-bg-dev-row">
              <span className="login-bg-dev-row-head">
                <span>눈동자 / 고개</span>
                <span className="login-bg-dev-row-val">
                  {controls.eyeGazeScale.toFixed(2)}× / {controls.headGazeScale.toFixed(2)}×
                </span>
              </span>
              <div className="desktop-dev-pair">
                <input
                  type="range"
                  aria-label="눈동자 배율"
                  className="login-bg-dev-range"
                  min={0.5}
                  max={2.2}
                  step={0.05}
                  value={controls.eyeGazeScale}
                  onChange={(e) => onUpdateControls({ eyeGazeScale: Number(e.target.value) })}
                />
                <input
                  type="range"
                  aria-label="고개 배율"
                  className="login-bg-dev-range"
                  min={0}
                  max={1.2}
                  step={0.05}
                  value={controls.headGazeScale}
                  onChange={(e) => onUpdateControls({ headGazeScale: Number(e.target.value) })}
                />
              </div>
            </label>
          </div>

          <div className="login-bg-dev-group">
            <span className="login-bg-dev-group-label">
              메이트 반응 강제 실행 · 현재: {MATE_REACTION_LABELS[reactionState]}
            </span>
            <div className="desktop-dev-state-grid">
              {MATE_REACTION_STATES.map((st) => (
                <button
                  key={st}
                  type="button"
                  className="login-bg-dev-chip"
                  aria-pressed={reactionState === st}
                  onClick={() => {
                    setSelectedExpState(st)
                    onForceReaction(st)
                  }}
                >
                  {MATE_REACTION_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          <div className="login-bg-dev-group">
            <span className="login-bg-dev-group-label">상태별 표정 파일 (004~011)</span>
            <div className="desktop-dev-exp-row">
              <select
                aria-label="표정 매핑 대상 상태"
                className="desktop-dev-select"
                value={selectedExpState}
                onChange={(e) => setSelectedExpState(e.target.value as MateReactionState)}
              >
                {MATE_REACTION_STATES.map((st) => (
                  <option key={st} value={st}>
                    {MATE_REACTION_LABELS[st]} ({st})
                  </option>
                ))}
              </select>
              <select
                aria-label="선택 상태의 표정 파일"
                className="desktop-dev-select"
                value={controls.expressions[selectedExpState]}
                onChange={(e) => {
                  const nextExpressions = {
                    ...controls.expressions,
                    [selectedExpState]: e.target.value,
                  }
                  onUpdateControls({ expressions: nextExpressions })
                  onForceReaction(selectedExpState)
                }}
              >
                {EXPRESSION_FILE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'default'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="login-bg-dev-actions desktop-dev-actions">
            <button type="button" className="login-bg-dev-reset" onClick={onResetWindows}>
              창 위치 초기화
            </button>
            <button
              type="button"
              className="login-bg-dev-reset"
              onClick={() => {
                onUpdateControls({
                  ...DEFAULT_DESKTOP_CONTROLS,
                  expressions: { ...DEFAULT_EXPRESSION_MAPPING },
                })
                onResetWindows()
              }}
            >
              기본값 복원
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
