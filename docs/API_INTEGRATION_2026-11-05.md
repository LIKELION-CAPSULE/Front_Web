# API 연동 기록 · 2026-11-05

현재 상태는 [26개 API 전수 재점검](API_FULL_AUDIT_2026-11-05.md)을 우선한다. Swagger는 회원탈퇴 반영본과 동일하고 50개 DTO가 일치한다. 이번에는 18개 API의 실제 성공과 26개 전체의 브라우저 연결·모의 흐름을 확인했다. 일정 저장의 미입력 dueTime/null·dueDate/빈 문자열을 선택 필드 생략으로 수정했다. 아래 실계정 25개·성공 20개 표기는 이전 실행 이력이다.

최신 Swagger 후속 확인: 27번 `DELETE /api/me` 회원탈퇴가 추가되어 현재 26개 API다. 기존 25개 API와 모든 DTO 스키마는 동일하다. 헤더 내 프로필 메뉴의 회원탈퇴 버튼·확인 창·인증된 DELETE 호출을 연결했다. 모의 응답으로 취소·409·500·빈 본문 200·성공 후 로그아웃과 다음 계정의 빈 일정을 확인했다. 실제 탈퇴 요청은 실행하지 않았다. [변경 비교·연결 기록](SWAGGER_DIFF_2026-11-05.md) 참고. 아래의 25개 실검증 결과는 회원탈퇴 추가 전 기록이다.

후속 [API 호출 최적화](API_CALL_OPTIMIZATION_2026-11-05.md)를 적용했다. 로그인 직후 중복 묶음 조회를 제거하고 홈·일정 10초, 룸 30초, 아바타 5분의 메모리 재사용 및 저장/세션 변경 무효화를 추가했다. 약관은 로그인 경로에서 조회하며 동일 GET 동시 요청을 공유한다. 1분 heartbeat는 유지하고 짧은 화면 복귀의 추가 heartbeat만 줄였다. 현재 조회 빈도와 전후 측정은 해당 문서를 따른다.

현재 브랜치의 실행 기준이다. 기존 [프로젝트 개요](PROJECT_OVERVIEW.md)는 연동 전 분석이다. [API 사전](BACKEND_API.md)과 [OpenAPI 원본](BACKEND_OPENAPI_2026-11-05.json)은 최신 명세로 갱신했으며, **이번 실서버 검증의 기준은 [전체 API 점검표](API_AUDIT_2026-11-05.md)**다. 아래 이전 모의 검증 이력과 구분한다.

최신 점검: 25개 모두 호출 코드 연결·실제 요청을 확인했다. 제공 계정으로 20개는 정상 응답, 신규 가입 3개·카카오·실제 비밀번호 변경 5개는 오류 응답까지만 검증했다. 재설정 메일 도착도 사용자가 확인했다. 새 `RoomDetail.bannerUrl`을 DTO·adapter·상세 화면에 연결했고, 서버 캐릭터의 준비 화면 MVP 제한 표시와 작은 아바타 이미지도 수정했다. 이벤트 저장은 실제 **201**, 로그아웃은 **204**로 Swagger의 200과 달랐지만 공통 client에서 정상 처리됐다. 원본 스냅샷 SHA-256은 `7352cc12e5ce3aba3d0d29845a9a86d0fe788de53bde59c365fdf7847d8ae9ef`다.

후속 확인: 사용자가 제공한 「공부 중 캐릭터 반응: 상태 변화와 순간 동작」의 [정책 검토](STATE_AND_INSTANT_ACTION_REVIEW_2026-11-05.md)에 순간 동작 코드 네 가지와 새 호감도·사전 대사 정책을 정리했다. 사용자는 백엔드 반영 예정임을 확인했다. 아래의 현재 동작과 후속 정책 적용을 구분한다.

카카오 후속 자료의 [대조·반영 기록](KAKAO_LOGIN_REVIEW_2026-11-05.md)에 따라 로컬 포트를 3000으로 맞추고, 버튼 주변 약관 안내·callback 오류 복귀·`/password/reset` 경로와 초기 토큰 제거를 적용했다.

## 1. 적용 범위와 근거

- `Front_Web`만 변경했다. `Landing_Page`의 Supabase·Mixpanel 흐름은 별도다.
- 최초 연동 때 공개 OpenAPI가 기존 스냅샷과 동일함을 확인했다. 17개 API 재점검에서는 `KakaoRequest.agreedTermVersionIds` 제거 한 곳이 바뀐 것을 확인하고 DTO·요청·문서 원본을 갱신했다. 나머지 계약은 동일하다.
- 사용자가 제공한 작업 폴더 `API관련/`의 「API 최종」 및 개별 Markdown 문서에서 인증·쿠키·상태 이벤트·시간 정산의 추가 규칙을 확인했다. 이 자료는 Front_Web Git 저장소 밖에 있는 로컬 참고 자료다.
- 사용자가 전달한 백엔드 이미지의 인증·온보딩/홈·공부 시작/이어하기/heartbeat 목록은 변경 없는 연결 대상으로 참고했다.
- 사용자 결정에 따라 **현재 MVP·3분 목표를 유지**, **서버 완성형 아바타 선택을 적용**한다. 후속 자료에서 DROWSY/YAWN/WAVE/HEAD_TURN은 확인했으며, 새 정책을 백엔드에 반영한 뒤 전송을 연결한다. 핸드폰 코드는 미정이다.

## 2. 연결한 흐름

| 기능 | 실제 호출·화면 반영 |
|---|---|
| 약관 | `/terms`의 전문·필수 동의·버전 ID를 가입에 사용 |
| 이메일 가입 | 인증번호 요청 → 6자리 확인 → verificationToken으로 가입. 비밀번호·이메일을 브라우저 저장소에 보관하지 않음 |
| 로그인·재접속 | 실제 로그인 응답의 accessToken, `/me`, 온보딩 여부로 분기. 새로고침은 쿠키 갱신 후 사용자 정보 조회 |
| 카카오 | 버튼 주변 약관 안내·전문 링크 → 클릭 시 state/redirect/복귀 경로 보관 → 인가 화면 → `/oauth/kakao` callback → `{ code, redirectUri }`로 코드 1회 교환. 잘못된 state는 교환 전에 차단, 오류는 로그인 화면으로 복귀 |
| 비밀번호 찾기 | 메일 링크의 `/password/reset?token=...`에서 새 비밀번호 저장. 첫 렌더링 전에 토큰을 메모리로 옮기고 URL에서 제거. 기존 `/reset-password`와 `/login?...&token=...` 진입도 처리 |
| 로그아웃 | 서버의 refresh cookie를 폐기한 후 앱 상태를 비움. 진행 세션을 종료한 것으로 처리하지 않음 |
| 프로필·아바타 | `/avatars`의 서버 ID·썸네일 선택, `PATCH /me`로 저장. 더미 헤어/의상 조합을 저장하지 않음 |
| 홈·룸 | 서버 룸·캐릭터의 실제 숫자 ID, 소개, 썸네일, 오늘 시간과 관계 정보를 사용 |
| 일정 | `GET /me/memories?status=ALL` 조회, 한국어 종류 ↔ 서버 enum 매핑, 생성 응답의 ID로 추가. 날짜 없는 목표도 조회 가능 |
| 공부 시작 | 서버 룸·캐릭터 ID와 `targetMinutes: 3` 전송. 서버 sessionId·시간·목표로 화면 구성 |
| 상태·반응 | `FOCUS/AWAY/RETURN/BREAK` 기록 후 eventId로 서버 대사 요청. 늦게 도착한 이전 상태의 반응은 표시하지 않음 |
| heartbeat | 공부·휴식 화면에서 1분마다 누적 공부/자리 지킴 시간을 전송 |
| 이어하기 | 재접속·새로고침·공부 화면 이탈 후 복귀에 서버 resume 사용. 서버가 넣는 FOCUS를 다시 전송하지 않음 |
| 대화 | 서버 메시지 API, TEXT/QUICK 구분, 최대 300자. 실패한 입력 유지, 동일 내용 재시도 시 같은 requestId 사용 |
| 종료·리포트 | 상태 기록 전송을 마친 뒤 서버에 시간을 보내 정산. 서버 지표·레벨·호감도 값·완료 대사를 사용하고 새로고침 시 다시 조회 |
| 캡슐 카드 | 서버 리포트와 같은 완료 대사·시간을 표시/PNG에 반영. 다음 약속도 실제 일정 API로 저장 |

### 이전 17개 API 재점검 이력

아래 경로는 백엔드 기준이다. 브라우저에서는 같은 경로를 `/api/backend` 프록시를 통해 호출한다. **17개 모두 코드와 화면 연결을 확인했다. 실계정으로 보호 API 전체가 통과했다는 의미는 아니다.**

| 번호 | API | 호출 위치·검증 범위 |
|---|---|---|
| 1 | `GET /api/terms` | DemoProvider의 약관 로드 → 약관 전문·필수 동의. 실제 배포 200·약관 2개 확인 |
| 2 | `POST /api/auth/email/verification` | LoginPage·EmailVerificationForm 요청/재발송. 모의 응답으로 서버 유효 시간 반영 확인 |
| 3 | `POST /api/auth/email/verification/confirm` | EmailVerificationForm. 모의 응답으로 001234 선행 0·verificationToken 확인 |
| 4 | `POST /api/auth/email/signup` | LoginPage. 모의 응답으로 인증 토큰·비밀번호·닉네임·실제 약관 버전 ID 전송 확인 |
| 5 | `POST /api/auth/email/login` | LoginPage → authenticate → /me. 모의 응답으로 실패 입력 유지·성공 이동 확인 |
| 6 | `POST /api/auth/social/KAKAO` | KakaoCallbackPage. 최신 명세의 code/redirectUri만 전송. 모의 응답으로 state·단일 교환·오류 복귀 확인 |
| 7 | `POST /api/auth/refresh` | ApiClient.refresh, 앱 복구와 보호 요청의 401 재시도. 단위 검사로 동시 갱신 1회·실패 로그인 해제 확인. 실제 무쿠키 401 확인 |
| 24 | `POST /api/auth/logout` | DemoProvider.logout. 진행 중인 갱신을 기다린 뒤 쿠키 폐기 요청. 모의 응답으로 서버 응답 후 로그아웃 확인 |
| 8 | `GET /api/me` | DemoProvider.loadUser. 모의 응답으로 서버 신원·온보딩 분기 확인 |
| 9 | `GET /api/avatars` | DemoProvider.loadUser → ServerAvatarPicker. 모의 응답으로 서버 완성형 아바타 표시·선택 확인 |
| 10 | `PATCH /api/me` | ProfileEditor·OnboardingPage → saveProfile. 모의 응답으로 실제 avatarId와 닉네임 저장 확인 |
| 11 | `GET /api/home` | DemoProvider.loadUser·HomePage 갱신. 모의 응답으로 서버 룸 ID·오늘 시간·진행 세션 반영 확인 |
| 13 | `POST /api/me/memories` | MemoryEditor·캡슐 카드 → createMemory. 모의 응답으로 서버 생성 ID를 가진 약속 저장 확인 |
| 14 | `GET /api/me/memories?status=ALL` | DemoProvider.loadUser → 일정 목록. 모의 응답으로 조회·생성 후 재조회 확인 |
| 16 | `POST /api/sessions` | PreparePage·StudyPage → startSession. 모의 응답으로 서버 룸/캐릭터 ID·3분 전송 확인. 사용자가 배포 Swagger에서 3분 시작 성공을 확인했다고 전달함 |
| 17 | `POST /api/sessions/{sessionId}/resume` | StudyPage → resumeSession. 모의 응답으로 같은 탭 새로고침 후 복구·FOCUS 중복 없음 확인. 다른 브라우저 복구는 아래 제약 참고 |
| 21 | `POST /api/sessions/{sessionId}/heartbeat` | useSessionSync, 공부·휴식 중 1분 간격. 가상 시계로 누적 studySeconds/presentSeconds 63/63 전송 확인. 이전 자리 지킴 기준이 없는 복구에서는 본문 생략 |

당시 17개 재점검의 공개 명세는 최초 조회본과 비교해 `KakaoRequest.agreedTermVersionIds` 한 필드만 제거됐다. 이에 맞춰 요청 DTO와 코드 교환 본문을 갱신했고 이메일 가입의 약관 버전 전송은 유지했다. 당시 SHA-256은 `d61611f89dac45fc047716252a317676147a19446bfb60a15ce7d10eb3e23503`이며, 현재 스냅샷은 위의 bannerUrl 추가본으로 교체했다.

기존 localStorage의 더미 로그인·48시간 기록·일정·크레딧을 실행 상태로 읽지 않는다. `DemoProvider`라는 기존 컴포넌트 이름은 유지했지만 초기 상태는 빈 계정·빈 기록이고, 서버 응답으로 채운다. 기존 데모 reducer·샘플 파일은 이전 프로토타입과 테스트용으로 남아 있다.

하드코딩/LLM 전환·샘플 음성 메시지·체험 초기화 메뉴는 현재 제품 흐름에서 제거했다. 자체 OpenAI `/api/chat` 구현은 소스에 남아 있지만 정상 공부 채팅에서 호출하지 않는다. API가 없는 크레딧·상점·누적 기록 메뉴는 기존 MVP 차단을 유지한다.

## 3. 네트워크·인증 구조

```text
브라우저 /api/backend/*
  → 개발·미리보기: vite.config.ts 미들웨어
  → 배포: server/worker.ts
  → server/backend-proxy.ts
  → Railway /api/*
```

- 브라우저는 같은 origin으로 호출하므로 개발·배포에서 같은 API client를 사용한다.
- accessToken은 메모리에만 둔다. refresh_token은 HttpOnly cookie로 유지한다.
- 프록시는 refresh cookie의 Domain을 제거하고 Path를 `/api/backend`로 맞춘다. SameSite=Lax, HTTPS 배포에서는 Secure를 적용한다. 다른 서비스의 브라우저 cookie는 백엔드로 전달하지 않는다.
- 공개 인증 요청에는 bearer를 붙이지 않는다. 보호된 요청이 401이면 현재 탭의 동시 요청을 하나의 refresh로 묶고 한 번 재시도한다. 갱신도 실패하면 로그인 상태를 비운다.
- 204·본문 없는 응답을 JSON으로 읽지 않는다. 네트워크 오류·잘못된 성공 응답·서버 오류를 더미 성공으로 바꾸지 않는다.
- 새로 로그인하거나 로그아웃한 뒤 도착한 이전 사용자 응답이 현재 계정 데이터를 덮어쓰지 않도록 계정 세대를 대조한다.

## 4. 환경 설정

로컬은 `.env.example`을 참고해 `.env.local`을 설정한다.

```dotenv
BACKEND_API_ORIGIN=https://backendlab-production-3052.up.railway.app
VITE_KAKAO_REST_API_KEY=카카오_REST_API_키
VITE_KAKAO_REDIRECT_URI=http://localhost:3000/oauth/kakao
```

`BACKEND_API_ORIGIN`은 공개 백엔드 주소이며 비밀 값이 아니므로 `.env.example`에 적어도 된다. 서버 프록시가 사용하며, 지정하지 않아도 위 Railway origin을 기본으로 사용한다. DB·Redis·JWT 비밀·Kakao Client Secret·메일/LLM 비밀키는 프런트 `VITE_*`에 넣지 않는다. `VITE_KAKAO_REST_API_KEY`에는 백엔드 설정 이름 `CAPSULE_KAKAO_REST_API_KEY`의 실제 공개 REST API 키 값을 사용한다.

카카오 리다이렉트 URI는 현재 접속 origin과 같아야 하고, 개발자 콘솔의 등록 주소와도 정확히 같아야 한다. localhost와 127.0.0.1, 포트가 다르면 다른 origin이다. 로컬과 배포 URI를 카카오 콘솔에 각각 등록하고, 배포 빌드에는 배포 도메인 `/oauth/kakao`를 설정한다. 환경파일 변경 후 개발 서버를 재시작한다.

Cloudflare Worker에서 `/api/backend/*`를 처리하므로 현재 `wrangler.jsonc`를 함께 사용해야 한다. 정적 파일만 호스팅하면 API 프록시가 실행되지 않는다. 배포 origin을 바꿀 때 `BACKEND_API_ORIGIN`은 Worker 서버 변수로 설정한다. 카카오 설정 `VITE_*`는 빌드 환경에 넣는다.

추가 자료에 등록된 로컬 URI가 localhost:3000임을 확인했고, 사용자 선택에 따라 Vite 개발/미리보기 포트와 `.env.local`의 URI를 3000으로 맞췄다. 카카오 콘솔을 직접 조회하거나 실제 계정 로그인 성공을 확인한 것은 아니다. `.env.local`은 Git 무시 대상이며 이 문서는 키 값을 포함하지 않는다.

## 5. 시간·상태 처리

- 10초 미만의 얼굴 미감지는 서버 AWAY를 만들지 않는다. 10초가 지나면 **처음 안 보인 시각**으로 AWAY를 기록한다.
- 실제 얼굴 복귀는 RETURN, 휴식 종료는 FOCUS다. 휴식 때문에 복귀 횟수를 증가시키지 않는다.
- 카메라를 끈 동안은 제공된 API 자료의 정책에 따라 자리 지킴으로 계산한다. 따라서 이전 데모의 “유효 관측 시간 중 얼굴 비율”과 의미가 다르며, 화면도 **자리 지킴률**로 표시한다.
- 휴식은 공부 시간에서 제외한다. 빠른 휴식·재개 조작도 주기 타이머를 기다리지 않고 상태를 기록한다.
- serverTime으로 시계 차이를 보정해 상태 시각을 보낸다. 클라이언트 타이머는 로컬 시간축을 사용하고 API 시각은 UTC ISO 문자열로 전송한다. 일정 날짜·시간은 한국 기준 문자열을 유지한다.
- 실패한 상태 기록은 현재 세션의 대기열에 남기고 후속 상태보다 먼저 다시 보낸다. 종료는 대기 중인 상태 기록이 저장되어야 진행한다. 자동으로 성공한 것으로 처리하지 않는다.
- AWAY 반응은 같은 eventId로 1단계, 1분 후 2단계, 5분 후 3단계를 요청한다. 새 상태나 사용자 대화가 시작되면 이전 상태의 늦은 응답을 표시하지 않는다.
- 리포트에는 서버에 없는 가짜 집중 타임라인·레벨 진행률을 만들지 않는다. 서버의 레벨 전후·다음 레벨 시간·호감도 값은 원본 수치로 표시하며 임의 0~100 클램핑으로 바꾸지 않는다.

## 6. 검증

- 실제 Railway: 공개 명세·Swagger 설정, 약관 200 및 약관 2개, 쿠키 없는 refresh 401/REFRESH_TOKEN_INVALID 확인. 로컬 프록시를 거친 조회와 익명 사용자의 로그인 이동 확인.
- 단위 검사: 기존 테스트와 API client·프록시 cookie/출처·시간/ID adapter·10초 자리 지킴 테스트, 후속 인증 경로·토큰 정리 검사를 실행한다. 명령은 `npm run test`다. 후속 검증 결과는 [카카오 반영 기록](KAKAO_LOGIN_REVIEW_2026-11-05.md)을 따른다.
- 브라우저 API 모의 응답: 로그인 실패 입력 유지, 서버 숫자 ID, 3분 생성, FOCUS와 인사, 메시지 실패/동일 UUID 재시도, QUICK, 빠른 BREAK/FOCUS, 서버 정산, 카드·완료 대사·새로고침, 서버 약속 저장, 로그아웃 확인.
- 브라우저 복구: 공부 중 새로고침 → 이어하기 → FOCUS 중복 없음 확인.
- 브라우저 가상 시계로 1분을 경과시켜 heartbeat 요청과 `studySeconds: 63`, `presentSeconds: 63`의 누적 값 전송 확인.
- 모바일 390px: 메일 요청 → 0으로 시작하는 인증번호 → 인증 토큰/약관 버전으로 가입 → 온보딩 → 서버 아바타 PATCH 확인. 가로 넘침·페이지 JavaScript 오류 없음.
- 카카오 callback 모의 응답: 정상 state는 코드 교환 1회, 잘못된 state는 교환 0회. StrictMode에서 인가 코드를 중복 교환하지 않음.
- 17개 재점검 후 localhost:3000에서 가입/온보딩·기본 세션 흐름·누적 heartbeat·최신 카카오 요청 본문/비밀번호 재설정 검증을 다시 통과했다. 중복 개발 서버의 의존성 캐시 때문에 발생한 화면 모듈 504는 검증용 중복 서버를 종료하고 기존 3000번 서버를 재시작한 뒤 해소됐다. 카카오 요청 본문 수정 후에도 전체 단위 테스트 188개·린트·타입 검사·프로덕션 빌드가 통과했다.
- 타입·린트·빌드·토큰 검사와 `git diff --check` 통과.

위 목록은 이전 모의 검증 이력이다. 이번에는 [전체 점검표](API_AUDIT_2026-11-05.md)에 기록한 보호 API와 재설정 메일 수신까지 실제 확인했다. 실제 카카오 인가·신규 가입·비밀번호 변경·카메라 하드웨어·TTS/Live2D 재생·장시간 운영은 검증하지 않았다.

## 7. 대기·백엔드 확인 항목

| 항목 | 현재 처리·필요한 확인 |
|---|---|
| 순간 동작 | useSessionSync에 전송 연결되어 있다. DROWSY/YAWN/WAVE/HEAD_TURN의 실제 이벤트 201·반응 200·대사를 확인했다. 종류별 1분 제한·휴식/카메라 꺼짐/숨김 게이트는 단위 검사한다. 핸드폰은 전송하지 않는다 |
| 새 호감도 정책 | 초기 50·연속 출석 2일째부터 +1·1분 초과 자리 비움 복귀 시 -1(하루 최대 -3)·복귀 가산 없음. 백엔드 반영 예정이며 프런트 임의 계산 없음 |
| 3분 목표 | 실제 targetMinutes=3 요청으로 테스트 세션 생성 201을 받고 종료했다. 제공된 이전 API Markdown의 5~180분·5분 단위 표기는 현재 동작과 다르다 |
| 다른 브라우저에서 이어하기 | 공개 ResumeResponse에 누적 presentSeconds가 없다. 같은 기기의 계정별 localStorage 복구 기준이 없으면 이전 공부를 보수적으로 처리하고 heartbeat 본문을 생략하며, 종료 시 안내·확인을 거친다. 완전한 기기 간 복구에는 resume의 presentSeconds 추가 필요 |
| 목표 복원 | ReportResponse에 목표 시간이 없다. 같은 탭의 계정별 session metadata가 있으면 표시하고, 없으면 목표 달성률을 만들지 않음. 기기 간 복원에는 report의 targetMinutes/targetSeconds가 필요 |
| 일정 수정·삭제 | API 미제공. 상세 조회만 허용하며 로컬 수정 성공으로 표시하지 않음 |
| 채팅 이력 복원 | 조회 API 미제공. 현재 방문의 수신 메시지만 표시. 새로고침 시 과거 메시지를 만들어 복원하지 않음 |
| Live2D·TTS | 서버 캐릭터의 모델·배치와 expression.file을 쓰는 런타임은 연결되어 있다. 모델이 없거나 실패하면 이미지를 유지한다. 서버 motion 재생·TTS 음성 재생은 미연결이며 현재 요청은 tts=false. 이번 전수조사는 실제 WebGL/표정·음성 재생 성공까지 검증한 것이 아니다 |
| 카카오 실제 로그인·공용 기기 | 콘솔 URI/프로필 동의 설정과 실계정으로 확인 필요. 백엔드 로그아웃은 연결했지만 카카오 계정 자체의 전체 로그아웃은 별도 서버/설정 지원이 필요 |

이 파일을 포함한 API 관련 문서·검토 기록·OpenAPI 스냅샷은 사용자 요청에 따라 Git에서 제외하고 로컬에 보관한다. 실제 환경파일·키·사용자 계정 정보를 문서나 테스트에 복사하지 않는다.
