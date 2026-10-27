import type { StudyRoom } from '@/features/rooms/types'

/** Local demo content, paired with the existing CAPSULE landing artwork. */
export const studyRooms: readonly StudyRoom[] = [
  {
    id: 'dawn-library',
    name: '쌀쌀맞은 갸루짝꿍이 나에게만 친절하다!',
    description: '아무도 없는 교실, 나를 기다리는 세 친구.',
    introduction:
      '노을이 내려앉은 교실, 오늘도 네 옆자리는 비워 뒀어. 채린, 수아, 다희와 각자의 목표를 향해 한 장씩 넘겨 봐요.',
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
        description: '차분한 친구 · 꾸준한 공부 메이트',
      },
    ],
  },
  {
    id: 'room-2',
    name: '전교 1등을 이겨라',
    description: '조용한 승부욕이 필요한 밤, 오늘의 라이벌과.',
    introduction:
      '모두가 돌아간 늦은 밤, 아직 불이 켜진 자리 하나. 도윤과 함께 어제의 나를 한 걸음 넘어 봐요.',
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
    description: '책 한 권, 고양이 한 마리. 이만하면 완벽한 오후.',
    introduction:
      '햇살 좋은 창가, 책 사이에 자리를 잡은 모루. 서두르지 않아도 괜찮아요. 오늘은 포근하게 집중해 봐요.',
    contentStatus: 'preview',
    characters: [
      {
        id: 'moru',
        name: '모루',
        description: '느긋한 고양이 · 책상 위 공부 메이트',
      },
    ],
  },
  {
    id: 'lantern',
    name: '김상병의 두근두근 비밀연등',
    description: '불이 꺼진 뒤에도, 함께 지켜 주는 공부 시간.',
    introduction:
      '조용해진 생활관 옆 자습실, 책상 위 스탠드는 아직 켜져 있어요. 김상병과 동료들이 오늘의 마지막 한 페이지를 함께해요.',
    contentStatus: 'preview',
    characters: [
      { id: 'kim-sergeant', name: '김상병', description: '든든한 선임 · 야간 자습 메이트' },
      { id: 'yoon-private', name: '윤일병', description: '성실한 동료 · 노트 정리 담당' },
      { id: 'lee-medic', name: '이하사', description: '다정한 의무관 · 따뜻한 응원' },
    ],
  },
  {
    id: 'fantasy',
    name: '페보니우스 마법학교',
    description: '주문 대신 문제집, 마법학교 친구들과 함께.',
    introduction:
      '촛불이 반짝이는 마법학교 도서관에서 각자의 책을 펼쳐요. 에이든, 엘리아, 레온과 오늘의 공부도 작은 마법처럼 쌓아 가요.',
    contentStatus: 'preview',
    characters: [
      { id: 'aiden', name: '에이든', description: '당당한 마법사 · 도전을 즐기는 친구' },
      { id: 'elia', name: '엘리아', description: '차분한 연구자 · 꼼꼼한 공부 메이트' },
      { id: 'leon', name: '레온', description: '여유로운 선배 · 조용한 격려' },
    ],
  },
  {
    id: 'iljin',
    name: '모르는 일진이 나한테 말을 건다',
    description: '무심한 듯 옆자리를 지키는 뜻밖의 공부 친구.',
    introduction:
      '햇살이 들어오는 교실, 민하준이 말없이 옆자리를 내줘요. 처음엔 조금 어색해도 한 문제씩 함께 풀다 보면 금세 익숙해질 거예요.',
    contentStatus: 'preview',
    characters: [
      { id: 'hajun', name: '민하준', description: '무심한 같은 반 친구 · 뜻밖의 다정함' },
    ],
  },
  {
    id: 'jurassic',
    name: '쥬라기 독서실',
    description: '작은 공룡들과 느긋하게, 오늘도 한 장씩.',
    introduction:
      '창가의 햇살, 펼쳐 둔 노트, 곁을 지키는 공룡 친구들. 유리와 함께 서두르지 않고 나만의 공부 속도를 찾아봐요.',
    contentStatus: 'preview',
    characters: [{ id: 'yuri', name: '유리', description: '포근한 독서실 친구 · 공룡들과 함께' }],
  },
  {
    id: 'lab',
    name: '뚝딱뚝딱 실험실',
    description: '호기심 많은 작은 연구원들과 집중 실험 시작!',
    introduction:
      '반짝이는 작업대에 오늘의 목표를 올려 둬요. 핑키, 코튼, 라임과 문제를 풀고 아이디어를 모으며 나만의 성취를 만들어 봐요.',
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
    description: '등불과 달빛 아래, 궁궐의 밤 공부.',
    introduction:
      '달이 뜬 궁궐 서재에서 조용히 책장을 넘겨요. 연화, 설아, 봄이와 은은한 등불 곁에 앉아 오늘의 목표를 마무리해요.',
    contentStatus: 'preview',
    characters: [
      { id: 'yeonhwa', name: '연화', description: '기품 있는 세자빈 · 차분한 공부 메이트' },
      { id: 'seola', name: '설아', description: '성실한 궁녀 · 말없이 지키는 옆자리' },
      { id: 'bomi', name: '봄이', description: '밝은 궁궐 친구 · 다정한 격려' },
    ],
  },
]
