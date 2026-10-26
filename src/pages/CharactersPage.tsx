import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeading } from '@/shared/ui/PageHeading'

export default function CharactersPage() {
  return (
    <>
      <PageHeading title="캐릭터">같이 공부한 시간이 우리 사이의 이야기가 돼요.</PageHeading>
      <EmptyState title="아직 함께 공부한 친구가 없어요">
        스터디룸에서 만난 친구와의 관계와 이야기가 여기에 모여요. 관계 기능은 준비 중이에요.
      </EmptyState>
    </>
  )
}
