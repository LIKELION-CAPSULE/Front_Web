import { EmptyState } from '@/shared/ui/EmptyState'

export default function MvpUnavailablePage() {
  return (
    <div className="page-container py-12">
      <EmptyState title="MVP 이후" headingLevel="h1">
        이 기능은 MVP 이후에 만나볼 수 있어요.
      </EmptyState>
    </div>
  )
}
