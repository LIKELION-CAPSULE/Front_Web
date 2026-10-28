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
      label="대화 옵션 올리기"
      title={basic ? '대화 옵션을 올리고 계속 이야기할까요?' : '대화 옵션 올리기'}
      closeLabel="대화 옵션 선택 닫기"
    >
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
        <p role="alert" className="mt-3 text-center text-xs text-brand-strong">
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
      <div className="mt-3 flex justify-center text-xs">
        <Link
          to={`/credits/charge?returnTo=${encodeURIComponent(`/study/${active.id}`)}`}
          className="text-brand-strong underline"
        >
          크레딧 · 패스 보기
        </Link>
      </div>
    </Dialog>
  )
}
