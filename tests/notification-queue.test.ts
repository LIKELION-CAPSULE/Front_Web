import test from 'node:test'
import assert from 'node:assert/strict'
import { enqueueNotification, type NotificationItem } from '../src/shared/ui/notification-queue.ts'

const item = (id: string): NotificationItem => ({ id, tone: 'error', title: `제목 ${id}`, text: `안내 ${id}` })

test('notifications appear newest first with at most three visible cards', () => {
  const first = item('1'), second = item('2'), third = item('3'), fourth = item('4')
  const current = [third, second, first]
  assert.deepEqual(enqueueNotification(current, fourth).map(notice => notice.id), ['4', '3', '2'])
  assert.deepEqual(current.map(notice => notice.id), ['3', '2', '1'])
})

test('duplicate results coalesce across repeated delivery and StrictMode effect replay', () => {
  const first = item('1')
  const current = [first]
  assert.equal(enqueueNotification(current, { ...first, id: 'replay' }), current)
  assert.equal(enqueueNotification(current, { ...first, id: 'different-result', text: '다른 결과예요.' }).length, 2)
})
