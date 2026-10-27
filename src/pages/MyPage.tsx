import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { PageHeading } from '@/shared/ui/PageHeading'
import { ButtonLink } from '@/shared/ui/Button'
import { safeReturnPath } from '@/shared/lib/format'
import { ProfileEditor } from '@/features/profile/components/ProfileEditor'
import { ScheduleManager } from '@/features/schedule/components/ScheduleManager'
import '@/features/profile/mypage.css'

export default function MyPage() {
  const [params] = useSearchParams()
  const { hash } = useLocation()
  useEffect(() => {
    if (hash !== '#schedule') return
    const frame = requestAnimationFrame(() => document.getElementById('schedule')?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [hash])
  const next = safeReturnPath(params.get('next'), '')
  return (
    <>
      <PageHeading title="마이페이지" eyebrow={null} />
      <div className="mypage-content">
        <ProfileEditor />
        <ScheduleManager />
        {next && !next.startsWith('/mypage') && (
          <div className="flex justify-end">
            <ButtonLink to={next} variant="secondary" className="text-sm">
              {next.startsWith('/rooms/') && next.includes('/prepare')
                ? '공부 설정으로 돌아가기'
                : '이전 화면으로 돌아가기'}
            </ButtonLink>
          </div>
        )}
      </div>
    </>
  )
}
