import assert from 'node:assert/strict'
import test from 'node:test'
import { createSseParser, type SseEvent } from '../src/shared/api/sse.ts'

function parse(chunks: string[]) {
  const events: SseEvent[] = []
  const parser = createSseParser(event => events.push(event))
  for (const chunk of chunks) parser.push(chunk)
  parser.end()
  return events
}
const stream = 'event: reply\ndata: {"content":"안"}\n\nevent: reply\ndata: {"content":"안녕"}\n\nevent: done\ndata: {"content":"안녕!"}\n\n'
const expected = [
  { event: 'reply', data: '{"content":"안"}' },
  { event: 'reply', data: '{"content":"안녕"}' },
  { event: 'done', data: '{"content":"안녕!"}' },
]

test('splits events on blank lines and reads event and data fields', () => {
  assert.deepEqual(parse([stream]), expected)
})

test('an event cut at every possible chunk boundary parses the same', () => {
  for (let index = 1; index < stream.length; index++) {
    assert.deepEqual(parse([stream.slice(0, index), stream.slice(index)]), expected, `split at ${index}`)
  }
  assert.deepEqual(parse(Array.from(stream)), expected)
})

test('accepts CRLF and CR line breaks, including a CRLF split across chunks', () => {
  const crlf = stream.replaceAll('\n', '\r\n')
  assert.deepEqual(parse([crlf]), expected)
  for (let index = 1; index < crlf.length; index++) assert.deepEqual(parse([crlf.slice(0, index), crlf.slice(index)]), expected)
  assert.deepEqual(parse([stream.replaceAll('\n', '\r')]), expected)
})

test('joins multi-line data with newlines and strips only one leading space', () => {
  assert.deepEqual(parse(['event: error\ndata: 첫 줄\ndata:  둘째 줄\ndata\n\n']), [{ event: 'error', data: '첫 줄\n 둘째 줄\n' }])
})

test('ignores comments, unknown fields and events without data; defaults the type to message', () => {
  assert.deepEqual(parse([': keep-alive\n\nretry: 1000\nfoo: bar\n\nevent: reply\n\ndata: x\n\n']), [{ event: 'message', data: 'x' }])
})

test('the event type resets after each dispatch and id is carried over', () => {
  assert.deepEqual(parse(['id: 7\nevent: reply\ndata: a\n\ndata: b\n\n']), [{ event: 'reply', data: 'a', id: '7' }, { event: 'message', data: 'b', id: '7' }])
})

test('a byte-order mark is skipped and a last event without its blank line is still delivered', () => {
  assert.deepEqual(parse(['﻿event: done\ndata: {}']), [{ event: 'done', data: '{}' }])
})
