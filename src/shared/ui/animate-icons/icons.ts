import { SearchIcon } from './search-icon'
import { HouseIcon } from './house-icon'
import { ChartColumnIcon } from './chart-column-icon'
import { HeartIcon } from './heart-icon'
import { ArrowRightIcon } from './arrow-right-icon'
import { ChevronRightIcon } from './chevron-right-icon'
import { ChevronsUpDownIcon } from './chevrons-up-down-icon'
import { BookmarkIcon } from './bookmark-icon'
import { BookOpenIcon } from './book-open-icon'
import { ClockIcon } from './clock-icon'
import { CalendarDaysIcon } from './calendar-days-icon'
import { SparklesIcon } from './sparkles-icon'
import { CoinsIcon } from './coins-icon'
import { PlayIcon } from './play-icon'
import { PauseIcon } from './pause-icon'
import { SquareIcon } from './square-icon'
import { ZoomInIcon } from './zoom-in-icon'
import { MessageCircleIcon } from './message-circle-icon'
import { GiftIcon } from './gift-icon'
import { HeadphonesIcon } from './headphones-icon'
import { CheckIcon } from './check-icon'
import { TriangleAlertIcon } from './triangle-alert-icon'
import { InfoIcon } from './info-icon'
import { EllipsisIcon } from './ellipsis-icon'
import { CircleQuestionMarkIcon } from './circle-question-mark-icon'
import { CameraIcon } from './camera-icon'
import { VideoIcon } from './video-icon'
import { VideoOffIcon } from './video-off-icon'
import { MicIcon } from './mic-icon'
import { MicOffIcon } from './mic-off-icon'
import { UserRoundIcon } from './user-round-icon'
import { SlidersHorizontalIcon } from './sliders-horizontal-icon'
import { MaximizeIcon } from './maximize-icon'
import { MinimizeIcon } from './minimize-icon'
import { MoonIcon } from './moon-icon'
import { CoffeeIcon } from './coffee-icon'
import { LockKeyholeIcon } from './lock-keyhole-icon'
import { XIcon } from './x-icon'
import { BanIcon } from './ban-icon'
import { DropletIcon } from './droplet-icon'
import { ImageIcon } from './image-icon'

export const animatedIcons = {
  search: SearchIcon,
  home: HouseIcon,
  chart: ChartColumnIcon,
  heart: HeartIcon,
  arrow: ArrowRightIcon,
  chevron: ChevronRightIcon,
  chevronsVertical: ChevronsUpDownIcon,
  bookmark: BookmarkIcon,
  book: BookOpenIcon,
  clock: ClockIcon,
  calendar: CalendarDaysIcon,
  sparkle: SparklesIcon,
  coin: CoinsIcon,
  play: PlayIcon,
  pause: PauseIcon,
  stop: SquareIcon,
  zoomIn: ZoomInIcon,
  chat: MessageCircleIcon,
  gift: GiftIcon,
  headphones: HeadphonesIcon,
  check: CheckIcon,
  warning: TriangleAlertIcon,
  info: InfoIcon,
  more: EllipsisIcon,
  help: CircleQuestionMarkIcon,
  camera: CameraIcon,
  video: VideoIcon,
  videoOff: VideoOffIcon,
  microphone: MicIcon,
  microphoneOff: MicOffIcon,
  user: UserRoundIcon,
  sliders: SlidersHorizontalIcon,
  expand: MaximizeIcon,
  shrink: MinimizeIcon,
  moon: MoonIcon,
  coffee: CoffeeIcon,
  lock: LockKeyholeIcon,
  close: XIcon,
  ban: BanIcon,
  droplet: DropletIcon,
  image: ImageIcon,
} as const

export type IconName = keyof typeof animatedIcons
