import { EmptyState } from '@/shared/ui/EmptyState'

export default function NotFoundPage() {
  return (
    <EmptyState title="페이지를 찾을 수 없어요" headingLevel="h1">
      주소를 다시 확인하거나 홈에서 스터디룸을 둘러봐 주세요.
    </EmptyState>
  )
}
