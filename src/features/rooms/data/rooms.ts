import type { StudyRoom } from '@/features/rooms/types'

/** Local wireframe fixtures. Replace through the room service when an API is agreed. */
export const studyRooms: readonly StudyRoom[] = [
  {
    id: 'dawn-library',
    name: '새벽 도서관',
    description: '새벽 4시, 창가 자리. 조용히 집중하고 싶을 때',
    introduction: '새벽 4시, 아무도 없는 도서관 창가 자리. 말없이 같이 집중하고 싶은 날을 위한 룸이에요.',
    contentStatus: 'preview',
    characters: [
      { id: 'chaerin', name: '채린', description: '츤데레 · 같은 반 친구' },
      { id: 'sua', name: '수아', description: '어떤 친구일지 곧 소개할게요' },
      { id: 'dahee', name: '다희', description: '어떤 친구일지 곧 소개할게요' },
    ],
  },
  {
    id: 'room-2',
    name: '새로운 스터디룸',
    description: '새로운 분위기의 공부 공간을 준비하고 있어요',
    introduction: '함께 공부할 새로운 친구들을 준비하고 있어요.',
    contentStatus: 'coming-soon',
    characters: [
      { id: 'room-2-friend-1', name: '친구 1', description: '곧 만나요' },
      { id: 'room-2-friend-2', name: '친구 2', description: '곧 만나요' },
    ],
  },
  {
    id: 'room-3',
    name: '쉬어가는 스터디룸',
    description: '편안한 분위기의 공부 공간을 준비하고 있어요',
    introduction: '차분하게 공부에 몰입할 수 있는 공간을 준비하고 있어요.',
    contentStatus: 'coming-soon',
    characters: [{ id: 'room-3-friend-1', name: '친구 1', description: '곧 만나요' }],
  },
]
