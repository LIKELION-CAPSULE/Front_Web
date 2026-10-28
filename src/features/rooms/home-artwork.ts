import classroomSubject from '@/assets/scenes/home-v2/classroom-home-subject-v2.webp'
import nightSubject from '@/assets/scenes/home-v2/night-home-subject-v2.webp'
import { getRoomArtwork, type RoomArtwork } from './artwork'

// Home cards have independent character images; other screens use the original artwork.
const homeSubjects: Partial<Record<string, Pick<RoomArtwork, 'subject' | 'subjectSize'>>> = {
  classroom: { subject: classroomSubject, subjectSize: [1536, 1024] },
  night: { subject: nightSubject, subjectSize: [1024, 1536] },
}

export function getHomeRoomArtwork(roomId: string): RoomArtwork {
  const art = getRoomArtwork(roomId)
  const subject = homeSubjects[art.tone]
  return subject ? { ...art, ...subject } : art
}
