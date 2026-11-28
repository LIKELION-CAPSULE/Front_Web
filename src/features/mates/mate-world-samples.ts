import type { MateWorldContent } from './mate-worlds.ts'

/**
 * The planning specs' worlds (2026-11-28: 강채린 PM draft, 서도현 EP.01–05) for development and the local mock only:
 * loaded through dev-samples.ts behind `import.meta.env.DEV`, so production bundles carry none of it. The real worlds
 * and the talk's prompt are the backend's; only what a screen shows is here (the world's name, place and outfit in
 * short form, one line of introduction and the sample line about the place) — no prompt, mood or time of day.
 *
 * Pictures: only what the app already has, and only where it matches — 채린's EP.01 교실 gets the classroom call
 * background and her full still (school uniform). 서도현's still is a school uniform too, which none of his worlds
 * wears, so his worlds show the soft placeholder. A mate without examples gets none (「준비 중」).
 */
type SampleWorld = Required<Pick<MateWorldContent, 'title' | 'place' | 'outfit' | 'summary' | 'sampleLine'>> & {
  /** The app's classroom background and the mate's full still belong to this world. */
  appArt?: true
}

const WORLDS: Readonly<Record<string, readonly SampleWorld[]>> = {
  chaerin: [
    {
      title: '노을 진 방과 후 교실',
      place: '교실',
      outfit: '교복',
      summary: '수업이 모두 끝난 교실에서 자습 짝꿍 채린과 처음 함께 공부하는 기본 세계관',
      sampleLine: '창밖 좀 봐. …노을 지네. 뭐, 그렇다고.',
      appArt: true,
    },
    {
      title: '단둘이 남은 야자실',
      place: '야자실',
      outfit: '체육복',
      summary: '다들 돌아간 야자실, 체육복 차림으로 버티는 채린과 함께하는 평일 밤 공부',
      sampleLine: '쉿, 감독 쌤 지나간다. …됐다, 갔어.',
    },
    {
      title: '주말 오후의 카페',
      place: '카페',
      outfit: '연회색 후드티, 연청 데님',
      summary: '처음 보는 사복 차림의 채린과 세련된 카페에서 보내는 느긋한 주말 공부 시간',
      sampleLine: '이 집 딸기라떼 진짜 맛있거든? …커피는 왜 마시는지 모르겠어. 써.',
    },
    {
      title: '불 켜진 학교 도서관',
      place: '학교 도서관',
      outfit: '트랙 져지',
      summary: '시험 직전 평일 저녁, 학교 도서관 열람석에서 져지 차림의 채린과 속삭이며 공부하는 시간',
      sampleLine: '쉿, 사서 쌤 쳐다본다. …너 때문에 웃음 참느라 죽는 줄.',
    },
    {
      title: '하얀 채린의 방',
      place: '채린의 방',
      outfit: '아이보리 긴팔티, 트레이닝 팬츠',
      summary: '가장 친해진 뒤에야 보여주는 채린의 하얀 방에서, 편한 차림으로 보내는 주말 낮',
      sampleLine: '뭐 봐? 아, 저 선반…. 됐어, 다 봤으니까 어쩔 수 없지. 귀엽긴 하잖아.',
    },
  ],
  dohyun: [
    {
      title: '도서관에서',
      place: '도서관',
      outfit: '후드티',
      summary: '공부 중인 도현과 각자의 시간을 보내는 조용한 통화.',
      sampleLine: '아, 이 부분 왜 이렇게 안 읽히냐.',
    },
    {
      title: '나 알바 중인데',
      place: '편의점',
      outfit: '편의점 유니폼 조끼, 검은 반팔',
      summary: '편의점에서 일하는 도현에게 걸려 온 익숙한 영상통화.',
      sampleLine: '이거 새로 들어온 건데 맛있으려나.',
    },
    {
      title: '커피 한 잔',
      place: '카페',
      outfit: '아이보리 니트, 사복',
      summary: '카페에서 노트북을 사용하는 도현과 각자의 할 일을 하는 시간.',
      sampleLine: '여기 케이크 맛있어 보이는데. 하나 시킬까.',
    },
    {
      title: '한 판만 더',
      place: 'PC방',
      outfit: '검은 후드집업, 게이밍 헤드셋',
      summary: '게임 중인 도현과 각자의 시간을 보내는 영상통화.',
      sampleLine: '아니, 방금 그건 좀 억울한데. …라면이나 시킬까.',
    },
    {
      title: '서도현의 방',
      place: '서도현의 방',
      outfit: '편안한 잠옷',
      summary: '편한 옷을 입고 자신의 방에서 노트북을 하는 도현의 일상.',
      sampleLine: '아, 뒤에 침대 있으니까 자꾸 눕고 싶다.',
    },
  ],
}

/** EP.N opens at affinity Lv.N (the order of the list). */
export function sampleMateWorlds(
  mateId: string,
  art: { background?: string; outfit?: string } = {},
): MateWorldContent[] {
  return (WORLDS[mateId] ?? []).map(({ appArt, ...world }, index) => ({
    episode: index + 1,
    ...world,
    ...(appArt && art.outfit ? { outfitPreviewUrl: art.outfit } : {}),
    ...(appArt && art.background ? { backgroundUrl: art.background } : {}),
  }))
}
