import type { SkeletonScreen } from '../../shared/lib/loading-screen.ts'
import { WITHDRAWAL_CONFIRMATION } from '../auth/withdrawal-confirmation.ts'
import type { FocusTotals } from '../demo/types.ts'

export type ReviewStep =
  | { click: string; selector?: string; includes?: boolean }
  | { fill: string; value: string }
  | { wait: string }

export type ReviewScenario = {
  id: string
  title: string
  group: string
  path: string
  note: string
  guest?: boolean
  onboarding?: boolean
  empty?: boolean
  returning?: boolean
  session?: 'recover' | 'study' | 'unknown'
  reports?: number[]
  cameraFocus?: FocusTotals
  /** Explicit mock of the missing beta account contract. Never enabled by the production entry point. */
  accountContract?: boolean
  /** Explicit mock of the missing mate detail/reset contracts. */
  mateContract?: boolean
  /** Explicit confirmed-message fixtures for reset cache verification. */
  mateHistory?: boolean
  /** Optional dedicated farewell line for connection leave dialog review. */
  farewellLine?: string
  fault?: string
  loading?: SkeletonScreen | 'auth' | 'credits' | 'invite' | 'my-mates' | 'records'
  loginNext?: string
  /** A Kakao sign-up ticket in the preview's session storage (the consent screen's entry): live, or already expired. */
  kakaoSignup?: 'active' | 'expired'
  steps?: ReviewStep[]
  /** Modal/popup design draft (dialog-design/). Renders over the real page; never part of the product. */
  dialogDesign?: 'a' | 'b' | 'c' | 'b2' | 'b3'
}

const click = (text: string): ReviewStep => ({ click: text })
const fill = (selector: string, value: string): ReviewStep => ({ fill: selector, value })
const fillBirthDate = (value: string): ReviewStep[] => {
  const [y = '', m = '', d = ''] = value.split('-')
  return [fill('input[name="birthYear"]', y), fill('input[name="birthMonth"]', m), fill('input[name="birthDay"]', d)]
}
const login = [fill('input[name="email"]', 'review@example.invalid'), fill('input[name="password"]', 'Review-only-2026!'), click('로그인')]
const signup = [fill('input[name="email"]', 'review@example.invalid'), fill('input[name="password"]', 'Review-only-2026!'), fill('input[name="confirmPassword"]', 'Review-only-2026!'), fill('input[name="nickname"]', '문구 검토'), ...fillBirthDate('2000-01-01'), { click: '', selector: 'input[name="agreeTerms"]' }, { click: '', selector: 'input[name="agreePrivacy"]' }, click('회원가입'), { wait: '이메일 인증' }] satisfies ReviewStep[]
const account = [click('계정 설정 열기')] satisfies ReviewStep[]
const security = [...account, click('보안')] satisfies ReviewStep[]
// The withdrawal confirmation is open from the start on the security tab (no button to unfold it).
const withdraw = [...security, fill('input[name="withdrawalConfirmation"]', WITHDRAWAL_CONFIRMATION)] satisfies ReviewStep[]
const resetMenu = [click('채린 메뉴'), click('대화 초기화')] satisfies ReviewStep[]
const passwordRequest = [...security, fill('input[name="email"]', 'review@example.invalid'), click('재설정 링크 받기')] satisfies ReviewStep[]

export const reviewScenarios: ReviewScenario[] = [
  { id: 'welcome', group: '로그인·가입', title: '로그인 시작', path: '/login', guest: true, note: '카카오·이메일 선택. 동의 화면 경로(KAKAO_SIGNUP_CONSENT_SCREEN=true)라 카카오 버튼 아래 약관 고지 없음' },
  { id: 'welcome-kakao-notice', group: '로그인·가입', title: '로그인 시작 · 약관 고지(현재 운영)', path: '/login', guest: true, fault: 'kakao-consent-off', note: 'KAKAO_SIGNUP_CONSENT_SCREEN=false(백엔드 a′ 배포 전, 지금 운영): 「시작하면 [이용약관]과 [개인정보 처리방침]에 동의해요.」 고지' },
  { id: 'login', group: '로그인·가입', title: '이메일 로그인', path: '/login?mode=login', guest: true, note: '기본 입력·비밀번호 찾기' },
  { id: 'login-doze', group: '로그인·가입', title: '로그인 · 졸고 있는 채린', path: '/login', guest: true, note: '노트북 앞에서 꾸벅꾸벅 조는 채린(큰 Z, 「채린이를 톡 눌러서 깨워 봐」 안내). 다가가거나 누르거나 키를 누르면, 또는 10초 뒤 스스로 깸' },
  { id: 'login-doze-awake', group: '로그인·가입', title: '로그인 · 깬 채린', path: '/login?doze=awake', guest: true, note: '깨어나 웃으며 「앗, 왔어? 기다리고 있었어.」라고 인사한 상태(다시 보기 버튼 포함). Live2D가 있으면 커서를 따라봄' },
  { id: 'login-doze-static', group: '로그인·가입', title: '로그인 · 정지 이미지 경로', path: '/login?static=1', guest: true, note: 'Live2D 없이 조는 모습 → 하품 → 웃음 정지 이미지 크로스페이드. 운영(로그인 메이트 API 전)과 움직임 줄이기에서 보이는 화면' },
  { id: 'login-error', group: '로그인·가입', title: '로그인 실패', path: '/login?mode=login', guest: true, fault: 'login', steps: login, note: '잘못된 인증정보 안내' },
  { id: 'login-locked', group: '로그인·가입', title: '로그인 잠금', path: '/login?mode=login', guest: true, fault: 'locked', steps: login, note: '반복 실패·5분 뒤 재시도' },
  { id: 'signup', group: '로그인·가입', title: '회원가입', path: '/login?mode=signup', guest: true, note: '입력 항목·필수 약관 동의' },
  { id: 'signup-errors', group: '로그인·가입', title: '가입 입력 오류', path: '/login?mode=signup', guest: true, steps: [click('회원가입')], note: '필수 입력·약관 누락 문구' },
  { id: 'verification', group: '로그인·가입', title: '이메일 인증', path: '/login?mode=signup', guest: true, accountContract: true, steps: signup, note: '신규 계정 계약 모의 포트: 인증번호·남은 시간·재전송' },
  { id: 'verification-expired', group: '로그인·가입', title: '인증 시간 만료', path: '/login?mode=signup', guest: true, accountContract: true, fault: 'verification-expired', steps: signup, note: '신규 계정 계약 모의 포트: 1초 뒤 만료 안내 표시' },
  { id: 'verification-wrong', group: '로그인·가입', title: '인증번호 오류', path: '/login?mode=signup', guest: true, accountContract: true, fault: 'verification', steps: [...signup, fill('input[autocomplete="one-time-code"]', '001234'), click('인증하고 가입하기')], note: '신규 계정 계약 모의 포트: 잘못된 코드·입력 유지' },
  { id: 'signup-underage', group: '로그인·가입', title: '가입 · 만 14세 미만', path: '/login?mode=signup', guest: true, steps: [...signup.slice(0, -2), ...fillBirthDate('2020-01-01'), click('회원가입')], note: '문서의 연령 오류 문구·서버 요청 없음' },
  { id: 'terms', group: '로그인·가입', title: '이용약관', path: '/login?mode=signup', guest: true, steps: [click('이용약관 보기')], note: '실제 저장된 약관 전문과 모달(회원가입의 보기)' },
  { id: 'privacy', group: '로그인·가입', title: '개인정보 처리방침', path: '/login?mode=signup', guest: true, steps: [click('개인정보 처리방침 보기')], note: '실제 저장된 개인정보 처리방침 전문(회원가입의 보기)' },
  { id: 'reset-request', group: '비밀번호·카카오', title: '비밀번호 찾기', path: '/login?mode=forgot-password', guest: true, note: '메일 요청 입력 화면' },
  { id: 'reset-requested', group: '비밀번호·카카오', title: '재설정 메일 접수', path: '/login?mode=forgot-password', guest: true, steps: [fill('input[name="email"]', 'review@example.invalid'), click('재설정 링크 받기')], note: '가상 202·메일 발송 없이 접수 안내' },
  { id: 'reset-form', group: '비밀번호·카카오', title: '새 비밀번호', path: '/password/reset?token=review-reset', guest: true, note: '유효한 가상 링크·비밀번호 확인' },
  { id: 'reset-missing', group: '비밀번호·카카오', title: '재설정 링크 없음', path: '/password/reset', guest: true, note: '누락 링크·다시 받기' },
  { id: 'reset-invalid', group: '비밀번호·카카오', title: '만료된 재설정 링크', path: '/password/reset?token=review-reset', guest: true, fault: 'reset', steps: [fill('input[name="password"]', 'Review-new-2026!'), fill('input[name="confirmPassword"]', 'Review-new-2026!'), click('비밀번호 변경하기')], note: '서버가 토큰을 거절한 경우' },
  { id: 'reset-done', group: '비밀번호·카카오', title: '비밀번호 변경 완료', path: '/password/reset?token=review-reset', guest: true, steps: [fill('input[name="password"]', 'Review-new-2026!'), fill('input[name="confirmPassword"]', 'Review-new-2026!'), click('비밀번호 변경하기')], note: '변경 성공 안내·로그인 버튼으로 직접 이동' },
  { id: 'kakao-loading', group: '비밀번호·카카오', title: '카카오 처리 중', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, fault: 'kakao-pending', loading: 'auth', note: '인증 결과 확인 전: 로고·공통 로딩' },
  { id: 'kakao-onboarding-loading', group: '비밀번호·카카오', title: '카카오 · 프로필 선택 로딩', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, onboarding: true, fault: 'avatars-pending', loading: 'onboarding', note: '프로필 설정이 필요한 계정: 아바타 데이터 대기' },
  { id: 'kakao-home-loading', group: '비밀번호·카카오', title: '카카오 · 홈 로딩', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, fault: 'home-pending', loading: 'home', note: '프로필 설정 완료 계정: 홈 데이터 대기' },
  { id: 'kakao-account-loading', group: '비밀번호·카카오', title: '카카오 · 계정 설정 로딩', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, fault: 'home-pending', loading: 'home', loginNext: '/?account=profile', note: '계정 설정을 열기 전 홈 배경의 데이터를 기다리는 경우' },
  { id: 'kakao-new', group: '비밀번호·카카오', title: '카카오 · 프로필 설정으로 이동', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, onboarding: true, note: '공통 로딩 → 프로필 선택 스켈레톤 → 프로필 선택' },
  { id: 'kakao-home', group: '비밀번호·카카오', title: '카카오 · 홈으로 이동', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, note: '공통 로딩 → 홈 스켈레톤 → 홈' },
  { id: 'kakao-return', group: '비밀번호·카카오', title: '카카오 · 계정 설정으로 이동', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, loginNext: '/?account=profile', note: '공통 로딩 → 홈 스켈레톤 → 홈 위의 계정 설정 창' },
  { id: 'beta-waitlist', group: '비밀번호·카카오', title: '정원 초과 · 출시 알림 신청', path: '/login?mode=waitlist', guest: true, note: '4 · 6의 403 BETA_FULL 뒤 화면: 이메일 입력 → 45' },
  { id: 'beta-waitlist-done', group: '비밀번호·카카오', title: '정원 초과 · 신청 완료', path: '/login?mode=waitlist', guest: true, steps: [fill('input[name="email"]', 'review@example.invalid'), click('출시 알림 받기')], note: '45 204(이미 신청한 이메일도 같음) 뒤 안내' },
  { id: 'beta-waitlist-invalid', group: '비밀번호·카카오', title: '정원 초과 · 잘못된 이메일', path: '/login?mode=waitlist', guest: true, steps: [fill('input[name="email"]', 'review@'), click('출시 알림 받기')], note: '이메일 형식 오류(45 400 INVALID_EMAIL과 같은 문구)' },
  { id: 'kakao-beta-full', group: '비밀번호·카카오', title: '카카오 · 정원 초과', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, fault: 'beta-full', note: '6의 403 BETA_FULL → 출시 알림 신청 화면' },
  { id: 'kakao-signup-required', group: '비밀번호·카카오', title: '카카오 첫 가입 · 동의 화면으로', path: '/oauth/kakao?code=new-review&state=review-state', guest: true, note: '6의 403 KAKAO_SIGNUP_REQUIRED → 가입 확인값은 이 탭 세션에만 두고 /login/kakao-terms로 이동' },
  { id: 'kakao-terms-consent', group: '비밀번호·카카오', title: '카카오 첫 가입 · 약관 동의', path: '/login/kakao-terms', guest: true, kakaoSignup: 'active', note: '초기 상태: 전체 동의·필수 2종 꺼짐, 「동의하고 시작하기」 비활성' },
  { id: 'kakao-terms-all', group: '비밀번호·카카오', title: '카카오 첫 가입 · 전체 동의', path: '/login/kakao-terms', guest: true, kakaoSignup: 'active', steps: [{ click: '', selector: 'input[aria-describedby$="-all-hint"]' }], note: '전체 동의로 필수 2종이 함께 켜지고 버튼 활성' },
  { id: 'kakao-terms-view', group: '비밀번호·카카오', title: '카카오 첫 가입 · 약관 보기', path: '/login/kakao-terms', guest: true, kakaoSignup: 'active', steps: [click('이용약관 보기')], note: '동의 화면의 보기 → 기존 약관 모달(동의할 그 버전의 본문)' },
  { id: 'kakao-terms-pending', group: '비밀번호·카카오', title: '카카오 첫 가입 · 처리 중', path: '/login/kakao-terms', guest: true, kakaoSignup: 'active', fault: 'kakao-signup-pending', steps: [{ click: '', selector: 'input[aria-describedby$="-all-hint"]' }, click('동의하고 시작하기')], note: '가입 요청 대기: 버튼 로딩·체크박스 잠금(중복 제출 없음)' },
  { id: 'kakao-terms-expired', group: '비밀번호·카카오', title: '카카오 첫 가입 · 시간 만료', path: '/login/kakao-terms', guest: true, kakaoSignup: 'expired', note: '가입 확인값 만료 → 안내와 「카카오로 다시 시작」' },
  { id: 'kakao-terms-invalid', group: '비밀번호·카카오', title: '카카오 첫 가입 · 확인 불가', path: '/login/kakao-terms', guest: true, kakaoSignup: 'active', fault: 'kakao-signup-invalid', steps: [{ click: '', selector: 'input[aria-describedby$="-all-hint"]' }, click('동의하고 시작하기')], note: '가입 단계의 401 SIGNUP_TOKEN_INVALID → 「카카오로 다시 시작」' },
  { id: 'kakao-terms-changed', group: '비밀번호·카카오', title: '카카오 첫 가입 · 약관 변경', path: '/login/kakao-terms', guest: true, kakaoSignup: 'active', fault: 'kakao-signup-terms', steps: [{ click: '', selector: 'input[aria-describedby$="-all-hint"]' }, click('동의하고 시작하기')], note: '가입 단계의 400 TERMS_NOT_AGREED → 약관을 다시 불러오고 동의를 처음부터' },
  { id: 'kakao-terms-beta-full', group: '비밀번호·카카오', title: '카카오 첫 가입 · 정원 초과', path: '/login/kakao-terms', guest: true, kakaoSignup: 'active', fault: 'beta-full', steps: [{ click: '', selector: 'input[aria-describedby$="-all-hint"]' }, click('동의하고 시작하기')], note: '가입 단계의 403 BETA_FULL → 출시 알림 신청 화면' },
  { id: 'kakao-failed', group: '비밀번호·카카오', title: '카카오 인증 실패', path: '/login?notice=kakao-expired', guest: true, note: '만료·사용된 코드 오류' },
  { id: 'kakao-cancelled', group: '비밀번호·카카오', title: '카카오 동의 취소', path: '/login?notice=kakao-cancelled', guest: true, note: '사용자가 동의를 취소한 경우' },
  { id: 'kakao-invalid', group: '비밀번호·카카오', title: '카카오 요청 확인 불가', path: '/login?notice=kakao-invalid-request', guest: true, note: '요청 상태·인가 코드 누락 안내' },
  { id: 'kakao-terms', group: '비밀번호·카카오', title: '카카오 필수 약관 누락', path: '/login?notice=kakao-terms-required', guest: true, note: '필수 동의 정보를 확인하지 못한 경우' },
  { id: 'kakao-error', group: '비밀번호·카카오', title: '카카오 로그인 오류', path: '/login?notice=kakao-failed', guest: true, note: '일반 로그인 실패 안내' },
  { id: 'onboarding', group: '온보딩·홈', title: '아바타 선택', path: '/onboarding', onboarding: true, note: '닉네임·아바타·기본 아바타 선택' },
  { id: 'onboarding-loading', group: '온보딩·홈', title: '프로필 선택 로딩', path: '/onboarding', onboarding: true, fault: 'avatars-pending', loading: 'onboarding', note: '계정 확인 후 아바타 데이터 대기' },
  { id: 'onboarding-beta', group: '온보딩·홈', title: '카카오 가입 · 생년월일', path: '/onboarding', onboarding: true, accountContract: true, note: '신규 계정 계약 모의 포트: 생년월일 입력·아바타 저장' },
  { id: 'email-onboarding', group: '온보딩·홈', title: '이메일 가입 · 아바타 선택', path: '/onboarding', onboarding: true, accountContract: true, note: '모의 포트에 가입 시 생년월일이 저장된 경우 재입력 없음' },
  { id: 'onboarding-error', group: '온보딩·홈', title: '온보딩 저장 실패', path: '/onboarding', onboarding: true, accountContract: true, fault: 'profile', steps: [...fillBirthDate('2000-01-01'), click('다음'), click('시작하기')], note: '신규 계정 계약 모의 포트: 저장 실패·입력 유지' },
  { id: 'home-first', group: '온보딩·홈', title: '홈 · 첫 방문', path: '/', note: '캡슐 메이트 탐색·서버 출시 메이트 목록' },
  { id: 'home-tutorial', group: '온보딩·홈', title: '홈 · 새 3단계 사용법', path: '/?tutorial=1', note: '최종 문서의 메이트 고르기·연결하기·연결 기록. 임의 대사와 미연동 기능 안내 없음' },
  { id: 'home-return', group: '온보딩·홈', title: '홈 · 재방문', path: '/', returning: true, note: '오늘 연결 시간·메이트 탐색' },
  { id: 'home-resume', group: '온보딩·홈', title: '홈 · 다시 연결', path: '/', session: 'recover', note: '진행 중인 연결이 있는 홈' },
  { id: 'home-empty', group: '온보딩·홈', title: '홈 · 메이트 없음', path: '/', empty: true, note: '서버 목록을 로컬 룸으로 채우지 않는 빈 상태' },
  { id: 'home-live2d-fallback', group: '온보딩·홈', title: '홈 · Live2D 대체 이미지', path: '/', note: '모델 없음 → 정적 포트레이트' },
  { id: 'home-lowpower', group: '온보딩·홈', title: '홈 · 저전력 정적 배경', path: '/', note: '저전력/WebGL2 미지원 → 정적 배경' },
  { id: 'mate-detail', group: '메이트·연결', title: '메이트 상세', path: '/mates/chaerin', note: '세계관·내 역할·인트로와 직접 연결' },
  { id: 'connection-entry', group: '메이트·연결', title: '연결 · 직접 방문', path: '/connect/chaerin', note: '주소 방문만으로 세션을 만들지 않고 연결 버튼 제공' },
  { id: 'connection-active', group: '메이트·연결', title: '연결 중 · 채린', path: '/connect/chaerin', steps: [click('연결하기')], note: '준비·목표 시간 없이 기본 채팅·카메라·보기 전환' },
  { id: 'connection-start-error', group: '메이트·연결', title: '연결 · 시작 오류', path: '/connect/chaerin', fault: 'start', steps: [click('연결하기')], note: '서버 연결 실패와 재시도' },
  { id: 'connection-record', group: '메이트·연결', title: '연결 기록', path: '/connections/9001', cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, note: '연결 끊음 창·함께한 시간(연결 시간)·카메라로 함께한 시간·친밀도와 다시 연결' },
  { id: 'connection-record-levelup', group: '메이트·연결', title: '연결 기록 · 친밀도 단계 상승', path: '/connections/9001', cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, note: '친밀도 단계 상승(아는 사이 → 친구)·다음 단계 진행 막대·「새 세계관이 열렸어요 · EP.03 도서관」과 「세계관 보기」(내 메이트로)' },
  { id: 'connection-record-nocam', group: '메이트·연결', title: '연결 기록 · 카메라 없음', path: '/connections/9001', note: '카메라 측정 없음·마무리 대사 없음·친밀도 값 없음 숨김 확인' },
  { id: 'connection-record-loading', group: '메이트·연결', title: '연결 기록 · 불러오는 중', path: '/connections/9001', fault: 'report-pending', loading: 'connection-record', note: '연결 끊음 창 스켈레톤' },
  { id: 'connection-record-credit-out', group: '메이트·연결', title: '연결 기록 · 크레딧 소진 안내', path: '/connections/9001', cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, note: '오늘 크레딧 소진 시 친구 초대 안내 표시' },
  { id: 'connection-record-error', group: '메이트·연결', title: '연결 기록 · 조회 실패', path: '/connections/9001', fault: 'report', note: '같은 창 안 오류 안내·다시 시도·홈 이동' },
  { id: 'connection-model-missing', group: '메이트·연결', title: '연결 · 모델 없음', path: '/connect/chaerin', fault: 'model-missing', steps: [click('연결하기')], note: '다른 모델이나 사진으로 연결 성공을 대신하지 않음' },
  { id: 'connection-model-ended-retry', group: '메이트·연결', title: '연결 · 모델 실패 뒤 서버 종료', path: '/connect/chaerin', fault: 'model-ended-retry', steps: [click('연결하기')], note: '모델 실패 뒤 재개하면 SESSION_ENDED. 종료된 임시 연결 제거·기록 조회·새 ID로 연결' },
  { id: 'connection-camera-error', group: '메이트·연결', title: '연결 · 카메라 거절', path: '/connect/chaerin', steps: [click('연결하기'), click('카메라 켜기')], note: '카메라 권한 거절 후 연결 유지' },
  { id: 'connection-chat-history', group: '메이트·연결', title: '연결 · 지난 대화 불러오기', path: '/connect/chaerin', fault: 'chat-history', steps: [click('연결하기')], note: '32: 채팅을 열면 지난 대화 첫 페이지(20줄), 맨 위로 올리면 이전 페이지. 답장에 마우스를 올리면 👍·👎·신고' },
  { id: 'connection-reply-report', group: '메이트·연결', title: '연결 · 답장 신고', path: '/connect/chaerin', fault: 'chat-history', steps: [click('연결하기'), { click: '신고', selector: '.reply-action' }], note: '41: 사유 4개(기타는 300자 이하 직접 입력)·이미 신고한 답장은 409 뒤 접힘 처리' },
  { id: 'connection-credit-short', group: '메이트·연결', title: '연결 · 고급 모드 크레딧 부족', path: '/connect/chaerin', fault: 'credit-short', steps: [click('연결하기'), { click: '고급 ·', includes: true }, fill('textarea', '검토 메시지'), click('메시지 보내기')], note: '409 CREDIT_INSUFFICIENT: 「크레딧이 부족해요」·기본 모드로 계속(입력 그대로 다시 보냄)·친구 초대로 받기' },
  { id: 'connection-message-error', group: '메이트·연결', title: '연결 · 답장 실패', path: '/connect/chaerin', fault: 'message', steps: [click('연결하기'),fill('textarea','검토 메시지'),click('메시지 보내기')], note: '입력 유지·재시도' },
  { id: 'connection-finish', group: '메이트·연결', title: '연결 · 끊기 확인', path: '/connect/chaerin', steps: [click('연결하기'),click('연결 끊기')], note: '끊기·계속하기 (전용 끊기 멘트 없음)' },
  { id: 'connection-finish-with-line', group: '메이트·연결', title: '연결 · 끊기 확인(전용 멘트)', path: '/connect/chaerin', farewellLine: '잠깐 쉬고 와도 괜찮아. 여기서 기다리고 있을게.', steps: [click('연결하기'),click('연결 끊기')], note: '전용 끊기 멘트 필드가 있을 때만 말풍선 표시' },
  { id: 'connection-finish-error', group: '메이트·연결', title: '연결 · 종료 실패', path: '/connect/chaerin', fault: 'end', steps: [click('연결하기'),click('연결 끊기'),{click:'연결 끊기',selector:'.app-dialog button'}], note: '실패 후 연결 유지·재시도' },
  { id: 'connection-ended-heartbeat', group: '메이트·연결', title: '연결 · 서버 종료 알림', path: '/connect/chaerin', fault: 'server-ended-heartbeat', steps: [click('연결하기')], note: '다음 heartbeat에서 기존 SESSION_ENDED 응답. 중복 종료 없이 실제 보고서 조회로 전환' },
  { id: 'connection-ended-event', group: '메이트·연결', title: '연결 · 상태 전송 중 서버 종료', path: '/connect/chaerin', fault: 'server-ended-event', steps: [click('연결하기')], note: '상태 이벤트의 SESSION_ENDED 뒤 연결 상태·모델·미디어 정리' },
  { id: 'connection-ended-message', group: '메이트·연결', title: '연결 · 메시지 HTTP 종료 응답', path: '/connect/chaerin', fault: 'server-ended-message', steps: [click('연결하기')], note: '메시지를 보내면 409 SESSION_ENDED. 실패한 메시지 캐시는 제거' },
  { id: 'connection-stage-up', group: '메이트·연결', title: '연결 · 통화 중 친밀도 단계 상승', path: '/connect/chaerin', fault: 'stage-up', steps: [click('연결하기')], note: '첫 heartbeat(약 60초 뒤) 응답의 stageUp(Lv.3): 오른쪽 위 알림 「친밀도 Lv.3 · 친구 / 새 세계관이 열렸어요 · EP.03 도서관」·12초 뒤 또는 닫기로 사라짐. 통화 배경·의상은 그대로' },
  { id: 'connection-ended-stream', group: '메이트·연결', title: '연결 · SSE 도중 종료 응답', path: '/connect/chaerin', fault: 'server-ended-stream', steps: [click('연결하기')], note: 'HTTP 200 SSE error의 SESSION_ENDED도 연결 기록으로 전환' },
  { id: 'connection-ended-finish', group: '메이트·연결', title: '연결 · 끊기 요청 전 서버 종료', path: '/connect/chaerin', fault: 'server-ended-finish', steps: [click('연결하기')], note: '종료 요청이 이미 종료됨을 알리면 다시 /end를 보내지 않고 기록 조회' },
  { id: 'connection-ended-resume', group: '메이트·연결', title: '연결 · 이어가기 전 서버 종료', path: '/connect/chaerin', session: 'recover', fault: 'server-ended-resume', note: '진행 중 요약이 오래됐을 때 /resume의 종료 응답을 반영하고 보고서 조회' },
  { id: 'connection-ended-report', group: '메이트·연결', title: '연결 · 서버 종료 후 기록 조회 실패', path: '/connect/chaerin', fault: 'server-ended-report', steps: [click('연결하기')], note: '이미 끝난 연결을 복구하지 않고 기록 화면에서 조회 재시도' },
  { id: 'records', group: '내 기록', title: '내 기록 · 5주 기록(12건)', path: '/records', reports: [9001,9002,9003,9004,9005,9006,9007,9008,9009,9010,9011,9012], cameraFocus: {observedMs:1500000,focusedMs:1380000,returns:2}, note: '채린 기록 12건(최근 5주·이번 주 3일/하루 2회·카메라 꺼짐 2건·단계 상승 1건)·기본 보기 2D 잔디(주 7칸)' },
  { id: 'records-two-mates', group: '내 기록', title: '내 기록 · 메이트 2명 칩 필터', path: '/records', reports: [9001,9002,9003,9004,9005,9006,9007,9008,9009,9010,9011,9012], cameraFocus: {observedMs:1500000,focusedMs:1380000,returns:2}, note: '로컬 미리보기용: 채린·남학생 기록으로 2명 이상 메이트 칩 필터와 요약 확인' },
  { id: 'records-camoff', group: '내 기록', title: '내 기록 · 카메라 꺼짐 전용', path: '/records', reports: [9001,9002,9003,9004], note: '모든 기록이 카메라 꺼짐(함께한 시간 0)일 때 연결 시간 대체 요약과 안내 표시' },
  { id: 'records-past-empty', group: '내 기록', title: '내 기록 · 지난주 기록 없음', path: '/records?period=week&offset=-1', reports: [9001,9002], cameraFocus: {observedMs:1500000,focusedMs:1380000,returns:2}, note: '기록이 없는 지난주로 이동한 상태·날짜 이동과 이번 주로 복귀 유지' },
  { id: 'records-grid-month', group: '내 기록', title: '내 기록 · 2D 잔디 월', path: '/records?period=month', reports: [9001,9002,9003,9004,9005,9006,9007,9008,9009,9010,9011,9012], cameraFocus: {observedMs:1500000,focusedMs:1380000,returns:2}, note: '월 달력 7열 잔디·칸 진하기 = 그날 함께한 시간(없음/30분 미만/30분+/1시간+/2시간+)·오늘은 점·「적음 ▢ 많음」 범례' },
  { id: 'records-grid-year', group: '내 기록', title: '내 기록 · 2D 잔디 연', path: '/records?period=year', reports: [9001,9002,9003,9004,9005,9006,9007,9008,9009,9010,9011,9012], cameraFocus: {observedMs:1500000,focusedMs:1380000,returns:2}, note: '열 = 주, 행 = 요일(월·수·금 라벨), 위에 월 라벨·미래 날짜는 흐리게 비활성·칸을 누르면 그날 기록 카드' },
  { id: 'records-25d-year', group: '내 기록', title: '내 기록 · 2.5D 연(유리 기둥)', path: '/records?period=year', reports: [9001,9002,9003,9004,9005,9006,9007,9008,9009,9010,9011,9012], cameraFocus: {observedMs:1500000,focusedMs:1380000,returns:2}, steps: [click('2.5D')], note: '연 2.5D도 주·월과 같은 유리 기둥(기간의 가장 긴 날 기준 높이)·달을 누르면 그 달' },
  { id: 'records-loading', group: '내 기록', title: '내 기록 · 불러오는 중', path: '/records', loading: 'records', note: '로컬 미리보기용: 창 내부 스켈레톤 상태' },
  { id: 'my-mates', group: '내 메이트', title: '내 메이트 · 기본(연결 1번)', path: '/mates/me', mateContract: true, reports: [9001], cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, note: '위에서 내려다본 캡슐 바닥 장면(캡슐이 쏟아진 뒤 카드가 떨어져 내려앉음)과 오른쪽 함께한 시간 열·서버 보고서 1개(연결 1번 = 캡슐 여러 개)·해금 정보 없음: 개발에서는 샘플 친밀도·세계관(기획 예시), 운영(api)은 서버 단계·세계관 「준비 중」, ?features=off는 개발에서 카드 없는 모습' },
  { id: 'my-mates-full', group: '내 메이트', title: '내 메이트 · 전체(연결 7번·세계관 3/5)', path: '/mates/me', mateContract: true, reports: [9001, 9002, 9003, 9004, 9005, 9006, 9007], cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, note: '서버 계약 전 디자인 확인용: 연결 7번(연결 시간만큼 캡슐 묶음)·누운 한 면 카드(이름·처음 만난 날)·친밀도와 세계관 한 카드(Lv.3·세계관 3/5)·오른쪽 열(함께한 시간·12시간 고리·최근 캡슐)·보이스 대사는 숨김' },
  // 세계관 (mate-worlds.ts): the stage opens the five places; development shows the planning examples, api mode 「준비 중」.
  { id: 'my-mates-world-0', group: '내 메이트', title: '내 메이트 · 세계관 0/5(연결 전)', path: '/mates/me', empty: true, note: '연결 0번: 아직 만나지 않아 다섯 세계관 모두 잠김·EP.01 학교 「Lv.1에서 열려요」' },
  { id: 'my-mates-world-3', group: '내 메이트', title: '내 메이트 · 세계관 3/5', path: '/mates/me?affinity=3', mateContract: true, reports: [9001], cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, note: 'Lv.3: EP.03 도서관부터 보여 줌(배경 자리·대사 예시)·점 다섯 개 중 현재 단계 점이 길게' },
  { id: 'my-mates-world-5', group: '내 메이트', title: '내 메이트 · 세계관 5/5', path: '/mates/me?affinity=5', mateContract: true, reports: [9001], cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, note: 'Lv.5: 다섯 세계관 모두 열림(EP.05 채린이네 집)·다음 화살표 비활성' },
  { id: 'my-mates-world-first', group: '내 메이트', title: '내 메이트 · 세계관 EP.01(배경·의상 있음)', path: '/mates/me?affinity=3', mateContract: true, reports: [9001], cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, steps: [click('이전 세계관'), click('이전 세계관')], note: '「이전 세계관」 두 번: EP.01 학교(교실 배경 썸네일)·처음 칸에서 이전 화살표 비활성' },
  { id: 'my-mates-world-locked', group: '내 메이트', title: '내 메이트 · 잠긴 세계관', path: '/mates/me?affinity=3', mateContract: true, reports: [9001], cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, steps: [click('다음 세계관')], note: 'Lv.3에서 「다음 세계관」: EP.04 카페 잠김(흐린 배경 자리·자물쇠·「Lv.4에서 열려요」)' },
  { id: 'my-mates-world-detail', group: '내 메이트', title: '내 메이트 · 세계관 상세', path: '/mates/me?affinity=3', mateContract: true, reports: [9001], cameraFocus: { observedMs: 1500000, focusedMs: 1380000, returns: 2 }, steps: [click('이전 세계관'), click('이전 세계관'), { click: '세계관 자세히 보기', selector: 'button.mate-world-tile', includes: true }], note: 'EP.01 학교 상세: 배경 크게·의상 미리보기(전신 정지 그림)·장소·대사 예시' },
  { id: 'mate-reset-confirm', group: '내 메이트', title: '내 메이트 · 대화 초기화 확인', path: '/mates/me', mateContract: true, mateHistory: true, reports: [9001], steps: resetMenu, note: '⋯ 메뉴 → 대화 초기화(47): 지워지는 것(대화 기록·대화 맥락)·남는 것(친밀도·세계관·연결 기록·크레딧)·되돌릴 수 없음 안내' },
  { id: 'mate-reset-error', group: '내 메이트', title: '내 메이트 · 대화 초기화 실패', path: '/mates/me', mateContract: true, mateHistory: true, reports: [9001], fault: 'mate-reset', steps: [...resetMenu, click('초기화하기')], note: '503: 창 안 오류 안내·메시지 캐시 보존·다시 누르면 성공' },
  { id: 'mate-reset-conflict', group: '내 메이트', title: '내 메이트 · 연결 중이라 초기화 불가', path: '/mates/me', mateContract: true, mateHistory: true, reports: [9001], fault: 'mate-conflict', steps: [...resetMenu, click('초기화하기')], note: '47의 409 CONNECTION_IN_PROGRESS(다른 기기 연결 포함): 「연결을 먼저 마쳐 주세요」' },
  { id: 'my-mates-empty', group: '내 메이트', title: '내 메이트 · 연결 기록 없음', path: '/mates/me', note: '연결 0번: 빈 바닥 위 카드와 「첫 캡슐을 모아 볼까?」 안내·오른쪽 열의 만나러 가기 버튼(메이트 목록이 비면 홈 이동)' },
  { id: 'my-mates-loading', group: '내 메이트', title: '내 메이트 · 불러오는 중', path: '/mates/me', loading: 'my-mates', note: '로컬 미리보기용: 창 내부 장면 스켈레톤' },
  { id: 'mate-preview', group: '메이트·연결', title: '메이트 상세 · 미리보기·목소리', path: '/mates/chaerin', mateContract: true, note: '신규 계약 모의 포트: 이미지 모델과 무음 WAV로 UI만 검토. 실제 제작물/서버 연동 아님' },
  { id: 'mate-load-error', group: '메이트·연결', title: '메이트 상세 · 조회 실패', path: '/mates/chaerin', mateContract: true, fault: 'mate-load', note: '조회 실패·다시 시도, 연결 자동 생성 없음' },
  { id: 'mate-model-error', group: '메이트·연결', title: '메이트 상세 · 모델 실패', path: '/mates/chaerin', mateContract: true, fault: 'mate-model', note: '미리보기 실패·재시도. 연결 모델과 별도 소유' },
  { id: 'mate-audio-error', group: '메이트·연결', title: '메이트 상세 · 샘플 재생 실패', path: '/mates/chaerin', mateContract: true, fault: 'mate-audio', note: '재생 오류·재시도·화면 이탈 시 정리' },
  { id: 'mate-coming-soon', group: '메이트·연결', title: '메이트 상세 · 공개 예정', path: '/mates/dohyun', fault: 'coming-soon', note: '31 comingSoon: 연결 대신 「공개 알림 받기」(46)' },
  { id: 'mate-coming-soon-requested', group: '메이트·연결', title: '메이트 상세 · 공개 알림 신청함', path: '/mates/dohyun', fault: 'coming-soon', steps: [click('공개 알림 받기')], note: '46 204 뒤 「공개되면 알려 드릴게요」(비활성)' },
  { id: 'home-coming-soon', group: '온보딩·홈', title: '홈 · 공개 예정 메이트 카드', path: '/', fault: 'coming-soon', note: '11 comingSoon: 「곧 만나요」, 연결 화살표 닫힘(상세로는 이동)' },
  { id: 'credits', group: '크레딧·초대', title: '내 크레딧 · 값 없음', path: '/credits', note: '서버 계약 대기(값 없음) 오류·재시도 상태' },
  { id: 'credits-filled', group: '크레딧·초대', title: '내 크레딧 · 내역 있음', path: '/credits', note: '로컬 미리보기용 지갑 주입(실제 서버 연동 아님): 잔액 1,180·출석 980·초대 200·오늘 사용 320·이틀치 내역 6건' },
  { id: 'credits-empty', group: '크레딧·초대', title: '내 크레딧 · 내역 없음', path: '/credits', note: '로컬 미리보기용 지갑 주입(실제 서버 연동 아님): 잔액 있음·내역 0건' },
  { id: 'credits-loading', group: '크레딧·초대', title: '내 크레딧 · 불러오는 중', path: '/credits', loading: 'credits', note: '로컬 미리보기용: 창 내부 스켈레톤 상태' },
  { id: 'invite', group: '크레딧·초대', title: '친구 초대 · 값 없음', path: '/credits/invite', note: '서버 계약 대기(값 없음) 오류·재시도 상태' },
  { id: 'invite-filled', group: '크레딧·초대', title: '친구 초대 · 진행 중', path: '/credits/invite', note: '로컬 미리보기용 초대 정보 주입(실제 서버 연동 아님): 코드 CAP-7K2Q·3명 초대·코드 입력 가능' },
  { id: 'invite-full', group: '크레딧·초대', title: '친구 초대 · 10명 달성', path: '/credits/invite', note: '로컬 미리보기용 초대 정보 주입(실제 서버 연동 아님): 10명 초대 완료·이미 코드 등록함' },
  { id: 'invite-loading', group: '크레딧·초대', title: '친구 초대 · 불러오는 중', path: '/credits/invite', loading: 'invite', note: '로컬 미리보기용: 창 내부 스켈레톤 상태' },
  { id: 'app-loading', group: '온보딩·홈', title: '앱 로딩', path: '/', fault: 'bootstrap-pending', loading: 'auth', note: '로그인 상태 확인 전: 로고·공통 로딩' },
  { id: 'home-loading', group: '온보딩·홈', title: '홈 데이터 로딩', path: '/', fault: 'home-pending', loading: 'home', note: '홈으로 이동할 계정임을 확인한 뒤의 데이터 대기' },
  { id: 'app-error', group: '온보딩·홈', title: '앱 연결 실패', path: '/', fault: 'bootstrap', note: '홈 화면·연결 실패 알림·다시 연결하기' },
  { id: 'account-profile', group: '계정·공통', title: '계정 설정 · 프로필', path: '/', steps: account, note: '좌측 아바타·닉네임·메뉴와 우측 프로필 편집' },
  { id: 'account-profile-saved', group: '계정·공통', title: '계정 설정 · 프로필 저장', path: '/', steps: [...account, fill('dialog.account-settings-dialog input[name="nickname"]', '설정에서 저장한 이름'), click('프로필 저장')], note: '프로필 저장 후 좌측 닉네임 갱신' },
  { id: 'account-profile-error', group: '계정·공통', title: '계정 설정 · 프로필 저장 실패', path: '/', fault: 'profile', steps: [...account, fill('dialog.account-settings-dialog input[name="nickname"]', '설정에서 변경한 이름'), click('프로필 저장')], note: '오류 안내·작성 내용 유지·재시도' },
  { id: 'account-profile-beta', group: '계정·공통', title: '계정 설정 · 나에 대해', path: '/', accountContract: true, steps: account, note: '신규 계정 계약 모의 포트: 닉네임·나에 대해 입력/저장(호칭은 2026-11-26 결정으로 없앰)·실제 신규 API 아님' },
  { id: 'account-profile-nocontract', group: '계정·공통', title: '계정 설정 · 프로필(계약 없음)', path: '/', steps: account, note: 'saveBetaProfile 없음: 나에 대해 숨김' },
  { id: 'account-narrow', group: '계정·공통', title: '계정 설정 · 좁은 창 가로 탭', path: '/', accountContract: true, steps: account, note: '720px 미만 컨테이너에서 가로 탭·프로필 하단 로그아웃 전환' },
  { id: 'account-settings', group: '계정·공통', title: '계정 설정 · 설정', path: '/?account=settings', note: '통화 기기·PIP·대화 비용 3묶음. 장치 목록 조회 시 권한 요청 없음' },
  { id: 'account-security', group: '계정·공통', title: '계정 설정 · 보안', path: '/', steps: security, note: '이메일 미리 채움·처음부터 펼친 회원탈퇴 확인 카드(포커스는 입력칸으로 가지 않음)' },
  { id: 'account-password-edit', group: '계정·공통', title: '보안 · 재설정 이메일 입력', path: '/', steps: security, note: '보안 탭에서 바로 보이는 이메일 입력·재설정 링크 요청' },
  { id: 'account-password-requested', group: '계정·공통', title: '보안 · 재설정 메일 접수', path: '/', steps: passwordRequest, note: '가상 202 응답·실제 메일 발송 없음' },
  { id: 'account-password-error', group: '계정·공통', title: '보안 · 재설정 메일 요청 실패', path: '/', fault: 'reset-request', steps: passwordRequest, note: '요청 실패·입력 유지·재시도' },
  { id: 'account-password-pending', group: '계정·공통', title: '보안 · 재설정 메일 요청 중', path: '/', fault: 'reset-request-pending', steps: passwordRequest, note: '로딩 스피너·중복 요청·탈퇴·닫기 방지' },
  { id: 'account-logout', group: '계정·공통', title: '계정 설정 · 로그아웃 버튼', path: '/', steps: account, note: '좌측 하단의 로그아웃 실행 버튼' },
  { id: 'account-logout-error', group: '계정·공통', title: '계정 설정 · 로그아웃 실패', path: '/', fault: 'logout', steps: [...account, { click: '로그아웃', selector: 'button[data-account-logout]' }], note: '좌측 하단의 실패 안내·재시도' },
  { id: 'withdraw', group: '계정·공통', title: '회원탈퇴 확인', path: '/', steps: security, note: '보안 탭의 탈퇴 확인 카드·문장 입력·취소(입력 지우기)·탈퇴' },
  { id: 'withdraw-incorrect', group: '계정·공통', title: '탈퇴 · 확인 문장 불일치', path: '/', steps: [...security, fill('input[name="withdrawalConfirmation"]', '탈퇴합니다')], note: '지정한 문장과 다르면 탈퇴 버튼 비활성화' },
  { id: 'withdraw-conflict', group: '계정·공통', title: '탈퇴 · 진행 중 공부', path: '/', fault: 'withdraw-conflict', steps: [...withdraw, click('회원탈퇴')], note: '409·공부를 먼저 마치라는 안내' },
  { id: 'withdraw-error', group: '계정·공통', title: '탈퇴 실패', path: '/', fault: 'withdraw', steps: [...withdraw, click('회원탈퇴')], note: '서버 오류·계정 유지' },
  { id: 'withdraw-pending', group: '계정·공통', title: '탈퇴 처리 중', path: '/', fault: 'withdraw-pending', steps: [...withdraw, click('회원탈퇴')], note: '로딩·중복 클릭·닫기 방지' },
  { id: 'withdraw-done', group: '계정·공통', title: '탈퇴 완료', path: '/login?notice=account-withdrawn', guest: true, note: '로그인 화면의 완료 안내' },
  { id: 'records-empty', group: '내 기록', title: '내 기록 · 기록 없음', path: '/records', empty: true, note: '아직 함께한 기록이 없는 빈 상태·홈 이동 버튼' },
  { id: 'notifications', group: '계정·공통', title: '알림 · 목록', path: '/', steps: [{ click: '알림 · 안 읽은 알림', includes: true }], note: '43 · 44: 헤더 종 아이콘 점·목록(제목·본문·상대 시각·안 읽음 표시), 열면 보이는 항목 읽음 처리, 아래로 스크롤하면 이어서 불러옴' },
  { id: 'notifications-empty', group: '계정·공통', title: '알림 · 없음', path: '/', fault: 'notifications-empty', steps: [click('알림')], note: '알림 0개: 점 없음·빈 상태 문구' },
  { id: 'notifications-error', group: '계정·공통', title: '알림 · 불러오기 실패', path: '/', fault: 'notifications-error', steps: [click('알림')], note: '43 실패: 오류 안내·다시 시도' },
  { id: 'not-found', group: '계정·공통', title: '없는 주소 · 홈 안내', path: '/review-not-found', note: '홈으로 이동·우측 상단 알림·한 번만 안내' },
  { id: 'dialog-design-a', group: '디자인 시안', title: '모달 시안 A · 캡슐 유리', path: '/', dialogDesign: 'a', note: '2026-11-26 시안: 위쪽 캡슐 알약이 열리며 빛이 쏟아지고 창이 펼쳐짐. 확인·안내(크레딧 부족·세계관 열림)·토스트·큰 창 머리. 아래 막대로 전환·다시 재생(?dd=confirm|credit|unlock|toast|large|all)' },
  { id: 'dialog-design-b', group: '디자인 시안', title: '모달 시안 B · 밤하늘', path: '/', dialogDesign: 'b', note: '2026-11-26 시안: 어두운 보라 그라데이션 위 픽셀 별·눈송이(내 메이트 PixelSnow 스프라이트), 위쪽 가장자리를 흐르는 빛' },
  { id: 'dialog-design-b2', group: '디자인 시안', title: '모달 시안 B2 · 픽셀 프레임', path: '/', dialogDesign: 'b2', note: '2026-11-26 B 발전안: 계단형 픽셀 모서리(clip-path, 선 없음)·디더링 머리 띠·8비트 로고 캡슐·머리 띠 안에서만 천천히 내리는 픽셀 눈·steps() 5단계로 차오르는 등장. 세계관 열림은 「새 세계관이 열렸어요 · EP.03 도서관」' },
  { id: 'dialog-design-b3', group: '디자인 시안', title: '모달 시안 B3 · 픽셀 액센트', path: '/', dialogDesign: 'b3', note: '2026-11-26 B 발전안(절제): 둥근 모서리 유지, 픽셀은 제목 앞 아이콘·머리 아래 한 줄 별자리·주요 버튼 hover 반짝임 세 곳만. 본문은 차분하게' },
  { id: 'dialog-design-c', group: '디자인 시안', title: '모달 시안 C · 메이트와 함께', path: '/', dialogDesign: 'c', note: '2026-11-26 시안: 모서리에서 메이트 얼굴(정지 이미지)이 고개를 내밀고 말풍선 꼬리로 안내. 확인 창은 버튼에 따라 표정이 바뀜' },
  { id: 'mobile-notice', group: '계정·공통', title: '모바일 접속 안내 (SCR-40)', path: '/?ref=CAP-7K2Q', note: '휴대폰 접속 시 PC 안내 창·초대 코드 유지·약관 열기' },
]

// Saved review links of retired scenarios open the current screen instead.
const restoredReviewIds: Readonly<Record<string, string>> = {
  'draft-records': 'records',
  'draft-records-empty': 'records-empty',
  'draft-characters': 'my-mates',
  'draft-credits': 'credits',
  'draft-charge': 'credits',
  'draft-charge-receipt': 'credits',
  'login-alt-illustration': 'login',
  'login-alt-portrait': 'login',
  'mate-reset': 'mate-reset-confirm',
  'mate-reset-partial': 'mate-reset-error',
  // 2026-11-26: the 세계관 strip left 메이트 상세 (its owner places it to the Figma frame).
  'mate-detail-worlds': 'mate-detail',
  'mate-detail-worlds-unmet': 'mate-detail',
}

const reviewGroupOrder = [
  '로그인·가입',
  '비밀번호·카카오',
  '온보딩·홈',
  '메이트·연결',
  '내 메이트',
  '내 기록',
  '크레딧·초대',
  '계정·공통',
  '디자인 시안',
] as const

export const reviewGroups = [...new Set(reviewScenarios.map(scenario => scenario.group))].sort((a, b) => {
  const ai = reviewGroupOrder.indexOf(a as (typeof reviewGroupOrder)[number])
  const bi = reviewGroupOrder.indexOf(b as (typeof reviewGroupOrder)[number])
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
})
export function findReviewScenario(id: string | null) {
  const currentId = id ? restoredReviewIds[id] ?? id : null
  return reviewScenarios.find(scenario => scenario.id === currentId) ?? reviewScenarios[0]!
}
export function reviewPreviewUrl(scenario: ReviewScenario) {
  const url = new URL(scenario.path, 'http://review.local')
  url.searchParams.set('__review', scenario.id)
  return url.pathname + url.search + url.hash
}
