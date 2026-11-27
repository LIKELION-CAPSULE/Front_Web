import '../call-speaker-chip.css'

/**
 * Who is talking on the call stage (2026-11-27 call UI step 1, in place of the green frame — no outlines): her name and
 * 「말하는 중」 with three level bars while a line types or her voice plays, 「답장 준비 중」 with three square dots while
 * her reply is on its way. Decoration only (aria-hidden): the chat log says it. Step 2 moves it onto the dialogue box.
 */
export function CallSpeakerChip({ name, state }: { name: string; state: 'speaking' | 'waiting' }) {
  return (
    <span className="call-speaker-chip" data-state={state} aria-hidden="true">
      <span className="call-speaker-name">{name}</span>
      <span className="call-speaker-sep" />
      {state === 'speaking'
        ? <span className="call-speaker-state"><span className="call-speaker-bars"><span /><span /><span /></span>말하는 중</span>
        : <span className="call-speaker-state">답장 준비 중<span className="call-speaker-dots"><span /><span /><span /></span></span>}
    </span>
  )
}
