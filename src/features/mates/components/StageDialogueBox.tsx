import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/shared/lib/cn'
import { PixelRoofStrip } from '@/shared/ui/pixel/PixelFrame'
import '../call-dialogue.css'

/**
 * Shared C1 pixel dialogue frame (call stage, login stage, connection record).
 * Renders the stepped pixel frame, dithered roof strip with pixel capsule, and top-left name tab.
 */
export function StageDialogueBox({
  name,
  nameExtras,
  children,
  footer,
  passive = false,
  hideTextFromSR = false,
  className,
  boxRef,
  ...rest
}: {
  name: ReactNode
  nameExtras?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Passive single-line dialogue (no click-to-advance or arrow): default cursor and balanced padding. */
  passive?: boolean
  /** Marks visual text/name as aria-hidden when an external live region announces the line. */
  hideTextFromSR?: boolean
  className?: string
  boxRef?: Ref<HTMLDivElement>
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div
      ref={boxRef}
      className={cn('call-dialogue', passive && 'call-dialogue--passive', className)}
      {...rest}
    >
      <span className="call-dialogue-frame" aria-hidden="true"><PixelRoofStrip /></span>
      <span className="call-dialogue-name" aria-hidden={hideTextFromSR || undefined}>
        {name}
        {nameExtras}
      </span>
      <p className="call-dialogue-text" aria-hidden={hideTextFromSR || undefined}>
        {children}
      </p>
      {footer}
    </div>
  )
}
