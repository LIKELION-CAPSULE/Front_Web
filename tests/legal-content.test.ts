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
