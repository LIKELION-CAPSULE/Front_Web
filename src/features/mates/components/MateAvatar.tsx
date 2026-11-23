import { Avatar } from '@/shared/ui/Avatar'
import { mateAvatar } from '../artwork'

export function MateAvatar({ mateId, src }: { mateId: string; src?: string }) {
  const image = mateAvatar(mateId, src)
  return <Avatar>{image ? <img src={image} width={512} height={512} alt="" className="size-full object-cover object-[50%_38%]" /> : <span />}</Avatar>
}
