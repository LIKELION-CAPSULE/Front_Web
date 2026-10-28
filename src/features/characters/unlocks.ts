import type { StudyRecord } from '../demo/types.ts'

type Content = {
  kind: string
  name: string
  description: string
  opensAfterStudy?: boolean
  lockedDescription?: string
}

const contents: readonly Content[] = [
  { kind: '대사', name: '“내일도 와라”', description: '함께한 공부 시간', opensAfterStudy: true, lockedDescription: '함께 공부하면 열려요' },
  { kind: '모션', name: '손 흔들기', description: '첫 공부 완료', opensAfterStudy: true, lockedDescription: '첫 공부를 마치면 열려요' },
  { kind: '스토리', name: '1화 · 창가 자리', description: '다음 관계 단계에서 열림' },
  { kind: '보이스', name: '특별 응원 보이스', description: 'Lv.4에서 열림' },
  { kind: '배경', name: '밤 교실', description: '추후 공개' },
  { kind: '이벤트', name: '시험 기간 응원', description: '이벤트 기간에 열림' },
]

export function characterUnlocks(records: readonly StudyRecord[], characterId: string) {
  // The two introductory contents open when the first non-empty study is recorded.
  const firstStudyAt = records.reduce<number | null>((first, record) => {
    if (!record.characterIds.includes(characterId) || !Number.isFinite(record.studySeconds) ||
      record.studySeconds <= 0 || !Number.isFinite(record.endedAt)) return first
    return first === null ? record.endedAt : Math.min(first, record.endedAt)
  }, null)

  return contents.map((content) => {
    const unlockedAt = content.opensAfterStudy ? firstStudyAt : null
    return {
      kind: content.kind,
      name: content.name,
      unlockedAt,
      description: unlockedAt === null
        ? content.lockedDescription ?? content.description
        : content.description,
    }
  })
}
