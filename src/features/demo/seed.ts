import { businessDay, dayKey } from '../../shared/lib/format.ts'
import type { DemoState, LedgerEntry } from './types.ts'
import { DEFAULT_PROFILE_NAME } from './profile.ts'
import { createSampleRecords } from './sample-records.ts'
import { createPastScheduleSamples, SCHEDULE_SAMPLE_VERSION } from './sample-schedule.ts'

export function createDemoState(now = Date.now()): DemoState {
  const today = new Date(`${dayKey(now)}T12:00:00+09:00`).getTime()
  const records = createSampleRecords(now)
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
      description: '이전 공부 이용',
      kind: 'use',
      change: -8655,
      balance: 0,
    },
    {
      id: 'seed-study',
      at: today - 86400000 + 1000,
      description: '공부 옵션 · 스탠다드 (새벽 도서관)',
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
      name: DEFAULT_PROFILE_NAME,
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
    latestRecordId: records[0]?.id ?? null,
    scheduleSampleVersion: SCHEDULE_SAMPLE_VERSION,
    memories: [
      {
        id: 'memory-exam',
        kind: '시험',
        title: '영어 시험',
        date: dayKey(today + 86400000),
        time: '',
      },
      {
        id: 'memory-midterm',
        kind: '시험',
        title: '중간고사',
        date: dayKey(today + 5 * 86400000),
        time: '',
      },
      {
        id: 'memory-promise',
        kind: '약속',
        title: '내일 같이 공부',
        date: dayKey(today + 86400000),
        time: '20:00',
      },
      ...createPastScheduleSamples(now),
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
