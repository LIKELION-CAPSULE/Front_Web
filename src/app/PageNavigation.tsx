import { useEffect } from 'react'
import { useLocation } from 'react-router'

const titles: Record<string, string> = {
  '/': '같이 하는 공부',
  '/records': '내 공부 기록',
  '/characters': '캐릭터',
  '/credits': '내 크레딧',
}

/** Mount within the layout so a lazy page has committed before moving focus. */
export function PageNavigation() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = `CAPSULE · ${titles[pathname] ?? (pathname.startsWith('/rooms/') ? '스터디룸' : '페이지 찾기')}`
    window.scrollTo(0, 0)
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])

  return null
}
