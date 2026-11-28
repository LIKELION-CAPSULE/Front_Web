import { callWorldLabel, type CallWorld } from '../call-world'

/**
 * The call header's left side after the logo (ConnectionPage, TourCallPage; 2026-11-28): the green dot, her name (the
 * page's h1), a short relation line (catalog `callTag`, 「같은 반 짝꿍」) and the world the call is in
 * (「EP.03 주말 오후의 카페」: the newest world her stage has opened, call-world.ts `callWorld`; no chip without one). One line: the header keeps its
 * height; narrow windows shorten the tag and drop the world chip (connections.css).
 */
export function CallMateTitle({ name, tag, world, dotTitle }: {
  name: string
  tag?: string
  world: CallWorld | null
  dotTitle?: string
}) {
  return (
    <>
      <span className="desktop-mate-dot" aria-hidden="true" title={dotTitle} />
      <h1>{name}<span className="sr-only"> · 연결 중</span></h1>
      {tag && <span className="connection-titlebar-tag">{tag}</span>}
      {world && (
        <span className="connection-titlebar-world" title={callWorldLabel(world)}>
          <span className="sr-only">세계관 </span>
          <span className="connection-titlebar-world-text">{callWorldLabel(world)}</span>
        </span>
      )}
    </>
  )
}
