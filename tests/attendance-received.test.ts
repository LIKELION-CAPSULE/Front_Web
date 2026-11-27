import assert from 'node:assert/strict'
import test from 'node:test'

// attendance-service keeps 「received today」 in localStorage; Node has none.
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value) }, removeItem: (key: string) => { store.delete(key) } },
})

const { balanceShownAwayFromHome, fetchAttendance, markAttendanceReceived } = await import('../src/features/attendance/attendance-service.ts')
const { businessDay } = await import('../src/shared/lib/format.ts')

/** 34 `filter=ATTENDANCE` as the server answers after the day's first credit read: today's grant is listed. */
const client = (createdAt: string[]) => ({
  request: async <T,>(path: string): Promise<T> => {
    assert.match(path, /^\/credits\/transactions/)
    return { items: createdAt.map((at, index) => ({ id: index + 1, type: 'ATTENDANCE', change: 1500, createdAt: at })), nextCursor: null } as T
  },
})
const NOW = Date.now()
const grantedToday = client([new Date(NOW).toISOString()])

test('credits source: before leaving home today is pending (the chip holds 1,500 back); after, it is received', async () => {
  store.clear()
  const before = await fetchAttendance(grantedToday, 7)
  assert.equal(before.checkedToday, false)
  assert.equal(before.pendingCredit, 1500)

  assert.equal(markAttendanceReceived(7, 'credits', NOW), true)
  const after = await fetchAttendance(grantedToday, 7)
  assert.equal(after.checkedToday, true, 'coming back home the same day shows today 「받음」')
  assert.equal(after.pendingCredit, 0, 'nothing is held back from the header again')
  assert.equal(after.cycleDay, before.cycleDay + 1)
})

test('marking is once a day, per account, and never with the attendance API', () => {
  store.clear()
  assert.equal(markAttendanceReceived(8, 'attendance-api', NOW), false)
  assert.equal(store.size, 0)
  assert.equal(markAttendanceReceived(8, 'credits', NOW), true)
  assert.equal(markAttendanceReceived(8, 'credits', NOW), false)
  assert.equal(store.get('capsule-attendance-received:8'), businessDay(NOW))
  assert.equal(markAttendanceReceived(9, 'credits', NOW), true, 'another account is separate')
  // The next business day (after 05:00) is a new day to receive.
  assert.equal(markAttendanceReceived(8, 'credits', NOW + 24 * 3600_000), true)
})

test('a balance read today and shown on another screen counts; home, the tour and an old balance do not', () => {
  const at5 = Date.parse('2026-11-27T05:30:00+09:00')
  assert.equal(balanceShownAwayFromHome('/my-mates', false, 1000, at5), true)
  assert.equal(balanceShownAwayFromHome('/credits', false, 0, at5), true)
  assert.equal(balanceShownAwayFromHome('/', false, 1000, at5), false, 'home holds it until the button or leaving')
  assert.equal(balanceShownAwayFromHome('/my-mates', true, 1000, at5), false, 'service tour')
  assert.equal(balanceShownAwayFromHome('/my-mates', false, Number.POSITIVE_INFINITY, at5), false, 'no balance yet')
  // Read at 04:50, shown at 05:30: yesterday's business day, today's grant not in it yet.
  assert.equal(balanceShownAwayFromHome('/my-mates', false, 40 * 60_000, at5), false)
})
