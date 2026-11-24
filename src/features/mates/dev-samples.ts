/**
 * Development-only sample data for the my-mates page, loaded with a dynamic import behind `import.meta.env.DEV`
 * (MyMatesPage), so production bundles carry none of it.
 */
export { sampleRelation, sampleSecondsForStage, sampleUnlocks } from './mate-sample-data.ts'
export { generateDummyCapsules } from './capsule-jar/capsule-jar-dummy.ts'

/** Preview mates for `?mates=demo` (several mates): 채린's art with a tint and dummy capsules. */
export const PREVIEW_MATES = [
  { id: 'preview-mate-b', name: '시안 메이트 B', tint: 'hue-rotate(150deg) saturate(0.8)', seed: 21, count: 9 },
  { id: 'preview-mate-c', name: '시안 메이트 C', tint: 'hue-rotate(260deg) saturate(0.9)', seed: 33, count: 22 },
] as const
