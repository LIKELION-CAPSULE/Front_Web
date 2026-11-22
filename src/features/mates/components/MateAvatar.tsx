import { Avatar } from '@/shared/ui/Avatar'
import { matePortrait } from '../artwork'

export function MateAvatar({ mateId, src }: { mateId: string; src?: string }) {
  const image = matePortrait(mateId, src)
  return <Avatar>{image ? <img src={image} alt="" className="size-full object-cover object-[50%_38%]" /> : <span />}</Avatar>
}
