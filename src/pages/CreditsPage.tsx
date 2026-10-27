import { useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import type { LedgerEntry } from '@/features/demo/types'
import { dateLabel, number } from '@/shared/lib/format'
import { PageHeading } from '@/shared/ui/PageHeading'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { Tabs } from '@/shared/ui/Tabs'
import { Dialog } from '@/shared/ui/Dialog'

export default function CreditsPage() {
  const { state } = useDemo()
  const [filter, setFilter] = useState('all')
  const [receipt, setReceipt] = useState<LedgerEntry | null>(null)
  const labels = { charge: '충전', use: '사용', bonus: '보너스', payment: '결제' }
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
        <ButtonLink to="/credits/charge" className="min-h-11 px-5 py-2.5 text-sm">
          충전하기
        </ButtonLink>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-card bg-brand-solid p-[22px] text-white">
          <p className="text-sm text-white/70">보유 크레딧</p>
          <p className="mt-2 font-mono text-[34px] font-bold">{number(state.credits)}</p>
        </section>
        <section className="rounded-card bg-brand-soft p-[22px]">
          <p className="text-sm text-muted">이용 중인 패스</p>
          <h2 className="mt-2 text-xl font-bold">
            {state.pass ? state.pass.name : '아직 이용 중인 패스가 없어요'}
          </h2>
          {state.pass && (
            <p className="mt-2 text-xs text-muted">
              {dateLabel(state.pass.expiresAt)}까지 · 자동 갱신 없음
            </p>
          )}
        </section>
        <section className="rounded-card bg-surface p-[22px]">
          <p className="text-sm text-muted">누적 쓴 크레딧</p>
          <p className="mt-2 font-mono text-[30px] font-bold">{number(used)}</p>
          <p className="mt-2 text-xs text-muted">
            공부 옵션 · 보이스 · 선물 {state.ledger.filter((entry) => entry.kind === 'use').length}
            회
          </p>
        </section>
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
      <div className="mt-4 overflow-x-auto rounded-[16px] border border-line">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="text-xs font-normal text-subtle">
            <tr>
              <th className="p-4 font-normal">일시</th>
              <th className="p-4 font-normal">내용</th>
              <th className="p-4 font-normal">구분</th>
              <th className="p-4 font-normal">변동</th>
              <th className="p-4 font-normal">잔액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} className="border-t border-divider">
                <td className="p-4 font-mono text-xs text-subtle">{dateLabel(entry.at, true)}</td>
                <td className="p-4">
                  {entry.kind === 'payment' || entry.kind === 'charge' ? (
                    <button
                      onClick={() => setReceipt(entry)}
                      className="text-left underline decoration-line underline-offset-4"
                    >
                      {entry.description}
                    </button>
                  ) : (
                    entry.description
                  )}
                </td>
                <td className="p-4">
                  <Badge dark={entry.kind === 'charge'}>{labels[entry.kind]}</Badge>
                </td>
                <td className="p-4 font-mono font-bold">
                  <span className={entry.change > 0 ? 'text-brand' : ''}>
                    {entry.change
                      ? `${entry.change > 0 ? '+' : '−'}${number(Math.abs(entry.change))}`
                      : '—'}
                  </span>
                </td>
                <td className="p-4 font-mono text-xs text-muted">{number(entry.balance)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted">
                  아직 해당 내역이 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog open={!!receipt} onClose={() => setReceipt(null)} title="결제 내역 · 데모">
        {receipt && (
          <div className="space-y-3 text-sm">
            <p>{receipt.description}</p>
            <p className="text-muted">결제 시각 {dateLabel(receipt.at, true)}</p>
            <p className="font-bold">{number(receipt.amount ?? 0)}원</p>
            <p className="rounded-control bg-surface p-3 leading-6 text-muted">
              샘플 결제 내역이에요. 실제 결제 승인번호나 영수증은 발행되지 않아요.
            </p>
          </div>
        )}
      </Dialog>
    </>
  )
}
