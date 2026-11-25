import { useEffect } from 'react'
import { useLocation } from 'react-router'

const titles: Record<string, string> = {
  '/': '홈',
  '/records': '내 기록',
  '/characters': '내 메이트',
  '/mates/me': '내 메이트',
  '/credits': '내 크레딧',
  '/credits/invite': '친구 초대',
  '/credits/charge': '친구 초대',
  '/login': '나만의 메이트가 기다리고 있어요',
  '/onboarding': '프로필 선택',
  '/password/reset': '비밀번호 재설정',
  '/reset-password': '비밀번호 재설정',
  '/oauth/kakao': '카카오 로그인',
  '/login/kakao-terms': '약관 동의',
}

/** Mount inside the route Suspense boundary so the actual page is ready before moving focus. */
export function PageNavigation() {
  const { pathname } = useLocation()

  useEffect(() => {
    const fallback = pathname.startsWith('/rooms/') || pathname.startsWith('/mates/')
      ? '메이트'
      : pathname.startsWith('/study/') || pathname.startsWith('/connect/')
        ? '연결'
        : pathname.startsWith('/reports/') || pathname.startsWith('/connections/')
          ? '연결 기록'
          : pathname.startsWith('/capsules/')
            ? '연결 기록'
            : pathname.startsWith('/characters/')
              ? '내 메이트'
              : '페이지를 찾을 수 없어요'
    document.title = `CAPSULE · ${titles[pathname] ?? fallback}`
    window.scrollTo(0, 0)
    const focus = () => {
      const main = document.getElementById('main-content')
      if (!main || main.closest('[data-loading-screen]')) return false
      main.tabIndex = -1
      main.focus({ preventScroll: true })
      return true
    }
    if (focus()) return
    // Initial authentication can resolve after this route has committed its loading screen.
    const observer = new MutationObserver(() => { if (focus()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])

  return null
}
