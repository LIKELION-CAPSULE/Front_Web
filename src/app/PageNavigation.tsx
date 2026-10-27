import { useEffect } from 'react'
import { useLocation } from 'react-router'

const titles: Record<string, string> = {
  '/': '같이 하는 공부',
  '/records': '내 공부 기록',
  '/characters': '캐릭터',
  '/credits': '내 크레딧',
  '/credits/charge': '크레딧 충전 · 패스',
  '/login': '같이 공부할 친구가 기다리고 있어요',
  '/onboarding': '내 아바타 만들기',
  '/mypage': '마이페이지',
}

/** Mount within the layout so a lazy page has committed before moving focus. */
export function PageNavigation() {
  const { pathname } = useLocation()

  useEffect(() => {
    const fallback = pathname.startsWith('/rooms/')
      ? '스터디룸'
      : pathname.startsWith('/study/')
        ? '함께 공부하기'
        : pathname.startsWith('/reports/')
          ? '오늘의 캡슐'
          : pathname.startsWith('/capsules/')
            ? '캡슐 카드'
            : pathname.startsWith('/characters/')
              ? '캐릭터 관계'
              : '페이지 찾기'
    document.title = `CAPSULE · ${titles[pathname] ?? fallback}`
    window.scrollTo(0, 0)
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])

  return null
}
