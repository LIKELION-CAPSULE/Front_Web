/** One dispatched Server-Sent Event. `event` defaults to `message`; multi-line data is joined with `\n`. */
export type SseEvent = { event: string; data: string; id?: string }

/**
 * Incremental `text/event-stream` parser (WHATWG HTML, "Parsing an event stream").
 * Text may be split anywhere across `push` calls, including inside a line or between `\r` and `\n`.
 */
export function createSseParser(onEvent: (event: SseEvent) => void) {
  let buffer = ''
  let started = false
  // A chunk that ends with `\r` may be followed by the `\n` of the same line break.
  let skipNewline = false
  let type = ''
  let data: string[] = []
  let id: string | undefined
  function dispatch() {
    const pending = data
    const event = type
    type = ''
    data = []
    // An event without a data field is not dispatched.
    if (!pending.length) return
    onEvent({ event: event || 'message', data: pending.join('\n'), ...(id === undefined ? {} : { id }) })
  }
  function line(text: string) {
    if (text === '') return dispatch()
    if (text.startsWith(':')) return
    const colon = text.indexOf(':')
    const field = colon === -1 ? text : text.slice(0, colon)
    let value = colon === -1 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') type = value
    else if (field === 'data') data.push(value)
    else if (field === 'id' && !value.includes('\0')) id = value
    // `retry` and unknown fields are ignored: reconnection is handled by the caller.
  }
  return {
    push(chunk: string) {
      buffer += chunk
      if (!started && buffer) {
        started = true
        if (buffer.startsWith('﻿')) buffer = buffer.slice(1)
      }
      let index = 0
      if (skipNewline && buffer.startsWith('\n')) index = 1
      skipNewline = false
      for (;;) {
        const lf = buffer.indexOf('\n', index)
        const cr = buffer.indexOf('\r', index)
        const end = cr === -1 ? lf : lf === -1 ? cr : Math.min(cr, lf)
        if (end === -1) break
        line(buffer.slice(index, end))
        if (buffer[end] === '\r') {
          if (end + 1 === buffer.length) { skipNewline = true; index = end + 1; break }
          index = buffer[end + 1] === '\n' ? end + 2 : end + 1
        } else index = end + 1
      }
      buffer = buffer.slice(index)
    },
    /** The stream closed. A final event missing its blank line is still delivered, since servers often omit it. */
    end() {
      if (buffer) line(buffer)
      buffer = ''
      dispatch()
    },
  }
}
