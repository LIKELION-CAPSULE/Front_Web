import classroomSeatedBackground from '@/assets/scenes/seated-v1/classroom-seated-background-v1.webp'
import nightSeatedBackground from '@/assets/scenes/seated-v1/night-seated-background-v1.webp'
import catSeatedBackground from '@/assets/scenes/seated-v1/cat-seated-background-v1.webp'
import lanternSeatedBackground from '@/assets/scenes/seated-v1/lantern-seated-background-v1.webp'
import fantasySeatedBackground from '@/assets/scenes/seated-v1/fantasy-seated-background-v1.webp'
import iljinSeatedBackground from '@/assets/scenes/seated-v1/iljin-seated-background-v1.webp'
import jurassicSeatedBackground from '@/assets/scenes/seated-v1/jurassic-seated-background-v1.webp'
import labSeatedBackground from '@/assets/scenes/seated-v1/lab-seated-background-v1.webp'
import joseonSeatedBackground from '@/assets/scenes/seated-v1/joseon-seated-background-v1.webp'
import classroomBackground from '@/assets/scenes/classroom-background-v1.webp'
import classroomSubject from '@/assets/scenes/layered-v2/classroom-fullbody-v3.webp'
import nightBackground from '@/assets/scenes/night-background-v1.webp'
import nightSubject from '@/assets/scenes/layered-v2/night-fullbody-v2.webp'
import catBackground from '@/assets/scenes/cat-background-v1.webp'
import catSubject from '@/assets/scenes/layered-v2/cat-fullbody-v2.webp'
import lanternBackground from '@/assets/scenes/lantern-background-v1.webp'
import lanternSubject from '@/assets/scenes/layered-v2/lantern-fullbody-v2.webp'
import fantasyBackground from '@/assets/scenes/fantasy-background-v1.webp'
import fantasySubject from '@/assets/scenes/layered-v2/fantasy-fullbody-v2.webp'
import iljinBackground from '@/assets/scenes/iljin-background-v1.webp'
import iljinSubject from '@/assets/scenes/layered-v2/iljin-fullbody-v3.webp'
import jurassicBackground from '@/assets/scenes/jurassic-background-v1.webp'
import jurassicSubject from '@/assets/scenes/layered-v2/jurassic-fullbody-v2.webp'
import labBackground from '@/assets/scenes/lab-background-v1.webp'
import labSubject from '@/assets/scenes/layered-v2/lab-fullbody-v2.webp'
import joseonBackground from '@/assets/scenes/joseon-background-v1.webp'
import joseonSubject from '@/assets/scenes/layered-v2/joseon-fullbody-v2.webp'
import lightDesk from '@/assets/scenes/layered-v2/desk-light-v1.webp'
import darkDesk from '@/assets/scenes/layered-v2/desk-dark-v1.webp'
import workshopDesk from '@/assets/scenes/layered-v2/desk-workshop-v1.webp'
import classroomTitle from '@/assets/room-titles/classroom-title-v3-trimmed.webp'
import nightTitle from '@/assets/room-titles/night-title-v1-compact-trimmed.webp'
import catTitle from '@/assets/room-titles/cat-title-v1-trimmed.webp'
import lanternTitle from '@/assets/room-titles/lantern-title-v1-trimmed.webp'
import fantasyTitle from '@/assets/room-titles/fantasy-title-v1-trimmed.webp'
import iljinTitle from '@/assets/room-titles/iljin-title-v1-trimmed.webp'
import jurassicTitle from '@/assets/room-titles/jurassic-title-v1-trimmed.webp'
import labTitle from '@/assets/room-titles/lab-title-v1-trimmed.webp'
import joseonTitle from '@/assets/room-titles/joseon-title-v1-trimmed.webp'
import { studyRooms } from './data/rooms'
import type { SceneComposition } from './composition'

export type RoomArtwork = SceneComposition & {
  background: string
  seatedBackground: string
  subject: string
  desk: string
  title: string
  titleImage: string
  titleImageSize: readonly [number, number]
  subtitle: string
  mood: string
  tone: string
}
const desks = {
  light: { desk: lightDesk, deskSurface: 209 / 724 },
  dark: { desk: darkDesk, deskSurface: 317 / 724 },
  workshop: { desk: workshopDesk, deskSurface: 284 / 724 },
}
const group = { width: 0.96, center: 0.5, maxHeight: 1.3 }
const single = { width: 0.6, center: 0.65, maxHeight: 1.3 }
// Match the single-person scene's visual height; groups need more width to keep that scale.
const seatedGroup = { width: 1.3, center: 0.52, maxHeight: 0.86 }
const seatedSingle = { width: 0.6, center: 0.69, maxHeight: 0.84 }
export type SceneId =
  'classroom' | 'night' | 'cat' | 'lantern' | 'fantasy' | 'iljin' | 'jurassic' | 'lab' | 'joseon'

/** Nine source posters, with independent environment, foreground and transparent title. */
export const sceneArtwork: Record<SceneId, RoomArtwork> = {
  classroom: {
    background: classroomBackground,
    seatedBackground: classroomSeatedBackground,
    subject: classroomSubject,
    subjectSize: [1536, 1024],
    subjectLayout: { ...group, anchor: 0.46 },
    seatedLayout: { ...seatedGroup, anchor: 997 / 1024 },
    ...desks.light,
    title: '쌀쌀맞은 갸루짝꿍이\n나에게만\n친절하다!',
    titleImage: classroomTitle,
    titleImageSize: [1482, 852],
    subtitle: 'AFTER SCHOOL',
    mood: '설레는 교실',
    tone: 'classroom',
  },
  night: {
    background: nightBackground,
    seatedBackground: nightSeatedBackground,
    subject: nightSubject,
    subjectSize: [1024, 1536],
    subjectLayout: { ...single, anchor: 0.46 },
    seatedLayout: { ...seatedSingle, anchor: 1510 / 1536 },
    ...desks.dark,
    title: '전교 1등을\n이겨라',
    titleImage: nightTitle,
    titleImageSize: [1462, 801],
    subtitle: 'MIDNIGHT CHALLENGE',
    mood: '몰입하는 밤',
    tone: 'night',
  },
  cat: {
    background: catBackground,
    seatedBackground: catSeatedBackground,
    subject: catSubject,
    subjectSize: [1536, 1024],
    subjectLayout: { width: 0.86, center: 0.55, maxHeight: 1.1, anchor: 0.9 },
    // The cat's face rests at paw level; keep it just above the crop.
    seatedLayout: { width: 0.94, center: 0.56, maxHeight: 0.84, anchor: 949 / 1024, bottom: 0.99 },
    // A low-lying face needs room above the welcome message, unlike upright figures.
    welcomeLayout: { width: 0.76, center: 0.65, maxHeight: 0.58, bottom: 0.69 },
    ...desks.light,
    title: '냥냥이가 날\n그렇게 쳐다보면\n집중할 수가 없잖아!!',
    titleImage: catTitle,
    titleImageSize: [1462, 809],
    subtitle: 'A COZY AFTERNOON',
    mood: '포근한 힐링',
    tone: 'cat',
  },
  lantern: {
    background: lanternBackground,
    seatedBackground: lanternSeatedBackground,
    subject: lanternSubject,
    subjectSize: [1536, 1024],
    subjectLayout: { ...group, anchor: 0.5 },
    seatedLayout: { ...seatedGroup, anchor: 1018 / 1024 },
    ...desks.dark,
    title: '김상병의 두근두근\n비밀연등',
    titleImage: lanternTitle,
    titleImageSize: [1782, 717],
    subtitle: 'SECRET STUDY NIGHT',
    mood: '다정한 야간 자습',
    tone: 'lantern',
  },
  fantasy: {
    background: fantasyBackground,
    seatedBackground: fantasySeatedBackground,
    subject: fantasySubject,
    subjectSize: [1536, 1024],
    subjectLayout: { ...group, anchor: 0.49 },
    seatedLayout: { ...seatedGroup, anchor: 985 / 1024 },
    ...desks.dark,
    title: '페보니우스\n마법학교',
    titleImage: fantasyTitle,
    titleImageSize: [1475, 797],
    subtitle: 'FENESIS ACADEMY',
    mood: '마법 같은 몰입',
    tone: 'fantasy',
  },
  iljin: {
    background: iljinBackground,
    seatedBackground: iljinSeatedBackground,
    subject: iljinSubject,
    subjectSize: [1024, 1536],
    subjectLayout: { ...single, anchor: 0.48 },
    seatedLayout: { ...seatedSingle, maxHeight: 0.94, anchor: 1430 / 1536 },
    ...desks.light,
    title: '모르는 일진이\n나한테 말을 건다',
    titleImage: iljinTitle,
    titleImageSize: [1666, 777],
    subtitle: 'AN UNEXPECTED STUDY MATE',
    mood: '뜻밖의 교실 친구',
    tone: 'iljin',
  },
  jurassic: {
    background: jurassicBackground,
    seatedBackground: jurassicSeatedBackground,
    subject: jurassicSubject,
    subjectSize: [1536, 1024],
    subjectLayout: { ...group, anchor: 0.6 },
    seatedLayout: { ...seatedGroup, anchor: 990 / 1024 },
    ...desks.light,
    title: '쥬라기\n독서실',
    titleImage: jurassicTitle,
    titleImageSize: [1568, 764],
    subtitle: 'JURASSIC READING ROOM',
    mood: '공룡과 포근한 공부',
    tone: 'jurassic',
  },
  lab: {
    background: labBackground,
    seatedBackground: labSeatedBackground,
    subject: labSubject,
    subjectSize: [1536, 1024],
    subjectLayout: { ...group, anchor: 0.62 },
    seatedLayout: { ...seatedGroup, width: 1.08, center: 0.5, anchor: 915 / 1024 },
    ...desks.workshop,
    title: '뚝딱뚝딱\n실험실',
    titleImage: labTitle,
    titleImageSize: [1616, 832],
    subtitle: 'LITTLE MAKERS LAB',
    mood: '호기심 가득한 작업실',
    tone: 'lab',
  },
  joseon: {
    background: joseonBackground,
    seatedBackground: joseonSeatedBackground,
    subject: joseonSubject,
    subjectSize: [1536, 1024],
    subjectLayout: { ...group, anchor: 0.54 },
    seatedLayout: { ...seatedGroup, anchor: 996 / 1024 },
    ...desks.dark,
    title: '조선시대\n야간 학습',
    titleImage: joseonTitle,
    titleImageSize: [1602, 854],
    subtitle: 'MOONLIT PALACE STUDY',
    mood: '달빛 아래 한 장',
    tone: 'joseon',
  },
}

/** Room IDs remain aliases; new scenes can also be passed directly to RoomArtwork. */
export const roomArtwork: Record<string, RoomArtwork> = {
  ...sceneArtwork,
  'dawn-library': sceneArtwork.classroom,
  'room-2': sceneArtwork.night,
  'room-3': sceneArtwork.cat,
}
export const characterRoom: Record<string, string> = Object.fromEntries(
  studyRooms.flatMap((room) => room.characters.map((character) => [character.id, room.id])),
)
export function getRoomArtwork(roomId: string) {
  return roomArtwork[roomId] ?? roomArtwork['dawn-library']!
}
