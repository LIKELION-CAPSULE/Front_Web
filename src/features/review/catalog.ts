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
  session?: 'recover' | 'study' | 'break' | 'unknown'
  fault?: string
  draft?: boolean
  steps?: ReviewStep[]
}

const click = (text: string): ReviewStep => ({ click: text })
const fill = (selector: string, value: string): ReviewStep => ({ fill: selector, value })
const login = [fill('input[name="email"]', 'review@example.invalid'), fill('input[name="password"]', 'Review-only-2026!'), click('로그인')]
const signup = [fill('input[name="email"]', 'review@example.invalid'), fill('input[name="password"]', 'Review-only-2026!'), fill('input[name="confirmPassword"]', 'Review-only-2026!'), fill('input[name="nickname"]', '문구 검토'), { click: '', selector: 'input[name="agreeTerms"]' }, { click: '', selector: 'input[name="agreePrivacy"]' }, click('회원가입'), { wait: '이메일 인증' }] satisfies ReviewStep[]
const withdraw = [{ click: '', selector: 'summary[aria-label="내 프로필 메뉴"]' }, click('회원탈퇴')] satisfies ReviewStep[]
const finish = [click('공부 끝내기')]
const send = [click('파이팅')]

export const reviewScenarios: ReviewScenario[] = [
  { id: 'welcome', group: '로그인·가입', title: '로그인 시작', path: '/login', guest: true, note: '카카오·이메일 선택과 약관 안내' },
  { id: 'login', group: '로그인·가입', title: '이메일 로그인', path: '/login?mode=login', guest: true, note: '기본 입력·비밀번호 찾기' },
  { id: 'login-error', group: '로그인·가입', title: '로그인 실패', path: '/login?mode=login', guest: true, fault: 'login', steps: login, note: '잘못된 인증정보 안내' },
  { id: 'login-locked', group: '로그인·가입', title: '로그인 잠금', path: '/login?mode=login', guest: true, fault: 'locked', steps: login, note: '반복 실패·5분 뒤 재시도' },
  { id: 'signup', group: '로그인·가입', title: '회원가입', path: '/login?mode=signup', guest: true, note: '입력 항목·필수 약관 동의' },
  { id: 'signup-errors', group: '로그인·가입', title: '가입 입력 오류', path: '/login?mode=signup', guest: true, steps: [click('회원가입')], note: '필수 입력·약관 누락 문구' },
  { id: 'verification', group: '로그인·가입', title: '이메일 인증', path: '/login?mode=signup', guest: true, steps: signup, note: '인증번호·남은 시간·재전송' },
  { id: 'verification-expired', group: '로그인·가입', title: '인증 시간 만료', path: '/login?mode=signup', guest: true, fault: 'verification-expired', steps: signup, note: '1초 뒤 만료 안내 표시' },
  { id: 'verification-wrong', group: '로그인·가입', title: '인증번호 오류', path: '/login?mode=signup', guest: true, fault: 'verification', steps: [...signup, fill('input[autocomplete="one-time-code"]', '001234'), click('인증하고 가입하기')], note: '잘못된 코드·입력 유지' },
  { id: 'terms', group: '로그인·가입', title: '이용약관', path: '/login', guest: true, steps: [click('이용약관')], note: '실제 저장된 약관 전문과 모달' },
  { id: 'privacy', group: '로그인·가입', title: '개인정보 처리방침', path: '/login', guest: true, steps: [click('개인정보 처리방침')], note: '실제 저장된 개인정보 처리방침 전문' },
  { id: 'reset-request', group: '비밀번호·카카오', title: '비밀번호 찾기', path: '/login?mode=forgot-password', guest: true, note: '메일 요청 입력 화면' },
  { id: 'reset-requested', group: '비밀번호·카카오', title: '재설정 메일 접수', path: '/login?mode=forgot-password', guest: true, steps: [fill('input[name="email"]', 'review@example.invalid'), click('재설정 링크 받기')], note: '가상 202·메일 발송 없이 접수 안내' },
  { id: 'reset-form', group: '비밀번호·카카오', title: '새 비밀번호', path: '/password/reset?token=review-reset', guest: true, note: '유효한 가상 링크·비밀번호 확인' },
  { id: 'reset-missing', group: '비밀번호·카카오', title: '재설정 링크 없음', path: '/password/reset', guest: true, note: '누락 링크·다시 받기' },
  { id: 'reset-invalid', group: '비밀번호·카카오', title: '만료된 재설정 링크', path: '/password/reset?token=review-reset', guest: true, fault: 'reset', steps: [fill('input[name="password"]', 'Review-new-2026!'), fill('input[name="confirmPassword"]', 'Review-new-2026!'), click('비밀번호 변경하기')], note: '서버가 토큰을 거절한 경우' },
  { id: 'reset-done', group: '비밀번호·카카오', title: '비밀번호 변경 완료', path: '/password/reset?token=review-reset', guest: true, steps: [fill('input[name="password"]', 'Review-new-2026!'), fill('input[name="confirmPassword"]', 'Review-new-2026!'), click('비밀번호 변경하기')], note: '변경 성공 안내·로그인 버튼으로 직접 이동' },
  { id: 'kakao-loading', group: '비밀번호·카카오', title: '카카오 처리 중', path: '/oauth/kakao?code=review-code&state=review-state', guest: true, fault: 'kakao-pending', note: '외부 인증 없이 로그인 대기 스켈레톤 확인' },
  { id: 'kakao-failed', group: '비밀번호·카카오', title: '카카오 인증 실패', path: '/login?notice=kakao-expired', guest: true, note: '만료·사용된 코드 오류' },
  { id: 'kakao-cancelled', group: '비밀번호·카카오', title: '카카오 동의 취소', path: '/login?notice=kakao-cancelled', guest: true, note: '사용자가 동의를 취소한 경우' },
  { id: 'kakao-invalid', group: '비밀번호·카카오', title: '카카오 요청 확인 불가', path: '/login?notice=kakao-invalid-request', guest: true, note: '요청 상태·인가 코드 누락 안내' },
  { id: 'kakao-terms', group: '비밀번호·카카오', title: '카카오 필수 약관 누락', path: '/login?notice=kakao-terms-required', guest: true, note: '필수 동의 정보를 확인하지 못한 경우' },
  { id: 'kakao-error', group: '비밀번호·카카오', title: '카카오 로그인 오류', path: '/login?notice=kakao-failed', guest: true, note: '일반 로그인 실패 안내' },
  { id: 'onboarding', group: '온보딩·홈', title: '아바타 선택', path: '/onboarding', onboarding: true, note: '닉네임·아바타·기본 아바타 선택' },
  { id: 'onboarding-error', group: '온보딩·홈', title: '온보딩 저장 실패', path: '/onboarding', onboarding: true, fault: 'profile', steps: [click('이 모습으로 시작하기')], note: '프로필 API 실패 안내' },
  { id: 'home-first', group: '온보딩·홈', title: '홈 · 첫 방문', path: '/', note: '첫 공부 안내·스터디룸 목록' },
  { id: 'home-return', group: '온보딩·홈', title: '홈 · 재방문', path: '/', returning: true, note: '오늘 공부 시간·다시 시작 안내' },
  { id: 'home-resume', group: '온보딩·홈', title: '홈 · 이어하기', path: '/', session: 'recover', note: '진행 중인 공부가 있는 홈' },
  { id: 'home-empty', group: '온보딩·홈', title: '홈 · 룸 없음', path: '/', empty: true, note: '서버 목록이 비어 있는 경우' },
  { id: 'home-search', group: '온보딩·홈', title: '홈 · 검색 결과 없음', path: '/', steps: [fill('input[type="search"]', '찾을 수 없는 이름')], note: '검색 안내·전체 보기' },
  { id: 'home-saved', group: '온보딩·홈', title: '홈 · 저장한 룸 없음', path: '/', steps: [{ click: '저장한 스터디룸', includes: true }], note: '북마크 빈 화면' },
  { id: 'app-loading', group: '온보딩·홈', title: '앱 로딩', path: '/', fault: 'bootstrap-pending', note: '인증·데이터 로딩 스켈레톤' },
  { id: 'app-error', group: '온보딩·홈', title: '앱 연결 실패', path: '/', fault: 'bootstrap', note: '전체 화면 오류·다시 시도' },
  { id: 'profile', group: '프로필·일정', title: '프로필', path: '/mypage', note: '닉네임·아바타 수정' },
  { id: 'profile-saved', group: '프로필·일정', title: '프로필 저장 완료', path: '/mypage', steps: [fill('input[maxlength="20"]', '저장된 검토 이름'), click('프로필 저장')], note: '가상 저장·성공 안내' },
  { id: 'profile-error', group: '프로필·일정', title: '프로필 저장 실패', path: '/mypage', fault: 'profile', steps: [fill('input[maxlength="20"]', '검토 이름 변경'), click('프로필 저장')], note: '입력 유지·오류 안내' },
  { id: 'schedule', group: '프로필·일정', title: '일정 · 목록', path: '/mypage#schedule', note: '시험·목표·약속·지난 일정' },
  { id: 'schedule-empty', group: '프로필·일정', title: '일정 · 비어 있음', path: '/mypage#schedule', empty: true, note: '등록된 일정 없음' },
  { id: 'schedule-add', group: '프로필·일정', title: '일정 추가', path: '/mypage?add=1#schedule', note: '종류·날짜·시간 선택 창' },
  { id: 'schedule-detail', group: '프로필·일정', title: '일정 상세', path: '/mypage#schedule', steps: [{ click: '다음 주 모의고사', includes: true }], note: '기존 일정의 읽기 화면' },
  { id: 'room', group: '스터디룸·준비', title: '스터디룸 상세', path: '/rooms/101', note: '배너·성격 태그·관계 정보' },
  { id: 'room-missing', group: '스터디룸·준비', title: '존재하지 않는 룸', path: '/rooms/999999', note: '찾을 수 없는 화면' },
  { id: 'prepare', group: '스터디룸·준비', title: '공부 준비', path: '/rooms/101/prepare', note: '일정·대화 옵션·목표 시간' },
  { id: 'prepare-error', group: '스터디룸·준비', title: '공부 시작 실패', path: '/rooms/101/prepare', fault: 'start', steps: [click('시작하기')], note: '시작 API 실패·재시도' },
  { id: 'prepare-memory', group: '스터디룸·준비', title: '준비 화면 · 일정 추가', path: '/rooms/101/prepare', steps: [click('일정 추가')], note: '준비 화면에서 여는 일정 창' },
  { id: 'study-recover', group: '공부·휴식·대화', title: '공부 이어하기 안내', path: '/study/9001', session: 'recover', note: '새로고침·재접속 뒤의 시작 안내' },
  { id: 'study', group: '공부·휴식·대화', title: '공부 중', path: '/study/9001', session: 'study', note: '타이머·친구·카메라 꺼짐' },
  { id: 'study-break', group: '공부·휴식·대화', title: '쉬는 시간', path: '/study/9001', session: 'break', note: '휴식 타이머·대화·복귀' },
  { id: 'study-chat', group: '공부·휴식·대화', title: '대화창', path: '/study/9001?chat=1', session: 'study', note: '메시지 입력·빠른 대화·친구 답장' },
  { id: 'study-message-error', group: '공부·휴식·대화', title: '답장 실패', path: '/study/9001?chat=1', session: 'study', fault: 'message', steps: send, note: '전송 실패·재시도 문구' },
  { id: 'study-finish', group: '공부·휴식·대화', title: '공부 종료 확인', path: '/study/9001', session: 'study', steps: finish, note: '공부 시간·계속하기/끝내기' },
  { id: 'study-finish-error', group: '공부·휴식·대화', title: '공부 정산 실패', path: '/study/9001', session: 'study', fault: 'end', steps: [...finish, click('응, 여기까지 할게')], note: '확인 창 안의 종료 실패 안내' },
  { id: 'study-unknown', group: '공부·휴식·대화', title: '자리 지킴 복구 불가', path: '/study/9001', session: 'unknown', steps: finish, note: '이전 시간 복구가 없는 종료 경고' },
  { id: 'study-none', group: '공부·휴식·대화', title: '진행 중인 공부 없음', path: '/study/9001', note: '세션 없는 공부 경로' },
  { id: 'camera-error', group: '공부·휴식·대화', title: '카메라 권한 오류', path: '/study/9001', session: 'study', steps: [click('카메라 켜기')], note: '실제 장치 요청 없이 권한 거부 문구' },
  { id: 'microphone-error', group: '공부·휴식·대화', title: '마이크 권한 오류', path: '/study/9001', session: 'study', steps: [click('마이크 켜기')], note: '실제 장치 요청 없이 권한 거부 문구' },
  { id: 'report', group: '리포트·캡슐', title: '공부 리포트', path: '/reports/9001', returning: true, note: '시간·자리 지킴·호감도·완료 대사' },
  { id: 'report-levelup', group: '리포트·캡슐', title: '레벨 상승 리포트', path: '/reports/9001', returning: true, note: '공부 레벨 상승·달성률' },
  { id: 'report-no-target', group: '리포트·캡슐', title: '목표 정보 없는 리포트', path: '/reports/9001', note: '기기 저장값이 없는 실제 복구 조건' },
  { id: 'report-error', group: '리포트·캡슐', title: '리포트 조회 실패', path: '/reports/9001', fault: 'report', note: '다시 시도·홈 이동' },
  { id: 'card', group: '리포트·캡슐', title: '캡슐 카드', path: '/capsules/9001', note: '카드·이미지 저장·공유·다음 약속' },
  { id: 'withdraw', group: '계정·공통', title: '회원탈퇴 확인', path: '/', steps: withdraw, note: '삭제 범위·취소·탈퇴' },
  { id: 'withdraw-conflict', group: '계정·공통', title: '탈퇴 · 진행 중 공부', path: '/', fault: 'withdraw-conflict', steps: [...withdraw, click('회원탈퇴하기')], note: '409·공부를 먼저 마치라는 안내' },
  { id: 'withdraw-error', group: '계정·공통', title: '탈퇴 실패', path: '/', fault: 'withdraw', steps: [...withdraw, click('회원탈퇴하기')], note: '서버 오류·계정 유지' },
  { id: 'withdraw-pending', group: '계정·공통', title: '탈퇴 처리 중', path: '/', fault: 'withdraw-pending', steps: [...withdraw, click('회원탈퇴하기')], note: '로딩·중복 클릭·닫기 방지' },
  { id: 'withdraw-done', group: '계정·공통', title: '탈퇴 완료', path: '/login?notice=account-withdrawn', guest: true, note: '로그인 화면의 완료 안내' },
  { id: 'mvp', group: '계정·공통', title: 'MVP 이후 안내', path: '/records', note: '현재 서비스의 제한 화면' },
  { id: 'not-found', group: '계정·공통', title: '404', path: '/review-not-found', note: '공통 찾을 수 없음 화면' },
  { id: 'draft-records', group: '보관 화면 · 현재 미노출', title: '공부 기록 원본', path: '/records', draft: true, note: '이전 기록·히트맵·친구별 통계 화면' },
  { id: 'draft-records-empty', group: '보관 화면 · 현재 미노출', title: '공부 기록 · 빈 상태', path: '/records', draft: true, empty: true, note: '기록 없는 원본 화면' },
  { id: 'draft-characters', group: '보관 화면 · 현재 미노출', title: '친구 상세 원본', path: '/characters/chaerin', draft: true, note: '친구 선택·관계·콘텐츠 잠금' },
  { id: 'draft-credits', group: '보관 화면 · 현재 미노출', title: '크레딧 원본', path: '/credits', draft: true, note: '보유·사용·충전 내역·영수증' },
  { id: 'draft-charge', group: '보관 화면 · 현재 미노출', title: '충전 원본', path: '/credits/charge', draft: true, note: '상품·결제 수단·동의·결제 완료' },
  { id: 'draft-gift', group: '보관 화면 · 현재 미노출', title: '선물·보이스 원본', path: '/characters/chaerin/shop', draft: true, note: '상품·미리듣기·구매 안내' },
]

export const reviewGroups = [...new Set(reviewScenarios.map(scenario => scenario.group))]
export function findReviewScenario(id: string | null) { return reviewScenarios.find(scenario => scenario.id === id) ?? reviewScenarios[0]! }
export function reviewPreviewUrl(scenario: ReviewScenario) {
  const url = new URL(scenario.path, 'http://review.local')
  url.searchParams.set('__review', scenario.id)
  return url.pathname + url.search + url.hash
}
