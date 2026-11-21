import type { ReactNode } from 'react'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'

export function DummyNotice({ children }: { children: ReactNode }) {
  return <FeedbackMessage className="my-3" tone="info"><strong>더미 데이터 · </strong>{children}</FeedbackMessage>
}
