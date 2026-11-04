import chaerin from '@/assets/reports/completion-v1/chaerin-completion-v1.webp'
import sua from '@/assets/reports/completion-v1/sua-completion-v1.webp'
import dahee from '@/assets/reports/completion-v1/dahee-completion-v1.webp'
import classroomBackground from '@/assets/reports/completion-layers-v3/classroom-completion-background-v3.webp'
import chaerinForeground from '@/assets/reports/completion-layers-v3/chaerin-completion-character-v3.webp'

export const completionArtwork: Record<string, { src: string; backgroundSrc?: string; foregroundSrc?: string; quote: string }> = {
  chaerin: { src: chaerin, backgroundSrc: classroomBackground, foregroundSrc: chaerinForeground, quote: '오늘 꽤 잘했네. 내일도 네 자리 비워 둘게.' },
  sua: { src: sua, quote: '오늘도 한 걸음 나아갔네. 같이해서 더 좋았어.' },
  dahee: { src: dahee, quote: '우리 오늘도 해냈다! 다음에도 같이 달려 보자.' },
}
