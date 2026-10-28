import { useState } from 'react'
import { Link } from 'react-router'
import { tiers, tierById } from '@/features/demo/catalog'
import { useDemo } from '@/features/demo/demo-context'
import { tierCost } from '@/features/demo/reducer'
import type { TierId } from '@/features/demo/types'
import { number } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { RadioOption } from '@/shared/ui/RadioOption'
import { Dialog } from '@/shared/ui/Dialog'

export function UpgradePanel({ onClose, now }: { onClose: () => void; now: number }) {
  const { state, dispatch } = useDemo()
  const active = state.activeSession!
  const choices = tiers.filter((tier) => tier.price > tierById(active.tier).price)
  const [selection, setSelection] = useState<TierId>(choices[0]?.id ?? 'special')
  const cost = Math.max(0, tierCost(state, selection, now) - active.paidCredits)
  const basic = active.tier === 'basic'
  return (
    <Dialog
      open
      onClose={onClose}
      label="이번 공부 옵션 올리기"
      title={basic ? '등급을 올리고 계속 얘기할까요?' : '이번 공부 옵션 올리기'}
      closeLabel="등급 선택 닫기"
      presentation={basic ? 'sheet' : 'popover'}
      className={basic ? 'upgrade-sheet' : 'upgrade-popover'}
    >
      <p className="mb-3 text-[11px] leading-4 text-muted">
        지금 {tierById(active.tier).name} · 이미 낸 크레딧을 제외한 차액만 적용해요.
      </p>
      <div className="space-y-2">
        {choices.map((tier) => (
          <RadioOption
            key={tier.id}
            name="upgrade"
            value={tier.id}
            checked={selection === tier.id}
            onChange={() => setSelection(tier.id)}
          >
            <span className="flex items-center justify-between gap-2">
              <span>
                <strong className="block text-sm">{tier.name}</strong>
                <span className="block text-[10px] leading-4 text-muted">{tier.summary}</span>
              </span>
              <strong className="font-mono text-sm">
                {number(Math.max(0, tierCost(state, tier.id, now) - active.paidCredits))}
              </strong>
            </span>
          </RadioOption>
        ))}
      </div>
      <p className="mt-3 flex justify-between text-xs text-muted">
        <span>보유 크레딧</span>
        <strong>{number(state.credits)}</strong>
      </p>
      {state.credits < cost ? (
        <p role="alert" className="mt-3 text-xs text-brand-strong">
          크레딧이 부족해요. 충전 후 돌아와 주세요.
        </p>
      ) : null}
      <Button
        size="md"
        disabled={state.credits < cost || !choices.length}
        onClick={() => {
          dispatch({ type: 'UPGRADE', tier: selection, now: Date.now() })
          onClose()
        }}
        className="mt-3 w-full"
      >
        차액 {number(cost)} 크레딧으로 올리기
      </Button>
      <div className="mt-3 flex justify-between gap-3 text-xs">
        <button onClick={onClose} className="text-muted underline">
          그냥 쉴게요
        </button>
        <Link
          to={`/credits/charge?returnTo=${encodeURIComponent(`/study/${active.id}`)}`}
          className="text-brand-strong underline"
        >
          충전 · 패스 보기 →
        </Link>
      </div>
    </Dialog>
  )
}
