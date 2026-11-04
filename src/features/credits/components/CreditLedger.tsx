import type { LedgerEntry } from '@/features/demo/types'
import { dateLabel, number } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Badge'

const labels = { charge: '충전', use: '사용', bonus: '보너스', payment: '결제' }
const change = (entry: LedgerEntry) => entry.change ? `${entry.change > 0 ? '+' : '−'}${number(Math.abs(entry.change))}` : '—'
const hasReceipt = (entry: LedgerEntry) => entry.kind === 'payment' || entry.kind === 'charge'

export function CreditLedger({ entries, onReceipt }: { entries: readonly LedgerEntry[]; onReceipt: (entry: LedgerEntry) => void }) {
  if (!entries.length) return <p role="status" className="mt-4 rounded-card bg-panel p-8 text-center type-body-compact text-muted">선택한 항목의 내역이 없어요.</p>
  return (
    <>
      <ul aria-label="크레딧 내역" className="mt-4 divide-y divide-divider md:hidden">
        {entries.map(entry => (
          <li key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 py-4">
            <div className="min-w-0">
              {hasReceipt(entry) ? (
                <button onClick={() => onReceipt(entry)} className="min-h-11 text-left type-card-title underline decoration-divider underline-offset-4">{entry.description}</button>
              ) : <p className="type-card-title">{entry.description}</p>}
              <time dateTime={new Date(entry.at).toISOString()} className="mt-1 block type-caption text-subtle">{dateLabel(entry.at, true)}</time>
            </div>
            <div className="text-right">
              <strong className={`block type-card-title tabular-nums ${entry.change > 0 ? 'text-text-accent' : 'text-ink'}`}>{change(entry)}</strong>
              <p className="mt-1 type-caption text-muted">잔액 {number(entry.balance)}</p>
            </div>
            <div className="col-span-2"><Badge dark={entry.kind === 'charge'}>{labels[entry.kind]}</Badge></div>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden overflow-x-auto rounded-card md:block">
        <table aria-label="크레딧 내역" className="w-full min-w-[700px] text-left type-body-compact">
          <thead className="type-caption text-subtle"><tr>{['일시', '내용', '구분', '변동', '잔액'].map(label => <th key={label} className="p-4 font-normal">{label}</th>)}</tr></thead>
          <tbody>{entries.map(entry => (
            <tr key={entry.id} className="border-t border-divider">
              <td className="p-4 type-caption tabular-nums text-subtle">{dateLabel(entry.at, true)}</td>
              <td className="p-4">{hasReceipt(entry) ? <button onClick={() => onReceipt(entry)} className="min-h-11 text-left underline decoration-divider underline-offset-4">{entry.description}</button> : entry.description}</td>
              <td className="p-4"><Badge dark={entry.kind === 'charge'}>{labels[entry.kind]}</Badge></td>
              <td className={`p-4 font-bold tabular-nums ${entry.change > 0 ? 'text-text-accent' : 'text-ink'}`}>{change(entry)}</td>
              <td className="p-4 type-caption tabular-nums text-muted">{number(entry.balance)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  )
}
