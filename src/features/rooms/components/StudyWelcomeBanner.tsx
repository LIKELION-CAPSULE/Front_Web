import { Button } from '@/shared/ui/Button'

export function StudyWelcomeBanner({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="flex min-h-[145px] flex-col justify-center gap-5 rounded-panel border border-dashed border-subtle/65 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div>
        <p className="text-sm leading-5 text-muted">처음이라면 여기서</p>
        <h1 className="mt-1.5 text-[22px] leading-[38px] font-bold sm:text-[26px]">
          조용히 같이 공부할 친구를 골라 볼까요?
        </h1>
      </div>
      <Button onClick={onExplore} className="shrink-0 sm:mr-9">추천 룸 보기</Button>
    </section>
  )
}
