import type { TierId } from './types'

export const tiers: {
  id: TierId
  name: string
  price: number
  features: string[]
  summary: string
}[] = [
  {
    id: 'basic',
    name: '베이직',
    price: 0,
    features: [
      '딴짓 반응 · 복귀 칭찬',
      '쉬는 시간 대화 하루 3턴',
      '(매일 새벽 5시 초기화)',
      '미리 만든 반응 음성',
    ],
    summary: '기본 반응 · 하루 3턴 대화',
  },
  {
    id: 'standard',
    name: '스탠다드',
    price: 200,
    features: ['기본 AI 모델로 자유 대화', '오늘 공부 내용 반영', '기본 음성'],
    summary: '기본 AI 자유 대화 · 기본 음성',
  },
  {
    id: 'premium',
    name: '프리미엄',
    price: 500,
    features: [
      '이름 · 시험 일정 · 약속 기억',
      '감정 표현이 살아 있는 대사',
      '캐릭터 전용 고품질 보이스',
    ],
    summary: '약속 · 일정 기억 · 고품질 보이스',
  },
  {
    id: 'special',
    name: '스페셜',
    price: 1000,
    features: [
      '상위 AI 모델, 가장 자유로운 대화',
      '스페셜 전용 특별 반응 모션',
      '고품질 보이스 + 기념 보이스',
    ],
    summary: '상위 AI · 특별 모션 · 기념 보이스',
  },
]
export const tierById = (id: TierId) => tiers.find((tier) => tier.id === id) ?? tiers[0]!
export const isTier = (id: unknown): id is TierId => tiers.some((tier) => tier.id === id)

export const products = [
  {
    id: 'cheer',
    name: '응원 한마디',
    kind: '보이스',
    price: 100,
    description: '“오늘도 잘하고 있어.”',
    reply: '오늘도 잘하고 있어. 네 속도대로 가면 돼.',
  },
  {
    id: 'name',
    name: '이름 불러 주기',
    kind: '보이스',
    price: 300,
    description: '“같이 하자.”',
    reply: '같이 하자. 오늘도 네 자리는 비워 뒀어.',
  },
  {
    id: 'exam',
    name: '시험 전날 응원',
    kind: '보이스',
    price: 500,
    description: '시험 일정에 맞춘 응원',
    reply: '그동안 열심히 했잖아. 내일은 네가 준비한 만큼 보여 주고 와.',
  },
  {
    id: 'coffee',
    name: '커피',
    kind: '선물',
    price: 200,
    description: '받으면 쉬는 시간에 마시는 연출',
    reply: '고마워, 잘 마실게. 쉬는 시간에 같이 마시자.',
  },
  {
    id: 'dessert',
    name: '디저트',
    kind: '선물',
    price: 400,
    description: '다음 공부를 시작할 때 같이 먹기',
    reply: '이거 내가 좋아하는 거잖아. 다음 공부할 때 같이 먹자.',
  },
  {
    id: 'flowers',
    name: '꽃다발',
    kind: '선물',
    price: 1000,
    description: '기념 보이스 + 특별 반응',
    reply: '나 주는 거야? 고마워. 오늘 공부도 같이 힘내자.',
  },
] as const

export const chargeProducts = [
  { id: 'charge-1000', name: '1,000 크레딧', amount: 1000, credits: 1000, bonus: 0, days: 0 },
  { id: 'charge-4900', name: '4,900 크레딧', amount: 4900, credits: 4900, bonus: 0, days: 0 },
  { id: 'charge-9900', name: '10,395 크레딧', amount: 9900, credits: 9900, bonus: 495, days: 0 },
  { id: 'charge-19900', name: '20,895 크레딧', amount: 19900, credits: 19900, bonus: 995, days: 0 },
  { id: 'exam-pass', name: '시험기간 응원 패스', amount: 6900, credits: 0, bonus: 0, days: 14 },
  { id: 'character-pass', name: '캐릭터 패스', amount: 9900, credits: 0, bonus: 0, days: 30 },
] as const
