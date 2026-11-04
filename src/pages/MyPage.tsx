import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { PageHeading } from '@/shared/ui/PageHeading'
import { ButtonLink } from '@/shared/ui/Button'
import { safeReturnPath } from '@/shared/lib/format'
import { ProfileEditor } from '@/features/profile/components/ProfileEditor'
import { ScheduleManager } from '@/features/schedule/components/ScheduleManager'
import { Tabs } from '@/shared/ui/Tabs'
import '@/features/profile/mypage.css'

const views = [
  { id: 'profile', label: '프로필·아바타', icon: 'user', controls: 'mypage-profile-panel' },
  { id: 'schedule', label: '달력·일정', icon: 'calendar', controls: 'mypage-schedule-panel' },
] as const

export default function MyPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const view = location.hash === '#schedule' || params.get('add') === '1' ? 'schedule' : 'profile'
  const next = safeReturnPath(params.get('next'), '')
  return (
    <>
      <div className="mypage-heading">
        <PageHeading title="마이페이지" eyebrow={null} />
        <Tabs
          label="마이페이지 보기"
          options={views}
          value={view}
          iconOnly
          onChange={(value) => navigate({ pathname: location.pathname, search: location.search, hash: value === 'schedule' ? '#schedule' : '' }, { replace: true, preventScrollReset: true })}
        />
      </div>
      <div className="mypage-content">
        <div id="mypage-profile-panel" hidden={view !== 'profile'}>
          <ProfileEditor />
        </div>
        <div id="mypage-schedule-panel" hidden={view !== 'schedule'}>
          <ScheduleManager />
        </div>
        {next && !next.startsWith('/mypage') && (
          <div className="flex justify-end">
            <ButtonLink to={next} variant="secondary" size="md">
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
