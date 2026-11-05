import test from 'node:test'
import assert from 'node:assert/strict'
import { hasLegalContent } from '../src/features/auth/legal-content.ts'

test('empty and draft API documents use the existing bundled legal copy', () => {
  for (const content of [undefined, null, '', ' \n ', '(이용약관 본문 준비 중)', '(개인정보 처리방침 본문 준비 중)', '**이용약관 본문 준비중**', '개인정보처리방침 내용 준비 중입니다.']) {
    assert.equal(hasLegalContent(content), false, String(content))
  }
})

test('published legal text remains authoritative even when an article mentions a service in preparation', () => {
  for (const content of ['### 제1조 (목적)\n이 약관은 서비스 이용 조건을 정합니다.', '서비스는 준비 중이며 출시 일정은 별도로 안내합니다.', '# 개인정보 처리방침\n개인정보 처리방침 본문 준비 중인 항목은 추후 공지합니다.']) {
    assert.equal(hasLegalContent(content), true, content)
  }
})
