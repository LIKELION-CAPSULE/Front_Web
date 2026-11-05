import assert from 'node:assert/strict'
import test from 'node:test'
import { sendChatDraft, type ChatDrafts } from '../src/features/session/chat-draft.ts'

function pendingReply() {
  let resolve!: (sent: boolean) => void
  const promise = new Promise<boolean>(done => { resolve = done })
  return { promise, resolve }
}

test('a delayed reply never clears the next draft or another friend’s input', async () => {
  let drafts: ChatDrafts = { chaerin: '첫 메시지', sua: '다른 친구 초안' }
  const reply = pendingReply()
  const sending = sendChatDraft({ characterId: 'chaerin', text: drafts.chaerin!, inputType: 'TEXT', onSend: () => reply.promise, updateDrafts: update => { drafts = update(drafts) } })
  assert.deepEqual(drafts, { chaerin: '', sua: '다른 친구 초안' })
  drafts = { ...drafts, chaerin: '답장 중에 쓴 다음 메시지', sua: '상대를 바꾸고 쓴 초안' }
  reply.resolve(true)
  assert.equal(await sending, true)
  assert.deepEqual(drafts, { chaerin: '답장 중에 쓴 다음 메시지', sua: '상대를 바꾸고 쓴 초안' })
})

test('a failed send restores the original text only when its draft is still empty', async () => {
  for (const next of ['', '이미 새로 작성 중']) {
    let drafts: ChatDrafts = { chaerin: '전송 실패한 메시지', sua: '다른 초안' }
    const reply = pendingReply()
    const sending = sendChatDraft({ characterId: 'chaerin', text: drafts.chaerin!, inputType: 'TEXT', onSend: () => reply.promise, updateDrafts: update => { drafts = update(drafts) } })
    drafts = { ...drafts, chaerin: next }
    reply.resolve(false)
    assert.equal(await sending, false)
    assert.equal(drafts.chaerin, next || '전송 실패한 메시지')
    assert.equal(drafts.sua, '다른 초안')
  }
})

test('quick messages leave typed drafts intact whether the reply succeeds or fails', async () => {
  for (const success of [true, false]) {
    const original = { chaerin: '작성 중인 메시지' }
    let drafts: ChatDrafts = original
    assert.equal(await sendChatDraft({ characterId: 'chaerin', text: '파이팅', inputType: 'QUICK', onSend: async () => success, updateDrafts: update => { drafts = update(drafts) } }), success)
    assert.equal(drafts, original)
  }
})

test('an unexpected rejection also restores the submitted draft', async () => {
  let drafts: ChatDrafts = { chaerin: '복원할 메시지' }
  await assert.rejects(sendChatDraft({ characterId: 'chaerin', text: drafts.chaerin!, inputType: 'TEXT', onSend: async () => { throw new Error('connection closed') }, updateDrafts: update => { drafts = update(drafts) } }), /connection closed/)
  assert.equal(drafts.chaerin, '복원할 메시지')
})
