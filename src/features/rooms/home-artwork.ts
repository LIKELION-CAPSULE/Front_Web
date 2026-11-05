import classroomSubject from '@/assets/scenes/home-v2/classroom-home-subject-v2.webp'
import nightSubject from '@/assets/scenes/home-v2/night-home-subject-v2.webp'
import malfoySubject from '@/assets/characters/malfoy-ts-v1/web/malfoy-ts-home-subject-v1.webp'
import hogwartsBackground from '@/assets/characters/malfoy-ts-v1/web/hogwarts-night-seated-background-v1.webp'
import hogwartsTitle from '@/assets/characters/malfoy-ts-v1/web/hogwarts-night-title-v1-trimmed.webp'
import { getRoomArtwork, type RoomArtwork } from './artwork'
import { getRoomAssetId } from './room-asset-id'

// Home cards have independent character images; other screens use the original artwork.
const homeSubjects: Partial<Record<string, Pick<RoomArtwork, 'subject' | 'subjectSize'>>> = {
  classroom: { subject: classroomSubject, subjectSize: [1536, 1024] },
  night: { subject: nightSubject, subjectSize: [1024, 1536] },
}

/** Home-only layers; backend room IDs and detail images remain independent. */
export const homeRoomArtwork: Record<string, RoomArtwork> = {
  'hogwarts-night-library': {
    background: hogwartsBackground,
    seatedBackground: hogwartsBackground,
    subject: malfoySubject,
    subjectSize: [1024, 1536],
    subjectLayout: { width: 0.64, center: 0.68, anchor: 1510 / 1536, maxHeight: 0.92 },
    seatedLayout: { width: 0.64, center: 0.68, anchor: 1510 / 1536, maxHeight: 0.92 },
    title: '밤의 호그와트 도서관',
    titleImage: hogwartsTitle,
    titleImageSize: [1488, 1013],
    subtitle: '',
    mood: '',
    tone: 'hogwarts',
  },
}

export function findHomeRoomArtwork(roomId: string, name: string): RoomArtwork | undefined {
  return homeRoomArtwork[getRoomAssetId(roomId, name)]
}

export function getHomeRoomArtwork(roomId: string): RoomArtwork {
  const art = homeRoomArtwork[roomId] ?? getRoomArtwork(roomId)
  const subject = homeSubjects[art.tone]
  return subject ? { ...art, ...subject } : art
}
