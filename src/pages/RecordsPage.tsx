import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeading } from '@/shared/ui/PageHeading'

export default function RecordsPage() {
  return (
    <>
      <PageHeading title="내 공부 기록">함께한 공부가 하루하루 쌓이는 곳이에요.</PageHeading>
      <EmptyState title="첫 공부 기록을 기다리고 있어요">
        공부를 마치면 이곳에서 함께한 시간과 집중 기록을 볼 수 있어요. 기록 기능은 준비 중이에요.
      </EmptyState>
    </>
  )
}
