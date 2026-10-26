import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { sessionAssets } from '../assets'

export function ChatComposer({
  onSend,
  disabled,
  compact = false,
  name,
  remaining,
}: {
  onSend: (text: string, voice?: boolean) => void
  disabled?: boolean
  compact?: boolean
  name: string
  remaining?: number
}) {
  const [text, setText] = useState('')
  function submit() {
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
  }
  return (
    <form
      className={cn(compact ? 'mini-chat' : 'chat-composer')}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {compact && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {['화이팅', '졸려', '5분만 집중할게', '이거 어려워', '쉬고 싶다'].map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={disabled}
              onClick={() => onSend(reply)}
              className="rounded-full border border-line bg-brand-soft px-2.5 py-1 text-[11px] disabled:opacity-40"
            >
              {reply}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          aria-label={compact ? `${name}에게 조용히 한마디` : '메시지 입력'}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-full border border-line bg-panel px-3.5 py-3 text-sm placeholder:text-subtle disabled:bg-surface"
          placeholder={compact ? `${name}에게 조용히 한마디…` : '메시지 입력…'}
        />
        {remaining !== undefined && compact && (
          <span className="text-[10px] whitespace-nowrap text-subtle">{remaining}/3턴</span>
        )}
        {!compact && (
          <button
            type="button"
            disabled={disabled}
            aria-label="샘플 음성 메시지 보내기"
            onClick={() => onSend('내일 영어 시험이라 좀 긴장돼', true)}
            className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-brand-solid disabled:opacity-40"
          >
            <img src={sessionAssets.microphone} alt="" />
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="보내기"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-brand-solid disabled:opacity-40',
            compact ? 'size-[38px]' : 'size-[52px]',
          )}
        >
          <img src={compact ? sessionAssets.miniSend : sessionAssets.send} alt="" />
        </button>
      </div>
      {!compact && (
        <p className="mt-3 text-[10px] leading-4 text-subtle">
          도서관 · 직장에선 텍스트로, 집에선 음성으로
          <br />
          데모 음성은 샘플 메시지로 전송돼요.
        </p>
      )}
    </form>
  )
}
