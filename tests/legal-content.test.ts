import test from 'node:test'
import assert from 'node:assert/strict'
import { hasLegalContent, hasRequiredLegalTerms } from '../src/features/auth/legal-content.ts'

test('empty and draft API documents are not published account terms', () => {
  for (const content of [undefined, null, '', ' \n ', '(이용약관 본문 준비 중)', '(개인정보 처리방침 본문 준비 중)', '**이용약관 본문 준비중**', '개인정보처리방침 내용 준비 중입니다.']) {
    assert.equal(hasLegalContent(content), false, String(content))
  }
})

test('account consent requires the two displayed published versions and never auto-agrees to unseen terms', () => {
  const service = { termVersionId: 3, code: 'SERVICE', required: true, content: '서버 이용약관 전문' }
  const privacy = { termVersionId: 4, code: 'PRIVACY', required: true, content: '서버 개인정보 처리방침 전문' }
  assert.equal(hasRequiredLegalTerms([service, privacy]), true)
  for (const terms of [[], [service], [service, service], [service, { ...privacy, content: '(개인정보 처리방침 본문 준비 중)' }], [service, { ...privacy, content: '' }], [service, { ...privacy, termVersionId: NaN }], [service, { ...privacy, termVersionId: -1 }], [service, { ...privacy, required: false }], [service, privacy, { termVersionId: 5, code: 'OTHER', required: true, content: '다른 필수 전문' }]]) {
    assert.equal(hasRequiredLegalTerms(terms), false)
  }
  assert.equal(hasRequiredLegalTerms([service, privacy, { termVersionId: 5, code: 'MARKETING', required: false, content: '선택 전문' }]), true)
})

test('published legal text remains authoritative even when an article mentions a service in preparation', () => {
  for (const content of ['### 제1조 (목적)\n이 약관은 서비스 이용 조건을 정합니다.', '서비스는 준비 중이며 출시 일정은 별도로 안내합니다.', '# 개인정보 처리방침\n개인정보 처리방침 본문 준비 중인 항목은 추후 공지합니다.']) {
    assert.equal(hasLegalContent(content), true, content)
  }
})

test('local dev server only: placeholder bodies pass (warned once); empty bodies and wrong codes or ids still fail', async () => {
  const { devLegalTermsReady } = await import('../src/features/auth/dev-legal-terms.ts')
  const { hasLegalText } = await import('../src/features/auth/legal-content.ts')
  const service = { termVersionId: 3, code: 'SERVICE', required: true, content: '(이용약관 본문 준비 중)' }
  const privacy = { termVersionId: 4, code: 'PRIVACY', required: true, content: '(개인정보 처리방침 본문 준비 중)' }
  const placeholders = [service, privacy]
  // Flag off (production and the default): the published-body rule blocks the placeholders.
  assert.equal(hasRequiredLegalTerms(placeholders), false)
  // Flag on (the dev path): they pass, with one console warning for the session.
  const warnings: string[] = []
  assert.equal(devLegalTermsReady(placeholders, message => warnings.push(message)), true)
  assert.equal(devLegalTermsReady(placeholders, message => warnings.push(message)), true)
  assert.deepEqual(warnings, ['[dev] 약관 본문이 준비 중이라 개발 서버에서만 검사를 건너뜁니다.'])
  // Empty bodies fail with the flag on or off; so do wrong codes and version ids.
  for (const terms of [
    [service, { ...privacy, content: '' }], [service, { ...privacy, content: ' \n ' }], [service, { ...privacy, content: null }],
    [service, { ...privacy, code: 'OTHER' }], [service, { ...privacy, termVersionId: 0 }], [service, { ...privacy, termVersionId: NaN }], [service],
  ]) {
    assert.equal(devLegalTermsReady(terms as never, () => {}), false, JSON.stringify(terms))
    assert.equal(hasRequiredLegalTerms(terms as never), false)
  }
  assert.equal(hasLegalText('(이용약관 본문 준비 중)'), true)
  assert.equal(hasLegalText('  '), false)
})

test('the wrapper keeps the strict rule unless the dev server says otherwise', async () => {
  const { createServer } = await import('vite')
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null } })
  try {
    // A Vite dev module graph: import.meta.env.DEV is true here, as on the local dev server.
    const { legalTermsReady } = await server.ssrLoadModule('/src/features/auth/legal-terms-ready.ts')
    const published = [{ termVersionId: 3, code: 'SERVICE', required: true, content: '전문' }, { termVersionId: 4, code: 'PRIVACY', required: true, content: '전문' }]
    assert.equal(legalTermsReady(published), true)
    assert.equal(legalTermsReady([{ ...published[0], content: '(이용약관 본문 준비 중)' }, published[1]]), true)
    assert.equal(legalTermsReady([{ ...published[0], content: '' }, published[1]]), false)
  } finally { await server.close() }
})
