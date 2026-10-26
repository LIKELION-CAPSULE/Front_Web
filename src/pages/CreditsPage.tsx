import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeading } from '@/shared/ui/PageHeading'

export default function CreditsPage() {
  return (
    <>
      <PageHeading title="내 크레딧">공부는 무료로, 더 깊은 대화는 원하는 만큼.</PageHeading>
      <EmptyState title="크레딧 기능을 준비하고 있어요">
        충전과 사용 내역은 서비스가 준비되면 확인할 수 있어요.
      </EmptyState>
    </>
  )
}
