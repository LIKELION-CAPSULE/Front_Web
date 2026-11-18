/**
 * Copy for the usage guide, one entry per step, in order. Edit the wording here; the 3D, 2D and static versions all
 * read it. `\n` in a title is a line break. Scroll timing for each step lives in `GUIDE_STEP_RANGES` (guide-timeline).
 */
export const GUIDE_STEPS = [
  {
    id: 'rooms',
    eyebrow: '1 · 스터디룸',
    title: '같이 공부할\n스터디룸을 골라요',
    body: '스터디룸마다 함께 공부할 친구와 분위기가 달라요. 마음에 드는 자리를 골라 앉아 보세요.',
  },
  {
    id: 'companion',
    eyebrow: '2 · 함께 공부',
    title: '캠을 켜면 캐릭터가\n옆에서 같이 공부해요',
    body: '집중이 흐트러지거나 딴짓을 하면 친구가 먼저 말을 걸어 다시 책상으로 데려와요.',
  },
  {
    id: 'capsule',
    eyebrow: '3 · 캡슐 카드',
    title: '공부한 시간만큼\n호감도가 쌓여요',
    body: '공부를 마치면 그날의 기록이 담긴 캡슐 카드가 나와요. 친구와의 추억이 하나씩 쌓여요.',
  },
  {
    id: 'start',
    eyebrow: '이제 시작해 볼까요?',
    title: '오늘 목표를 정하고\n책상에 앉아요',
    body: '스터디룸을 고르면 오늘 공부할 목표를 정하고 바로 시작할 수 있어요.',
  },
] as const

export type GuideStep = (typeof GUIDE_STEPS)[number]

export const GUIDE_COPY = {
  dialogLabel: '캡슐 사용법',
  skip: '건너뛰기',
  next: '다음',
  previous: '이전',
  start: '오늘 목표 정하고 시작하기',
  scrollHint: '스크롤하거나 다음을 눌러 넘겨요',
  /** Shown on the monitor in step 2. */
  companionNudge: '어디 갔다 왔어? 같이 마저 하자!',
  /** Shown on the monitor in step 3. */
  affectionLabel: '호감도',
  capsuleLabel: '오늘의 캡슐 카드',
} as const

