import type { StudyRoom } from '@/features/rooms/types'

/** Local demo content, paired with the existing CAPSULE landing artwork. */
export const studyRooms: readonly StudyRoom[] = [
  {
    id: 'dawn-library',
    name: '쌀쌀맞은 갸루짝꿍이 나에게만 친절하다!',
    description: '노을빛 교실, 세 친구와 함께하는 방과 후.',
    introduction:
      '노을이 드는 교실에 채린, 수아, 다희가 먼저 와 있어요. 친구들의 옆자리에서 오늘의 책을 펼쳐 봐요.',
    contentStatus: 'preview',
    characters: [
      {
        id: 'chaerin',
        name: '채린',
        description: '츤데레 · 같은 반 친구',
      },
      {
        id: 'sua',
        name: '수아',
        description: '다정한 선배 · 조용한 응원',
      },
      {
        id: 'dahee',
        name: '다희',
        description: '차분한 성격 · 꾸준한 공부 친구',
      },
    ],
  },
  {
    id: 'room-2',
    name: '전교 1등을 이겨라',
    description: '불 켜진 도서관, 도윤과 한 문제 더.',
    introduction:
      '밤이 깊어진 도서관, 도윤도 아직 책을 덮지 않았어요. 스탠드 불빛 아래에서 오늘 정한 공부를 함께 마쳐 봐요.',
    contentStatus: 'preview',
    characters: [
      {
        id: 'doyun',
        name: '도윤',
        description: '차분한 선배 · 나의 공부 라이벌',
      },
    ],
  },
  {
    id: 'room-3',
    name: '냥냥이가 날 그렇게 쳐다보면 집중할 수가 없잖아!!',
    description: '햇살 드는 창가, 모루와 느긋하게.',
    introduction:
      '햇살 드는 창가에서 모루가 쿠션에 기대어 기다려요. 조용히 눈을 맞추고, 내 속도로 책을 읽어 봐요.',
    contentStatus: 'preview',
    characters: [
      {
        id: 'moru',
        name: '모루',
        description: '느긋한 고양이 · 책상 위 공부 친구',
      },
    ],
  },
  {
    id: 'lantern',
    name: '김상병의 두근두근 비밀연등',
    description: '조용해진 생활관, 동료들과 이어 가는 공부.',
    introduction:
      '조용해진 생활관에서 김상병과 동료들이 책을 펼쳤어요. 하루를 마무리하며 남은 공부를 차근차근 이어 가요.',
    contentStatus: 'preview',
    characters: [
      { id: 'kim-sergeant', name: '김상병', description: '든든한 선임 · 야간 자습 친구' },
      { id: 'yoon-private', name: '윤일병', description: '성실한 동료 · 노트 정리 담당' },
      { id: 'lee-medic', name: '이하사', description: '다정한 의무관 · 따뜻한 응원' },
    ],
  },
  {
    id: 'fantasy',
    name: '페보니우스 마법학교',
    description: '촛불 밝힌 도서관, 마법학교 친구들과 함께.',
    introduction:
      '촛불이 반짝이는 마법학교 도서관에 세 친구가 모였어요. 에이든, 엘리아, 레온과 두꺼운 책도 한 장씩 읽어 가요.',
    contentStatus: 'preview',
    characters: [
      { id: 'aiden', name: '에이든', description: '당당한 마법사 · 도전을 즐기는 친구' },
      { id: 'elia', name: '엘리아', description: '차분한 연구자 · 꼼꼼한 공부 친구' },
      { id: 'leon', name: '레온', description: '여유로운 선배 · 조용한 격려' },
    ],
  },
  {
    id: 'iljin',
    name: '모르는 일진이 나한테 말을 건다',
    description: '말없이 비워 둔 옆자리, 민하준과 함께.',
    introduction:
      '노을이 드는 서가 앞, 민하준이 노트를 들고 기다려요. 말없이 비워 둔 옆자리에서 오늘의 공부를 시작해 봐요.',
    contentStatus: 'preview',
    characters: [
      { id: 'hajun', name: '민하준', description: '무심한 같은 반 친구 · 뜻밖의 다정함' },
    ],
  },
  {
    id: 'jurassic',
    name: '쥬라기 독서실',
    description: '유리와 공룡 친구들, 쿠션 위에서 포근하게.',
    introduction:
      '햇살 드는 창가에 유리와 공룡 친구들이 모였어요. 푹신한 쿠션 곁에서 서두르지 않고 한 장씩 읽어 봐요.',
    contentStatus: 'preview',
    characters: [{ id: 'yuri', name: '유리', description: '포근한 독서실 친구 · 공룡들과 함께' }],
  },
  {
    id: 'lab',
    name: '뚝딱뚝딱 실험실',
    description: '호기심 많은 세 친구와 함께하는 공부 실험.',
    introduction:
      '별빛 드는 실험실에서 핑키, 코튼, 라임이 노트를 펼쳤어요. 친구들과 머리를 맞대고 궁금했던 문제를 풀어 봐요.',
    contentStatus: 'preview',
    characters: [
      { id: 'pinky', name: '핑키', description: '분홍빛 발명가 · 호기심 많은 친구' },
      { id: 'cotton', name: '코튼', description: '꼼꼼한 조수 · 기록을 좋아하는 친구' },
      { id: 'lime', name: '라임', description: '엉뚱한 연구원 · 밝은 응원 담당' },
    ],
  },
  {
    id: 'joseon',
    name: '조선시대 야간 학습',
    description: '등불 밝힌 궁궐 서재, 세 친구와 밤 공부.',
    introduction:
      '고요한 궁궐 서재에 등불이 켜졌어요. 연화, 설아, 봄이와 나란히 앉아 차분하게 밤 공부를 시작해 봐요.',
    contentStatus: 'preview',
    characters: [
      { id: 'yeonhwa', name: '연화', description: '기품 있는 세자빈 · 차분한 공부 친구' },
      { id: 'seola', name: '설아', description: '성실한 궁녀 · 말없이 지키는 옆자리' },
      { id: 'bomi', name: '봄이', description: '밝은 궁궐 친구 · 다정한 격려' },
    ],
  },
]
