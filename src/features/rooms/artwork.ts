import classroomBackground from '@/assets/scenes/classroom-background-v1.webp'
import classroomSubject from '@/assets/scenes/classroom-subject-v1.webp'
import nightBackground from '@/assets/scenes/night-background-v1.webp'
import nightSubject from '@/assets/scenes/night-subject-v1.webp'
import catBackground from '@/assets/scenes/cat-background-v1.webp'
import catSubject from '@/assets/scenes/cat-subject-v1.webp'

export type RoomArtwork = {
  background: string
  subject: string
  title: string
  subtitle: string
  mood: string
  tone: string
}
/** Separate image layers and live text; layout variants belong in scenes.css. */
export const roomArtwork: Record<string, RoomArtwork> = {
  'dawn-library': {
    background: classroomBackground,
    subject: classroomSubject,
    title: '방과 후,\n너와 나',
    subtitle: 'AFTER SCHOOL',
    mood: '설레는 교실',
    tone: 'classroom',
  },
  'room-2': {
    background: nightBackground,
    subject: nightSubject,
    title: '전교 1등을\n이겨라',
    subtitle: 'MIDNIGHT CHALLENGE',
    mood: '몰입하는 밤',
    tone: 'night',
  },
  'room-3': {
    background: catBackground,
    subject: catSubject,
    title: '느긋하게,\n냥냥 독서실',
    subtitle: 'A COZY AFTERNOON',
    mood: '포근한 힐링',
    tone: 'cat',
  },
}
export const characterRoom: Record<string, string> = {
  chaerin: 'dawn-library',
  sua: 'dawn-library',
  dahee: 'dawn-library',
  doyun: 'room-2',
  moru: 'room-3',
}
export function getRoomArtwork(roomId: string) {
  return roomArtwork[roomId] ?? roomArtwork['dawn-library']!
}
