import test from 'node:test'
import assert from 'node:assert/strict'
import { extractReviewCopy } from '../server/review-copy.ts'
import { createReviewStorage } from '../src/features/review/storage.ts'
import { findReviewScenario, reviewPreviewUrl, reviewScenarios } from '../src/features/review/catalog.ts'
import { messagePreview, reviewMessageScenarios } from '../src/features/review/messages.ts'

test('review copy includes authored, accessible and dynamic copy without CSS classes or imports', () => {
  const source = [
    "import something from './한글파일'",
    'const error = "다시 시도해 주세요."',
    'const label = `남은 시간 ${seconds}초`',
    '<section className="padding-4"><h1>다시 시작할까요?</h1><input placeholder="이메일 입력" aria-label="이메일" /></section>',
  ].join('\n')
  const entries = extractReviewCopy(source, 'src/pages/Example.tsx')
  assert.deepEqual(entries.map(entry => entry.text), ['다시 시도해 주세요.', '남은 시간 ${seconds}초', '다시 시작할까요?', '이메일 입력', '이메일'])
  assert.equal(entries[0]?.line, 2)
  assert.equal(entries[1]?.kind, '동적 문구')
})

test('review copy retains different source occurrences instead of merging editing locations', () => {
  const entries = extractReviewCopy('<><p>확인</p>\n<button>확인</button></>', 'src/Example.tsx')
  assert.equal(entries.length, 2)
  assert.notEqual(entries[0]?.id, entries[1]?.id)
  assert.deepEqual(entries.map(entry => entry.line), [1, 2])
})

test('each review URL keeps route query and fragment while carrying its own scenario', () => {
  assert.equal(new Set(reviewScenarios.map(scenario => scenario.id)).size, reviewScenarios.length)
  for (const scenario of reviewScenarios) {
    const actual = new URL(reviewPreviewUrl(scenario), 'http://localhost:3000')
    const source = new URL(scenario.path, 'http://localhost:3000')
    assert.equal(actual.origin, source.origin)
    assert.equal(actual.pathname, source.pathname)
    assert.equal(actual.hash, source.hash)
    assert.equal(actual.searchParams.get('__review'), scenario.id)
    for (const [key, value] of source.searchParams) assert.equal(actual.searchParams.get(key), value)
  }
  assert.equal(findReviewScenario('unrecognized').id, 'welcome')
})

test('preview documents have independent storage, including transient login and recovery keys', () => {
  const first = createReviewStorage(), second = createReviewStorage()
  first.setItem('capsule-login-provider', 'EMAIL')
  first.setItem('capsule-session:990001:9001', 'recovery')
  assert.equal(second.getItem('capsule-login-provider'), null)
  assert.equal(first.length, 2)
  assert.equal(first.key(1), 'capsule-session:990001:9001')
  first.removeItem('capsule-login-provider')
  assert.equal(first.key(0), 'capsule-session:990001:9001')
  first.clear()
  assert.equal(first.length, 0)
  assert.equal(first.key(0), null)
})

test('status copy keeps feedback tone, source error conditions and loading labels', () => {
  const source = [
    'const authNotices = { "password-reset": { tone: "success", text: "비밀번호가 바뀌었어요." } }',
    'const messages = { INVALID_CREDENTIALS: "이메일 또는 비밀번호를 확인해 주세요." }',
    '<><FeedbackMessage tone="warning">이전 시간을 불러오지 못했어요.</FeedbackMessage>',
    '<EmptyState title="등록된 일정이 없어요" /><button>{busy ? "저장하고 있어요…" : "저장하기"}</button></>',
  ].join('\n')
  const entries = extractReviewCopy(source, 'src/Example.tsx')
  assert.equal(entries.find(entry => entry.text === '비밀번호가 바뀌었어요.')?.statusTone, 'success')
  assert.equal(entries.find(entry => entry.text === '비밀번호가 바뀌었어요.')?.symbol, 'password-reset')
  assert.equal(entries.find(entry => entry.symbol === 'INVALID_CREDENTIALS')?.text, '이메일 또는 비밀번호를 확인해 주세요.')
  assert.equal(entries.find(entry => entry.text === '이전 시간을 불러오지 못했어요.')?.statusTone, 'warning')
  assert.equal(entries.find(entry => entry.text === '등록된 일정이 없어요')?.statusTone, 'empty')
  assert.equal(entries.find(entry => entry.text === '저장하고 있어요…')?.statusTone, 'loading')
  assert.equal(entries.find(entry => entry.text === '저장하기')?.statusTone, undefined)
})

test('status message shortcuts point to existing conditions and distinguish related flows', () => {
  for (const scenario of reviewMessageScenarios) assert.ok(reviewScenarios.some(item => item.id === scenario.id), scenario.id)
  const entry = { id: 'test', text: '원문', file: 'src/shared/api/client.ts', line: 1, kind: '상태·데이터', symbol: 'INVALID_CREDENTIALS' }
  assert.deepEqual(messagePreview(entry), { id: 'login-error', exact: true })
  assert.deepEqual(messagePreview({ ...entry, file: 'src/features/auth/email-validation.ts' }), { id: 'signup-errors', exact: false })
})

test('irreversible-action warnings do not become empty-state messages', () => {
  const entries = extractReviewCopy('<p>삭제된 정보는 되돌릴 수 없어요.</p>', 'src/Example.tsx')
  assert.equal(entries[0]?.statusTone, 'warning')
})
