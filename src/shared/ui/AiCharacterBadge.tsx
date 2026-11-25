import { cn } from '@/shared/lib/cn'
import './ai-character-badge.css'

/**
 * 「AI 캐릭터」 tag (principle: wherever an AI character is shown, it says so). One per block that shows a mate's face
 * or name, never twice in one block. Plain text, so screen readers read it with the name beside it.
 * `tone="overlay"`: over artwork (the login screen's look: dark glass); default: on a surface (the call screen's look).
 */
export function AiCharacterBadge({ tone = 'surface', className }: { tone?: 'surface' | 'overlay'; className?: string }) {
  return <span className={cn('ai-character-badge', className)} data-tone={tone}>AI 캐릭터</span>
}
