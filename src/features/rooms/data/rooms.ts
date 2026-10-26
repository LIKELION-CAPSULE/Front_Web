import type { StudyRoom } from '@/features/rooms/types'

/** Local demo content, paired with the existing CAPSULE landing artwork. */
export const studyRooms: readonly StudyRoom[] = [
  {
    id: 'dawn-library',
    name: '방과 후, 너와 나',
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
    name: '냥냥 독서실',
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
]
