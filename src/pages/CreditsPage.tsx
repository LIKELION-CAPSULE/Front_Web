import { useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import type { LedgerEntry } from '@/features/demo/types'
import { dateLabel, number } from '@/shared/lib/format'
import { PageHeading } from '@/shared/ui/PageHeading'
import { CreditLedger } from '@/features/credits/components/CreditLedger'
import { ButtonLink } from '@/shared/ui/Button'
import { Tabs } from '@/shared/ui/Tabs'
import { Dialog } from '@/shared/ui/Dialog'
import { Panel } from '@/shared/ui/Panel'

export default function CreditsPage() {
  const { state } = useDemo()
  const [filter, setFilter] = useState('all')
  const [receipt, setReceipt] = useState<LedgerEntry | null>(null)
  const rows = state.ledger.filter((entry) =>
    filter === 'all' ||
    (filter === 'charge'
      ? entry.kind === 'charge' || entry.kind === 'payment'
      : entry.kind === filter),
  )
  const used = state.ledger
    .filter((entry) => entry.kind === 'use')
    .reduce((sum, entry) => sum - entry.change, 0)
  return (
    <>
      <div className="credits-page-header mb-8 flex flex-wrap items-center justify-between gap-4 [&_.page-heading]:mb-0">
        <PageHeading title="내 크레딧" eyebrow={null} />
        <ButtonLink to="/credits/charge" size="md">
          충전하기
        </ButtonLink>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel bordered={false} className="bg-surface">
          <p className="text-body-compact text-muted">보유 크레딧</p>
          <p className="mt-2 type-stat">{number(state.credits)}</p>
        </Panel>
        <Panel bordered={false} className="bg-primary-soft">
          <p className="text-body-compact text-muted">이용 중인 패스</p>
          <h2 className="mt-2 type-section-title">
            {state.pass ? state.pass.name : '아직 이용 중인 패스가 없어요'}
          </h2>
          {state.pass && (
            <p className="mt-2 text-caption text-muted">
              {dateLabel(state.pass.expiresAt)}까지 · 자동 갱신 없음
            </p>
          )}
        </Panel>
        <Panel bordered={false} className="bg-surface">
          <p className="text-body-compact text-muted">사용한 크레딧</p>
          <p className="mt-2 type-stat">{number(used)}</p>
        </Panel>
      </div>
      <div className="mt-6">
        <Tabs
          label="크레딧 내역 필터"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: '전체' },
            { id: 'charge', label: '충전' },
            { id: 'use', label: '사용' },
            { id: 'bonus', label: '보너스' },
          ]}
        />
      </div>
      <CreditLedger entries={rows} onReceipt={setReceipt} />
      <Dialog open={!!receipt} onClose={() => setReceipt(null)} title="결제 내역">
        {receipt && (
          <div className="space-y-3 text-body-compact">
            <p>{receipt.description}</p>
            <p className="text-muted">결제 시각 {dateLabel(receipt.at, true)}</p>
            <p className="font-bold">{number(receipt.amount ?? 0)}원</p>
            <p className="rounded-control bg-surface p-3 leading-6 text-muted">
              체험용 결제 내역이에요. 실제 결제 영수증은 발급되지 않아요.
            </p>
          </div>
        )}
      </Dialog>
    </>
  )
}
