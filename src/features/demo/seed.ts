import { studyRooms } from '../rooms/data/rooms.ts'
import { businessDay, dayKey } from '../../shared/lib/format.ts'
import type { DemoState, LedgerEntry, StudyRecord } from './types.ts'

export function createDemoState(now = Date.now()): DemoState {
  const today = new Date(`${dayKey(now)}T12:00:00+09:00`).getTime()
  const records: StudyRecord[] = []
  const roomTotals = [1860, 720, 300]
  const counts = [24, 9, 4]
  studyRooms.forEach((room, roomIndex) => {
    let remaining = roomTotals[roomIndex]!
    const count = counts[roomIndex]!
    for (let i = 0; i < count; i++) {
      const minutes =
        i === 0 && roomIndex === 0
          ? 90
          : i === count - 1
            ? remaining
            : Math.floor(remaining / (count - i))
      remaining -= minutes
      const offset = roomIndex === 0 ? i : i * 3 + roomIndex * 2
      const end = today - offset * 86400000 - roomIndex * 3600000
      records.push({
        id: `sample-${roomIndex}-${i}`,
        roomId: room.id,
        characterIds: room.characters.map((c) => c.id),
        tier: 'standard',
        startedAt: end - minutes * 60000,
        endedAt: end,
        studySeconds: minutes * 60,
        focusSeconds: Math.round(minutes * 60 * 0.92),
        awaySeconds: Math.round(minutes * 60 * 0.08),
        returns: 3,
        completed: true,
        automatic: roomIndex === 0 && i === 1,
      })
    }
  })
  records.sort((a, b) => b.endedAt - a.endedAt)
  let balance = 0
  const ledger: LedgerEntry[] = [
    {
      id: 'seed-charge',
      at: today - 8 * 86400000,
      description: '크레딧 충전 9,900원 · 카드 (+5% 보너스 495)',
      kind: 'charge',
      change: 10395,
      balance: 0,
      amount: 9900,
    },
    {
      id: 'seed-previous',
      at: today - 6 * 86400000,
      description: '이전 공부 세트 이용',
      kind: 'use',
      change: -8655,
      balance: 0,
    },
    {
      id: 'seed-study',
      at: today - 86400000 + 1000,
      description: '세트 등급 · 스탠다드 (새벽 도서관)',
      kind: 'use',
      change: -200,
      balance: 0,
    },
    {
      id: 'seed-voice',
      at: today - 86400000 + 2000,
      description: '보이스 메시지 · 채린',
      kind: 'use',
      change: -100,
      balance: 0,
    },
    {
      id: 'seed-bonus',
      at: today - 86400000 + 3000,
      description: '출석 보너스',
      kind: 'bonus',
      change: 100,
      balance: 0,
    },
    {
      id: 'seed-upgrade',
      at: today - 86400000 + 4000,
      description: '등급 올리기 · 스탠다드 → 프리미엄 (차액)',
      kind: 'use',
      change: -300,
      balance: 0,
    },
  ]
    .map((entry) => {
      balance += entry.change
      return { ...entry, balance } as LedgerEntry
    })
    .reverse()
  return {
    version: 1,
    profile: {
      name: '승희',
      loggedIn: false,
      onboarded: false,
      avatar: { hair: 1, outfit: 0, appearance: 0, background: 0 },
    },
    firstVisit: false,
    credits: balance,
    ledger,
    pass: null,
    cameraChecked: false,
    cameraEnabled: true,
    examPromptedRooms: [],
    records,
    activeSession: null,
    latestRecordId: records[0]!.id,
    memories: [
      {
        id: 'memory-exam',
        characterId: 'chaerin',
        kind: '시험',
        title: '영어 시험',
        date: dayKey(today + 86400000),
        time: '',
      },
      {
        id: 'memory-midterm',
        characterId: 'chaerin',
        kind: '시험',
        title: '중간고사',
        date: dayKey(today + 5 * 86400000),
        time: '',
      },
      {
        id: 'memory-promise',
        characterId: 'chaerin',
        kind: '약속',
        title: '내일 같이 공부',
        date: dayKey(today + 86400000),
        time: '20:00',
      },
    ],
    messages: [],
    chatUsage: { day: businessDay(now), used: 0 },
    savedRooms: [],
    gifts: [
      {
        id: 'gift-seed-1',
        characterId: 'chaerin',
        productId: 'cheer',
        name: '응원 한마디',
        at: today - 86400000,
        reply: '오늘도 잘하고 있어.',
        voice: true,
      },
      {
        id: 'gift-seed-2',
        characterId: 'chaerin',
        productId: 'coffee',
        name: '커피',
        at: today - 3 * 86400000,
        reply: '고마워, 잘 마실게.',
        voice: false,
      },
    ],
  }
}
