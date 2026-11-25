# 프런트 연결 갭 분석 · 2026-11-25

작성일: **2026-11-25 (Asia/Seoul)** · 기준: [OpenAPI 2026-11-25](BACKEND_OPENAPI_2026-11-25.json) · 백엔드 `Backend_lab@10a67d1` · 프런트 `docs/api-2026-11-25` 브랜치(분기 기준 `cc6b9df`)

이 문서는 **프런트 코드를 실제 서버에 다시 붙이려면 무엇을 바꿔야 하는지**를 정리한다. API 자체 설명은 [BACKEND_API.md](BACKEND_API.md), 스냅샷 비교는 [OpenAPI 변경표](BACKEND_OPENAPI_DIFF_2026-11-25.md)를 본다.

- 사실의 기준은 OpenAPI와 백엔드 코드 · 명세(`docs/specs/api.md`)다. 프런트 코드에서 확인한 것은 `파일:행`으로 적었다.
- 실제로 호출한 것은 로그인 없이 되는 `GET /api/login-mates`와 `GET /api/terms`뿐이다. 인증이 필요한 동작은 실계정으로 확인해야 한다. 추정은 「추정」이라고 적었다.
- 이 문서는 코드를 바꾸지 않았다. 아래 "고칠 곳"은 연결 작업 때의 제안이다.

## 1. 한눈에 보기

**지금 상태.** 프런트는 11-22 계약(`/api/sessions/*`, `/api/rooms/*`, 목표 시간, 이벤트 8종, `studySeconds`)으로 부른다. 그래서 운영 빌드나 `VITE_DATA_SOURCE=api` 개발 모드로 실제 서버에 붙이면 **로그인 직후 홈 조회에서 앱 전체가 오류 화면이 된다.** 로컬 mock 모드(기본 개발 모드)는 프런트 안의 가짜 서버(`src/features/local-demo/transport.ts`)가 옛 계약으로 답하므로 계속 동작한다.

**바로 깨지는 지점 (우선순위 순).** 자세한 내용은 [2.3](#23-바로-깨지는-지점-우선순위)에 있다.

1. 홈 조회: `/home` 응답에 `rooms`가 없어서 502 처리 → 로그인한 모든 사용자가 앱에 못 들어감
2. 카카오 로그인: `deviceHash`가 없어서 400 → 기존 카카오 사용자도 로그인 불가
3. 온보딩: `onboardingRequired`가 생년월일 조건까지 보게 되어 **베타 전 가입자 대부분이 온보딩으로 감**. 운영 빌드에는 온보딩 완료 기능이 연결돼 있지 않아 거기서 막힘
4. 연결 전 과정: 경로(`/sessions` → `/connections`), 시작 요청(`mateId`), 이벤트 type, heartbeat · 끊기 본문, 응답 필드 이름이 모두 바뀜
5. 오류 코드 이름: `SESSION_ENDED` → `CONNECTION_ENDED` 등. 끝난 연결 처리 · 이어하기 판단이 동작하지 않음

**해소된 백엔드 요청.** 로그인 화면 메이트 공개 API(48), `IDLE_TALK`와 그 크레딧 정책, 메이트 음성 설정(29 · 30)과 음성 대화(28 · 19), 대화 모드 크레딧, 크레딧 · 초대 API(33~36 · 39), 내 메이트(37) · 내 기록(38), 메이트 상세(31) · 모델 형식 · 엔진 주소 필드, 대화방 기록(32), 대화 초기화(47), 생년월일 · 호칭 · 나에 대해, 캠 시간 저장(`cameraOnSeconds`), 대화 수(`messageCount`), 단계 진행률(`stageProgress`). 자세한 표는 [15장](#15-기다리던-백엔드-요청-확인).

**남은 요청.** 운영 데이터에 엔진 주소가 없음(모든 메이트 `engineUrl` null), 엔진 출처(Supabase Storage)가 프런트 허용 목록 밖, `/api/avatars` Live2D 6종(시드는 3종), 남학생 메이트 이름(서버 「서진」 ↔ 프런트 「서도현」)과 중복 데이터, `/me`의 `avatarId`, `farewellLine`, 연결 기록의 `mode` · 이전/다음 단계 이름, 기간별 기록 전체 목록, 약관 본문, 출석 보상 위젯의 n일차 보상표. 자세한 표는 [17장](#17-백엔드--pm에-다시-요청할-것).

**연결 작업 순서 (요약).** ① 공통 · 인증(카카오 `deviceHash`, 오류 코드) → ② 홈 · 메이트 목록(`mates`) → ③ 연결 전 과정(`/connections`) → ④ 온보딩 · 가입 · 프로필 실제 포트 → ⑤ 메이트 상세 · 로그인 메이트 · 모델 → ⑥ 크레딧 · 초대 · 설정 → ⑦ 기록 · 내 메이트 · 대화방 · 초기화 · 알림 · 평가. 자세한 표는 [16장](#16-연결-작업-순서-제안).

## 2. 지금 부르는 엔드포인트와 바뀐 점

### 2.1. 운영 코드가 부르는 엔드포인트

프런트는 `/api/backend` + 경로로 부르고, 같은 출처 프록시(`server/backend-proxy.ts`)가 `/api` + 경로로 넘긴다. 프록시에는 경로 허용 목록이 없어서 새 경로도 그대로 지나간다.

| 프런트 호출 | 코드 위치 | 11-25 상태 | 영향 |
|---|---|---|---|
| `POST /auth/refresh` | `src/shared/api/client.ts:54` | 같음 | 없음 |
| `GET /terms` | `src/features/demo/DemoProvider.tsx:280` | 같음 | 없음. 단 운영 약관 본문이 아직 "본문 준비 중"이라 가입은 계속 막힘(2026-11-25 GET 확인) |
| `POST /auth/email/verification` · `/confirm` | `src/features/auth/components/EmailVerificationForm.tsx:40,55`, `src/pages/LoginPage.tsx:294` | 같음 | `INVALID_CODE`에 `detail.remainingAttempts`가 생김(쓰면 좋음) |
| `POST /auth/email/login` | `src/pages/LoginPage.tsx:307` | 같음 | 없음. 잠금 안내 문구가 "5분"인데 서버는 **10분** (`client.ts:174`) |
| `POST /auth/social/KAKAO` | `src/pages/KakaoCallbackPage.tsx:24-25` | **요청 변경** | `deviceHash` 필수 → 지금 본문 `{code, redirectUri}`는 400 |
| `POST /auth/logout` | `DemoProvider.tsx:301` | 같음(204) | 없음 |
| `POST /auth/password/reset-request` · `/reset` | `src/features/auth/components/PasswordRecoveryForm.tsx:24` | 같음 | 없음 |
| `GET /me` | `DemoProvider.tsx:201` | **응답 변경** | `activeSession` → `activeConnection`, `onboardingRequired` 조건 변경, 새 필드 다수 |
| `PATCH /me` | `DemoProvider.tsx:390` | 요청 필드 추가 | 닉네임 · 아바타 저장은 그대로 동작 |
| `DELETE /me` | `DemoProvider.tsx:314` | 같음(204) | 진행 중이면 409 코드가 `CONNECTION_IN_PROGRESS` |
| `GET /avatars` | `DemoProvider.tsx:171` | 응답 필드 추가 | `model.format` 등 추가. 목록 처리는 그대로 동작 |
| `GET /home` | `DemoProvider.tsx:180-181` | **응답 변경** | `rooms` → `mates`. 지금 코드는 `rooms`가 배열이 아니면 502로 던짐 |
| `GET /rooms/{roomId}` | `DemoProvider.tsx:188, 534` | **삭제** | 404. 홈과 연결 준비가 모두 이 호출에 기대고 있음 |
| `POST /sessions` | `DemoProvider.tsx:606` | **경로 · 요청 · 응답 변경** | → `POST /connections { mateId }`. 응답 `sessionId` · `room` · `character` → `connectionId` · `mate` |
| `POST /sessions/{id}/resume` | `DemoProvider.tsx:569` | **경로 · 응답 변경** | → `/connections/{id}/resume`. `studySeconds` · `breakSeconds` → 누적값 4개 |
| `POST /sessions/{id}/events` | `src/features/backend/use-session-sync.ts:124, 154, 175` | **경로 · 허용 type · 응답 변경** | `FOCUS` · `BREAK` · 동작 4종은 400. 응답 `characters[]` → `reaction` |
| `POST /sessions/{id}/events/{eid}/reaction` | `use-session-sync.ts:98` | **경로 변경** | 응답에 `charged` · `credits` 추가 |
| `POST /sessions/{id}/heartbeat` | `use-session-sync.ts:242` | **경로 · 요청 · 응답 변경** | 본문 `{studySeconds, presentSeconds}`는 400 `INVALID_CONNECTION_TIME`. 응답 204 → 200 본문 |
| `POST /sessions/{id}/messages/stream` | `src/features/backend/message-stream.ts:60` | **경로 변경** | `done`에 `mode` · `charged` · `credits` · `safety` · `background` · `voice` 추가, `audio` 이벤트 생김 |
| `POST /sessions/{id}/messages` | `message-stream.ts:81` | **경로 변경** | 위와 같음 |
| `POST /sessions/{id}/end` | `DemoProvider.tsx:651` | **경로 · 요청 · 응답 변경** | 본문 400. 응답 `sessionId` · `character` · `studySeconds` → `connectionId` · `mate` · `connectedSeconds` |
| `GET /sessions/{id}/report` | `DemoProvider.tsx:740` | **경로 변경** | → `GET /connections/{id}` (접미사 없음) |

개발 전용 화면 검토 코드(`src/features/review/**`)는 `POST /auth/email/signup`과 `/me/memories`를 부르지만 운영 번들에 들어가지 않는다(`src/main.tsx:13`).

### 2.2. 로컬 mock이 흉내 내는 경로

`src/features/local-demo/transport.ts`는 옛 계약 모양으로 답한다. 실제 서버와 같아지려면 이 파일도 같이 바꿔야 mock 모드와 실서버 모드가 같은 코드 경로를 쓴다.

| mock 경로 | 11-25 서버 | 차이 |
|---|---|---|
| `/terms`, `/auth/*`, `/me`(GET · PATCH · DELETE), `/avatars` | 있음 | `/me` 응답에 `activeConnection` · `credits` 등 없음, 로그인 응답에 `onboardingRequired` 규칙 다름 |
| `/home` → `{ rooms, activeSession, todayStudySeconds }` (`transport.ts:103`) | `{ mates, lastMate, activeConnection, todayPresentSeconds, todayConnectedSeconds }` | 모양 전체 |
| `/rooms/{id}` (`transport.ts:104`) | **없음** | 삭제 |
| `POST /sessions { roomId, characterId, targetMinutes }` (`transport.ts:107`) | `POST /connections { mateId }` | 경로 · 요청 · 응답 |
| `/sessions/{id}/resume · heartbeat · end · report · events · events/{id}/reaction · messages · messages/stream` (`transport.ts:114-157`) | `/connections/{id}/…`, 기록은 `GET /connections/{id}` | 경로 · 본문 · 응답 · 오류 코드(`SESSION_ENDED`, `INVALID_STUDY_TIME`) |
| 없음 | 29~48 | 크레딧 · 초대 · 기록 · 메이트 · 설정은 mock 포트(`src/features/local-demo/ports.ts`, `store.ts`)가 경로 없이 직접 값을 준다 |

### 2.3. 바로 깨지는 지점 (우선순위)

"증상"은 실제 서버 모드에서의 예상이다(코드로 판단, 실행 확인 전).

| 순위 | 지점 | 증상 | 원인 (서버 근거) | 고칠 곳 |
|---|---|---|---|---|
| **P0-1** | 홈 조회 | 로그인 직후 "홈 정보를 확인하지 못했어요." 앱 전체 오류. 메이트 목록 0명 | `/home`에 `rooms` 없음(→ `mates`), `/rooms/{id}` 삭제 | `DemoProvider.tsx:178-191` `loadHome`, `src/features/mates/catalog.ts:88` `availableMates`(rooms 기준 → `mates[]` 기준), `src/features/backend/adapters.ts:43` |
| **P0-2** | 카카오 로그인 | 카카오 인가 뒤 400 → 로그인 화면으로 | `KakaoRequest.deviceHash` 필수, 카카오 호출 전에 검사 (`user/service/AuthService.java:189`) | `KakaoCallbackPage.tsx:24`. 기기 값 생성 유틸이 아직 없음(`deviceHash` 검색 0건) |
| **P0-3** | 온보딩 | 생년월일이 없는 계정(카카오 가입자 · 11-23 전 가입자)은 로그인하면 온보딩으로 가고, 완료 버튼이 "요청을 처리하지 못했어요." | `onboardingRequired` = 아바타 **또는 생년월일** 없음 (`api.md` 8). 운영 빌드는 `accountPort`가 없어 `completeOnboarding`이 null (`src/app/bootstrap.tsx:21`, `src/pages/OnboardingPage.tsx:397`) | 실제 `BetaAccountPort` 구현(`PATCH /me { avatarId, birthDate, … }`) |
| **P0-4** | 연결 시작 · 이어하기 | 메이트 연결 실패(404). 경로를 고쳐도 응답 검사에서 502 | 경로 `/connections`, 요청 `{mateId}`, 응답 `connectionId` · `mate` (`StartResponse` · `ResumeResponse`) | `DemoProvider.tsx:569-570, 606-608`, `adapters.ts:62-67`(`dto.room` · `dto.character`), `src/shared/api/types.ts` 전체 |
| **P0-5** | 상태 이벤트 | 연결 시작 직후 `FOCUS`가 400, 쉬기 `BREAK` · 동작 이벤트 400. 반응이 안 옴 | type 4종(`PRESENT` · `AWAY` · `RETURN` · `IDLE_TALK`, `session/domain/SessionEvent.java:32`). 응답 `reaction`(문자열 표정) | `use-session-sync.ts:282`(시작 `FOCUS` → `PRESENT`), `src/features/backend/presence-clock.ts:21-35`, `src/features/backend/session-event-flow.ts:8`, `src/features/backend/motion-events.ts`(서버로 안 보냄) |
| **P0-6** | heartbeat · 연결 끊기 | heartbeat 400(생존 신호는 갱신됨), **끊기 400 → 연결이 안 끝남** | 본문 누적값 4개 필수 + 검사 (`HeartbeatRequest` · `EndRequest`) | `use-session-sync.ts:241`, `DemoProvider.tsx:650`, 측정값: PIP 시간 · 카메라 켠 시간 집계 필요 |
| **P0-7** | 끊기 · 기록 응답 검사 | 서버는 정상 종료했는데 프런트가 "연결 기록을 확인하지 못했어요."(502) | `ReportResponse.sessionId` · `character` 삭제 → `connectionId` · `mate` | `DemoProvider.tsx:652, 742`, `adapters.ts:75-78` |
| **P1-1** | 끝난 연결 처리 | 서버가 연결을 끝냈는데 프런트가 알아채지 못하고 계속 재시도 | `SESSION_ENDED` → `CONNECTION_ENDED` | `DemoProvider.tsx:580`, `use-session-sync.ts:85,106,165,186`, `message-stream.ts:18`, `src/pages/ConnectionPage.tsx:372,399`, `src/pages/StudyPage.tsx:207` |
| **P1-2** | 이어하기 판단 | 진행 중 연결 팝업이 안 뜸. 중복 시작 시 이어하기로 못 감 | `/me` · `/home`의 `activeSession` → `activeConnection`(`connectionId` · `mateId` · `mateName`), 409 `CONNECTION_ALREADY_IN_PROGRESS` + `detail.connectionId` | `DemoProvider.tsx:237-240, 337`, `src/pages/PreparePage.tsx:103-106`, `connectMate`의 `characterName` 비교 |
| **P1-3** | 오류 문구 표 | 새 코드가 일반 문구로 나옴 | 새 코드 20여 개(`UNDER_14` · `BETA_FULL` · `CREDIT_INSUFFICIENT` · `CHAT_SUSPENDED` · `MINOR_DAILY_LIMIT` · `MATE_COMING_SOON` · `REFERRAL_*` …) | `client.ts:168-189` |
| **P1-4** | 메이트 모델 | v2 메이트가 정지 이미지로만 보임 | 운영 `engineUrl` 모두 null(2026-11-25 48 응답). 엔진이 생겨도 Supabase 출처는 허용 목록 밖 | `src/features/mate-render/mate-source.ts:34` `isAllowedEngineUrl`, 백엔드 데이터 등록 |
| **P1-5** | 남학생 메이트 | 서버 메이트 「서진」이 프런트 목록에서 빠짐 | 프런트 이름 매핑은 `서도현` · `도현`만 (`catalog.ts:75-78`) | 이름 확정 후 매핑(또는 id 기준 매핑) |
| P2-1 | 친밀도 진행 막대 | 막대가 늘 가득 참 | `stageProgress`가 **0~100**, 프런트는 0~1로 자름 (`src/features/mates/affinity-progress.ts:14`) | ÷100 |
| P2-2 | 모델 형식 값 | 지금은 동작(주소 끝으로 판정) | `format: "ALIVING2D_V2"`를 `normalizeFormat`이 모름 (`mate-source.ts:82-86`) | `aliving2d_v2` 추가 |
| P2-3 | 하루 경계 | 오전 0~5시 연결이 다른 날로 보임 | 서버 하루는 오전 5시 기준(38 · 11 · 크레딧) | 기록 · 홈의 날짜 계산 |
| P2-4 | 로그인 잠금 문구 | "5분 뒤" 안내가 틀림 | 서버 10분 (`api.md` 5) | `client.ts:174` |

## 3. 로그인 졸던 채린 · 48

| 항목 | 확인 결과 |
|---|---|
| 공개 API | `GET /api/login-mates`. **로그인 없이**, 같은 IP 1분 60번, `Cache-Control: public, max-age=300` (`content/controller/LoginMatesController.java`) |
| 고르는 기준 | 공개(준비 중 아님) · 활성 · 전연령(`ALL`) · 모델이 있는 메이트, 정렬 순서 |
| 응답 필드 | `id` · `name` · `ageRating` · `cardImageUrl`(정지 이미지) · `model`(`format` · `modelJsonUrl` · `scale` · `offsetX` · `offsetY` · **`engineUrl` · `playerUrl` · `reactionsUrl`**) |
| 모델 URL · 엔진 URL 필드 | **있다.** 다만 2026-11-25 운영 응답에서 4명 모두 엔진 3필드가 **null** |
| 메이트 상세(31)와 같은 URL인가 | **같다(코드 확인).** 48은 `MateQuery.activeMates()`의 `MateInfo.model()`을 그대로 넘긴다(`LoginMatesController.view`). 31도 같은 `ContentMapper.model()`에서 나온다. 주소에 쿼리 · 서명이 없다(`api.md` 48 "문자 하나까지 같은 값") |
| 연결 화면(16 · 17)과 같은가 | 같은 매퍼(`ContentMapper.model`)에서 나와 `Figure`로 펼쳐진다. 같은 값일 것으로 본다(추정, 실호출 미확인) |
| 예열 인계 조건 | 로그인 화면 모델을 앱 화면에 넘기는 키(`warmKey(source)`)가 모델 · 엔진 주소로 만들어진다면, 48과 31의 주소가 같아서 **인계 조건을 만족한다.** 단 지금 운영값은 엔진이 null이라 v2 렌더러가 만들어지지 않는다(정지 이미지) |

**2026-11-25 운영 응답** (`<CDN>` = Supabase Storage 공개 버킷)

| id | 이름 | format | modelJsonUrl | cardImageUrl |
|---|---|---|---|---|
| 1 | 말포이 | `CUBISM` | `<CDN>/live2d-model/chaerin/v3/chaerin.model3.json` | null |
| 2 | 서진 | `ALIVING2D_V2` | `<CDN>/live2d-model/seojin/v5/model.json` | 있음 |
| 3 | 서진 | `ALIVING2D_V2` | `<CDN>/live2d-model/seojin/v4/model.json` | null |
| 4 | 채린 | `ALIVING2D_V2` | `<CDN>/live2d-model/chaerin/v5/model.json` | 있음 |

**프런트 연결에 필요한 것**

1. 지금 로그인 화면은 운영에서 모델을 받지 않는다. `src/features/auth/login-backgrounds/desktop/login-mate-source.ts:58` `localModels()`가 개발 모드에서만 로컬 모델을 넣는다. 48을 읽어 `LoginMateProfile.model` · `v2Model`을 채우는 코드가 필요하다.
2. 엔진 주소가 오면 출처 검사 `isAllowedEngineUrl`(`mate-source.ts:34`)이 페이지 출처와 `VITE_API_BASE_URL` 출처만 허용한다. 엔진은 Supabase Storage 출처라 **정지 이미지로 대체된다.** 허용 목록에 CDN 출처를 더해야 한다(백엔드 명세 48도 같은 안내).
3. 로그인 화면 후보는 채린만 쓴다. 48은 말포이 · 서진 2개 · 채린을 준다. 「채린」만 고를지, 목록을 번갈아 쓸지 정해야 한다. 서버 데이터 정리(아래 17장)도 필요하다.
4. 응답이 5분 공개 캐시지만, 프런트 프록시가 `cache-control: no-store`로 바꾼다(`server/backend-proxy.ts`). 필요하면 프록시에서 이 경로만 캐시 헤더를 넘긴다.

## 4. 설정 탭 T-1~T-10 · 29 · 30

프런트 설정은 지금 브라우저 계정별 저장이다(`src/features/mates/connection-preferences.ts:29`, `PipSpeechPreference`). 서버 저장 가능 여부:

| 항목 | 프런트 키 · 값 | 서버 키 · 값 (기본) | 서버 저장 | 서버가 쓰는 곳 |
|---|---|---|---|---|
| T-1 말 걸기 빈도 | `talk`: `quiet` · `sometimes` · `often` | `talkFrequency`: `QUIET` · `SOMETIMES` · `OFTEN` (`SOMETIMES`) | **가능** | 저장만. 타이머는 프런트, 간격 3분 · 1분은 프런트 값(`src/features/backend/idle-talk.ts`)과 같음 |
| T-2 메이트 음성 | `voice`: boolean | `voiceEnabled` (true) | **가능** | 19 · 28 음성 켜짐 조건. 끄면 보이스 차감 없음 |
| T-3 음성 볼륨 | `volume`: 0~100 | `voiceVolume` 0~100 (70) | **가능** | 저장만(재생은 프런트) |
| T-4 음성 속도 | `speed`: `slow` · `normal` · `fast` | `voiceSpeed`: `SLOW` · `NORMAL` · `FAST` (`NORMAL`) | **가능** | 서버 TTS 속도에 반영(`dialogue/service/VoiceStreams.java:53`). 프런트 재생 속도와 **이중 적용**되지 않게 해야 함 |
| T-5 마이크 · 카메라 | 브라우저 기기 선택 | 없음 | 불가(의도) | 서버 설정 아님 (`api.md` 29 "브라우저에 저장") |
| T-6 PIP 말풍선 | `PipSpeechPreference` boolean | `pipBubble` (true) | **가능** | 저장만 |
| T-7 대화 모드 기본값 | `mode`: `basic` · `advanced` | `defaultMode`: `BASIC` · `ADVANCED` (`BASIC`) | **가능** | 저장만. 실제 모드는 매 요청 `mode` |
| T-8 스페이스 누른 채 말하기 | `holdToTalk` | 없음 | 불가(의도) | 단축키는 브라우저 저장 |
| T-9 PIP 창 크기 | `pipSize`: `small` · `normal` · `large` | `pipSize`: `S` · `M` · `L` (`M`) | **가능** | 저장만 |
| T-10 시선 따라오기 | `gaze` | 없음 | 불가 | 서버에 키 없음. 브라우저 저장 유지 |

- 30은 **보낸 키만** 바꾸고 모르는 키는 400 `INVALID_SETTINGS`다. 프런트 키를 그대로 보내면 안 되고, 위 대응으로 바꿔 보낸다. `null`은 기본값 복원.
- 16 연결 시작 응답 `settings`에 같은 7개가 온다. 연결 화면은 29를 따로 부르지 않아도 된다.
- 기본값이 프런트와 서버 모두 같다(말 걸기 가끔, 음성 켬, 볼륨 70, 보통, PIP 말풍선 켬, 기본 모드, 보통 크기).
- T-2의 "준비 중" 배지(`src/features/profile/components/ConnectionSettingsPanel.tsx`)는 서버 음성이 있으니 뗄 수 있다. 단 서버의 기본 음성 공급자는 무음 mp3를 주는 가짜이고, 운영 설정은 저장소로 확인할 수 없다(확인 필요).

## 5. 크레딧 화면 · 33 · 34

| 화면 값 | 서버 필드 |
|---|---|
| 오늘 남은 크레딧(GNB · 연결 상단) | `Credits.todayRemaining` — 8 `/me`, 16, 20 · 28 `credits`, 19(`tts` 때), 33 |
| 남은 출석분 · 소멸 시각 | `attendanceRemaining` · `attendanceExpiresAt`(다음 오전 5시) |
| 초대 크레딧 | `inviteBalance` |
| 오늘 쓴 크레딧 | 33 `todayUsed` |
| 친구 n명 초대 | 33 `invitedFriends` |
| 부족 · 소진 경고 | `low`(< 100) · `exhausted`(= 0) |
| 출석 토스트 | `attendanceGrantedNow` (그날 처음 크레딧을 읽은 요청에서만 true. 보통 8 `/me`) |
| 내역 표 | 34 `items[]`: `id` · `type`(`ATTENDANCE` · `INVITE` · `USE` · `EXPIRE`) · `title` · `change` · `balanceAfter` · `createdAt`, 커서 `nextCursor`, 필터 `ALL` · `ATTENDANCE` · `USE` · `INVITE` |

- **OpenAPI 주의:** 34의 `items` 스키마가 알림 항목(`Item`) 모양으로 잘못 나온다. 실제 필드는 위 표다(`credit/dto/CreditTransactionsResponse.java:10`). 타입을 OpenAPI에서 자동 생성하면 틀린다.
- 차감 단가는 프런트 `CREDIT_PRICING`(`src/features/credits/credit-utils.ts:4`)과 서버가 같다: 출석 1,500 · 초대 1,000 · 최대 10명 · 기본 0 · 보이스 20 · 고급 30.
- 고급 모드가 모자라면 20 · 28이 409 `CREDIT_INSUFFICIENT`(`detail.credits`). 보이스가 모자라면 오류 없이 글만 온다(`done.voice` false).
- **출석 보상 위젯과 충돌.** 홈 출석 위젯은 6일 주기 n일차 보상(300 · 100 · 500 · 100 · 700 · 100)을 브라우저 mock으로 보여 준다(`src/features/attendance/attendance-config.ts:11`, `attendance-service.ts`). 서버는 **매일 1,500 고정, 체크인 API 없음**(`/me` 조회 때 자동 지급)이다. 위젯을 서버 규칙(매일 1,500, `attendanceGrantedNow`)으로 바꿀지, 서버에 주기 보상을 요청할지 PM 결정이 필요하다.
- 운영에서 지금 크레딧 화면은 `wallet: null`이라 "불러오지 못했어요"만 보인다(`BetaFeaturePort` 미연결). 33 · 34로 실제 포트를 만들면 된다.

## 6. 친구 초대와 가입 2단계 초대 코드 · 35 · 36 · 39

| 화면 | API | 비고 |
|---|---|---|
| 초대 링크 랜딩 · 가입 화면의 코드 '확인' (로그인 전) | 39 `GET /api/referrals/{code}` → `inviterNickname` · `rewardOnFirstConnection` | **로그인 없이**, 같은 IP 1분 30번. 자기 코드 · 7일 · 이미 입력은 여기서 보지 않음 |
| 가입 뒤 코드 등록 (가입 마지막 단계 · 친구 초대 화면) | 36 `POST /api/referrals { code, deviceHash }` → 201 | **로그인 필요.** 가입 요청(4)에는 초대 코드 필드가 없다 |
| 친구 초대 화면 | 35 `GET /api/referrals/me` → `code` · `link` · `rewardedCount` / `maxRewards` · `rewardedCredits` · `friends[]` · `canEnterCode` · `codeInputDeadline` | 링크는 `https://capsule.ai.kr/i/<code>` (서버 설정) |
| 내 코드 | 8 `/me` `referralCode`도 있음 | |

- **가입 흐름이 바뀐다.** 프런트 `BetaAccountPort.signup`은 `referralCode`를 가입 입력에 함께 받는다(`src/features/auth/beta-account.ts`, `DemoProvider.tsx:460`). 서버는 가입(4) 뒤 토큰을 받고 36을 따로 불러야 한다. 실제 포트에서 "가입 → 36" 두 단계로 나누고, 36 실패(`REFERRAL_SELF` · `REFERRAL_SAME_DEVICE` · `REFERRAL_CODE_NOT_FOUND` · `REFERRAL_EXPIRED`)가 가입 자체를 실패로 만들지 않게 해야 한다.
- 초대 링크 주소: 서버는 `/i/<code>`를 만든다. 프런트는 `?ref=<code>`를 읽는다(`src/main.tsx:6` `captureReferralFromLocation`). `/i/:code` 경로를 받는 라우트가 필요한지 확인해야 한다.
- 보상은 코드 입력 뒤 **처음 끝나는 연결(22)**에서 준다. 22 · 23 `referralReward`로 연결 기록에 보상을 띄울 수 있다.
- 지금 프런트는 코드 검사를 mock으로만 한다(`simulateMockReferralValidation`). 운영 `validateReferralCode`는 null이다.

## 7. 내 기록 · 38

| 화면 | 38 필드 |
|---|---|
| 기간 탭 주 · 월 · 년 | query `range` = `WEEK`(월~일) · `MONTH` · `YEAR` (**필수**), `date` 기준일 |
| 함께한 시간 · 연결 시간 합 | `totalPresentSeconds` · `totalConnectedSeconds` |
| 연결한 날 · 횟수 | `connectedDays` · `connectionCount` |
| 달력(캡슐 칸) · 막대 | `buckets[]` `key`(일 `YYYY-MM-DD`, 년은 월 `YYYY-MM`) · 시간 2개. 빈 칸도 0으로 옴 |
| 메이트별 (SCR-26) | `mates[]` + query `mateId`로 한 메이트만 |
| 최근 연결 | `recent[]` 5개 → 누르면 23 |

- 지금 프런트 기록 화면은 이 브라우저에 남은 서버 기록 캐시와 mock을 합산한다. 38로 바꾸면 다른 기기에서도 같은 값이 나온다.
- **카메라 시간:** 서버 `presentSeconds`는 이제 "카메라가 켜져 있고 얼굴이 보인 시간"(함께한 시간)이고, 연결 기록에 `cameraOnSeconds`도 저장된다. 11-22 문서가 기다리던 "캠으로 확인한 함께한 시간 서버 저장"이 해소됐다. 단 프런트가 heartbeat · 끊기에 이 값을 정확히 보내야 한다(P0-6).
- **하루 경계:** 서버는 오전 5시(KST) 기준, 연결은 시작한 날에 센다. 프런트는 자정 기준으로 그린다(`docs/DESIGN_CHANGE_NOTICE_BACKEND.md` 10). 서버 기준을 따를지 정해야 한다.
- **남은 갭:** 기간 안의 연결 **전체 목록**은 없다(`recent` 5개뿐). 화면이 기간별 목록 · 페이지를 보여 준다면 백엔드에 요청해야 한다.

## 8. 내 메이트 · 37

| 화면 | 37 `mates[]` 필드 |
|---|---|
| 메이트 카드 · 순서 | `id` · `name` · `cardImageUrl`, 마지막 연결이 최근인 순. 끝난 연결이 없는 메이트는 빠짐 |
| 처음 만난 날 · 연결 횟수 · 누적 시간 | `firstMetAt` · `connectionCount` · `totalPresentSeconds` · `totalConnectedSeconds` |
| 친밀도 단계 · 다음 단계 · 진행 막대 | `relation.stage` · `stageName` · `nextStageName` · `nextStageSeconds` · `stageProgress`(**0~100**) |
| 표정 · 보이스 컬렉션 | `unlocks[]` `id` · `type`(`EXPRESSION` · `VOICE_LINE`) · `title` · `unlockStage` · `unlockStageName` · `expressionName` · `assetUrl` · `unlocked` |
| 최근 기록 | `recent[]` 5개 `connectionId` · `endedAt` · `presentSeconds` · `connectedSeconds` (OpenAPI 표기는 38 모양으로 잘못 합쳐짐) |

- 지금은 연결 기록들을 모아 계산한다(`src/features/mates/my-mates-utils.ts`). 37로 바꾸면 계산 코드를 걷어낼 수 있다.
- 해금 표정 이름 `expressionName`은 메이트 모델의 표정 이름이어야 한다. 채린 · 서진 v2 모델에서 어떤 값이 오는지는 실데이터로 확인해야 한다(서버 예시는 `shy`). 프런트 대응표(`src/features/mate-render/expression-map.ts`)로 받을 수 있는지 확인한다.
- 남은 갭: 해금 항목의 "열린 날짜", "잠김 조건 문구"는 없다(프런트 요청서 09에 있었음). `unlockStageName`으로 "○○ 단계에서 열려요"는 만들 수 있다.

## 9. 메이트 상세와 모델 계약 · 31

| [MATE_MODEL_V2_CONTRACT](MATE_MODEL_V2_CONTRACT.md) 필드 | 서버 31 `model` | 차이 |
|---|---|---|
| `modelJsonUrl` (필수) | 있음 | 같음 |
| `format` `'aliving2d'` · `'cubism'` (선택) | `ALIVING2D_V2` · `CUBISM` | 값 이름이 다름. 프런트는 지금 모르는 값으로 보고 주소 끝으로 판정한다(동작은 함). `aliving2d_v2`를 받게 하면 됨 |
| `engineUrl` (v2면 필수) | 있음, 없으면 null | **운영값 null** → 정지 이미지. 출처 허용 목록도 필요 |
| `playerUrl` · `reactionsUrl` (선택) | 있음 | 같음 |
| `scale` · `offsetX` · `offsetY` | 있음 | 같음(v2는 프런트가 무시) |

| 프런트 `MateDetailContent` (`src/features/mates/mate-contract.ts`) | 서버 31 | 비고 |
|---|---|---|
| `characterId` | `id` | 메이트 id = 캐릭터 id |
| `introduction` · `description` · `role` · `intro` | `oneLiner` · `world` · `myRole` · `intro` | 이름 대응 필요 |
| `tags` | `hashtags` | |
| `voiceSampleUrl` | `voiceSampleUrl` | 대화 음성과 같은 목소리 (ADR 0036) |
| `model` | `model` | 위 표 |
| `farewellLine` | **없음** | 남은 요청 |
| `conversationRevision` | **없음** | 서버 초기화는 revision 없이 동작 (13장) |
| — | `illustrationUrl` · `ageRating` · `comingSoon` · `hasConversation` | 새로 쓸 수 있음 (`comingSoon`이면 연결 막기, `hasConversation`이면 32로 이전 대화) |

- 운영 빌드는 `matePort`가 없어 상세를 서버에서 읽지 않는다(`loadMateDetail: null`, `DemoProvider.tsx:759`). 31로 실제 `MateContentPort.load`를 만들면 된다.
- 연결 화면도 같은 필드를 16 · 17의 `mate`(`Figure`)로 받는다. 2단계 계약(`character` → `mate`)이 이름만 바뀌어 해소됐다.
- 메이트 연령: 서버 `ageRating`은 `ALL` · `ADULT` 두 값이다. 프런트 카탈로그의 서도현 `ageRating: '15'`(15세 이용가)는 서버에 없는 값이다. 서버 운영값은 서진 둘 다 `ALL`.

## 10. 채팅 기록 · 32

- `GET /api/mates/{mateId}/messages?cursor=&size=`(기본 20, 최대 50). 최신순, 이전 연결까지. 메시지는 `requestId`(사용자 말과 답장이 같은 값) · `sender`(`USER` · `MATE`) · `content` · `inputType` · `rating` · `createdAt` · `connectionId`.
- 연결이 끝나도 메시지를 지우지 않는다(2026-11-23 변경). 11-22 갭 문서의 "종료 요약 뒤 원문 삭제" 문제가 해소됐다.
- 답장을 못 받은 사용자 말, 신고(41)한 답장, 초기화(47)한 대화는 나오지 않는다.
- 프런트는 지금 이 브라우저의 메시지 캐시만 보여 준다. 채팅 패널을 열 때 32를 부르고, 31 `hasConversation`이 true면 이전 대화를 불러오게 바꾼다.

## 11. 알림 · 43 · 44

- 43 `GET /api/notifications?before=&size=` → `items[]`(`id` · `type` · `title` · `body` · `link` · `read` · `createdAt`) · `unreadCount` · `nextBefore`. 90일 지난 알림은 빠짐.
- `type`: `STAGE_UP`(→ `/mates/me`) · `ATTENDANCE`(→ `/credits`) · `REFERRAL_REWARD`(→ `/credits/invite`). 운영 공지 · 메이트 공개 알림은 아직 없음.
- 44 `POST /api/notifications/read { ids? }` → `{ unreadCount }`. `ids`가 없으면 전부.
- GNB 벨 점: 8 `/me` `unreadNotifications`.
- **프런트에 알림 화면이 아직 없다**(벨 · 목록 UI 검색 0건). 화면부터 필요하다.
- 링크 차이: 서버 `REFERRAL_REWARD` 링크는 `/credits/invite`, 프런트 친구 초대 경로는 `/credits/charge`다(`src/app/PageNavigation.tsx:10`). 경로를 맞추거나 링크를 바꿔 읽어야 한다.

## 12. 메시지 평가 · 신고 · 40 · 41

- 40 `PUT /api/messages/{requestId}/rating { rating: UP | DOWN | null }` → 204. 다시 누르면 덮어씀, null은 취소. 대화방 기록(32)의 `rating`에 남음.
- 41 `POST /api/messages/{requestId}/report { reason, detail? }` → 201 `{ reportId }`. `reason`: `INAPPROPRIATE` · `VIOLENT` · `OUT_OF_CHARACTER` · `OTHER`(이때 `detail` 필수, 300자 이하). 이미 신고했으면 409 `ALREADY_REPORTED`.
- 경로 값 `requestId`는 **메이트 답장**의 `requestId`(20 · 28에서 프런트가 만든 UUID, 32의 값)다. 프런트 메시지는 이미 `requestId`를 갖고 있다(`DemoProvider.tsx` `sendMessage`).
- **프런트에 평가 · 신고 UI가 없다.** 화면부터 필요하다(SCR-54).

## 13. 대화 초기화 · 47

| | 프런트 계약 (`mate-contract.ts` `resetConversation`) | 서버 47 |
|---|---|---|
| 요청 | `{ userId, characterId, expectedRevision }` | `POST /api/mates/{mateId}/conversation/reset` 본문 없음 |
| 응답 | `MateResetReceipt { previousRevision, revision, cleared: [messages, memory, intimacy, unlocks] }` | **204 본문 없음** |
| 지우는 범위 | 대화 기록 · 기억 · **친밀도 · 해금** | 대화방 기록 가림 · 지난 대화 카드 · 기억한 사실. **친밀도 · 호감도 · 해금 · 크레딧은 그대로** |
| 충돌 | `CONVERSATION_REVISION_CONFLICT` 등 전용 409 기대 | 409 `CONNECTION_IN_PROGRESS`(이 메이트와 연결 중)만 |

- 프런트는 "네 범위를 모두 확인한 응답 뒤에만 캐시를 지운다"고 설계돼 있다(11-22 갭 문서). 서버는 범위가 다르고 영수증이 없으므로, **204를 받으면 대화 · 기억 캐시만 지우고 친밀도 · 해금은 유지**하도록 계약을 바꿔야 한다. 확인 창 문구(무엇이 지워지는지)도 서버 범위에 맞춰야 한다(PM 확인).
- 백엔드도 "사용자 버튼인지, 안전 제재 단계인지"를 확정 필요로 남겼다(`api.md` 47).

## 14. 그 밖의 새 API

| API | 프런트 화면 | 상태 |
|---|---|---|
| 4 가입 `birthDate` · `deviceHash` | 가입 폼(생년월일 입력은 이미 있음) | 실제 가입 포트 필요. `deviceHash` 생성 필요. 약관 본문이 아직 준비 중이라 가입은 서버 약관 게시 후 |
| 10 `birthDate` · `honorific` · `aboutMe` | 온보딩 · 프로필(호칭 · 나에 대해 입력은 이미 있음) | 프런트 `callName` = 서버 `honorific`. 길이: 호칭 1~10자, 나에 대해 0~50자 |
| 16 `firstMeet` · `greeting` · `relation` · `minorRemainingSeconds` · `backgrounds` | 연결 화면 첫 만남 · 인사 · 상단 바 · 청소년 남은 시간 · 배경 | 새로 연결 |
| 21 `stageUp` | 연결 중 '새 표정이 열렸어요' (SCR-56) | 새로 연결 |
| 22 `endType` `AUTO_AWAY` · `MINOR_LIMIT` | 자동 끊기 · 청소년 3시간 | 프런트 자동 종료 흐름에 연결 |
| 22 · 23 `betaFeedbackAvailable` + 42 | 연결 기록 위 평가 카드(SCR-55) · 설정 '의견 보내기' | 화면 필요 여부 확인 (프런트에 없음) |
| 45 출시 알림 신청 | 정원 초과 화면(SCR-46) | 4 · 6의 403 `BETA_FULL` 처리 화면이 없음 |
| 46 메이트 공개 알림 | 준비 중 메이트 '알림 받기'(SCR-53) | 프런트에 없음 |
| 20 · 28 `safety` · 403 `CHAT_SUSPENDED` | 안전 경고 · 대화 정지(SCR-36) | 프런트에 없음 |
| 20 · 28 `background` | 연결 배경 바꾸기 | 새로 연결 |
| 28 `audio` · `audio_end` | 음성 답장 재생 | SSE 파서(`src/shared/api/sse.ts`)가 새 이벤트를 받아야 함 |

## 15. 기다리던 백엔드 요청 확인

| 요청 (출처) | 결과 | 근거 |
|---|---|---|
| 로그인 전 메이트 모델 공개 API ([변경 통보 01-요청 1](DESIGN_CHANGE_NOTICE_BACKEND.md)) | **해소됨 (API 48)** — 모델 · 엔진 URL 필드 있음, 31과 같은 값. 운영 엔진값은 null | 3장 |
| 표정 의미 매핑 (변경 통보 01-요청 1) | 부분 해소 — 서버가 반응마다 표정 이름(`expression`)을 보냄. 별도 매핑 표는 없음 | `api.md` 9 · 19 |
| `/api/avatars`의 Live2D 6종 `model` | **미해소(시드 기준)** — 시드는 Haru · Hiyori · Natori 3종, 모두 `CUBISM`. 관리용 API(`POST /internal/content/avatars`)로 넣을 수 있음. 운영 DB는 인증이 필요해 미확인 | `db/seed/R__demo_content.sql` |
| 채린 v3 모델 URL ([V2 계약](MATE_MODEL_V2_CONTRACT.md) "채린 모델 v3") | **부분 해소** — 운영 채린(id 4)은 `chaerin/v5/model.json`(`ALIVING2D_V2`). 서버 저장 경로 번호(v5)가 프런트의 "v3 묶음"과 같은 파일인지는 미확인(추정: 같은 묶음을 새 경로로 올림). 옛 Cubism `chaerin/v3`는 id 1 「말포이」에 붙어 있음 | 48 운영 응답 |
| 서도현 모델 URL (V2 계약 "서도현") | **부분 해소** — 서버 이름은 **「서진」**(id 2 `seojin/v5`, id 3 `seojin/v4`, 둘 다 공개). 프런트 이름 매핑(`서도현` · `도현`)과 안 맞음 | 48 운영 응답, `catalog.ts:75` |
| 엔진 주소 · 형식 필드 (변경 통보 11-요청 1) | **해소됨 (필드)** — `format` · `engineUrl` · `playerUrl` · `reactionsUrl`이 `ModelInfo` · `Figure`에 있음. 값은 미등록 | `content/api/ContentTypes.java` |
| 엔진 · 모델 파일 공개 접근 (변경 통보 11-요청 2) | 해소됨(명세) — Supabase 공개 버킷, CORS `*`, 버전 경로 | `api.md` 48 |
| 이벤트 type `IDLE_TALK` ([BACKEND_API 11-05판 메모](BACKEND_API.md), [11-22 갭](CAPSULE_WEB_BETA_API_GAPS_2026-11-22.md)) | **해소됨 (API 18 · 19)** — 18이 받고 19가 `IDLE` 대사(LLM, 7초 넘으면 미리 쓴 대사) | `SessionEvent.java:32`, `DialogueService.java:805` |
| `IDLE_TALK` 크레딧 정책 | **해소됨** — 대사는 0. `tts: true`로 음성을 받을 때만 20 | `api.md` 19 '음성', 33 |
| 메이트 음성 켜기 · 끄기 T-2 (변경 통보 08) | **해소됨 (API 29 · 30)** — 계정 단위 `voiceEnabled`, 끄면 차감 없음. 음성 대화는 28 `audio`, 반응 음성은 19 `tts` | `api.md` 28 · 29 |
| 대화 모드 기본/고급 크레딧 | **해소됨 (API 20 · 28 `mode`)** — 고급 1턴 30, 모자라면 409 `CREDIT_INSUFFICIENT`, 기본 0 | `DialogueService.java:97` |
| 크레딧 잔액 · 원장 (변경 통보 07) | **해소됨 (API 33 · 34)** | 5장 |
| 초대 코드 · 현황 · 등록 · 확인 (변경 통보 01 추가 · 02 · 07) | **해소됨 (API 35 · 36 · 39)** | 6장 |
| 생년월일 · 호칭 · 나에 대해 (변경 통보 02 · 08) | **해소됨 (API 4 · 8 · 10)** | `api.md` 10 |
| `/me` 입력 필요 여부 (변경 통보 02) | **해소됨** — `onboardingRequired`가 생년월일까지 봄 | `api.md` 8 |
| `/me`에 현재 `avatarId` (변경 통보 08) | **미해소** — `MeResponse`에 `avatarId` 없음(`profileImage`만) | OpenAPI |
| 메이트 상세 · 목소리 샘플 (변경 통보 04) | **해소됨 (API 31)** | 9장 |
| 대화 초기화 · 충돌 코드 (변경 통보 04) | **부분 해소 (API 47)** — 초기화는 있음, revision · 전용 충돌 코드는 없음, 범위가 다름 | 13장 |
| 끊기 멘트 `farewellLine` (변경 통보 05) | **미해소** | OpenAPI |
| 연결 기록 대화 수 `dialogueCount` (변경 통보 06) | **해소됨 (이름 다름)** — `messageCount`(답장까지 받은 턴 수) | `api.md` 22 |
| 연결 기록 `mode` | **미해소** | OpenAPI |
| `relation.previousStageName` · `nextStageName` | **부분 해소** — 숫자 `stageBefore`는 있음. 이름은 끝난 뒤 `stageName`만, 다음 단계 이름은 37에만 | `IntimacyView` |
| `relation.stageProgress` | **해소됨** — 0~100 정수(프런트 기대 0~1과 다름) | `api.md` 22 |
| 해금 목록 (변경 통보 06 · 09) | **해소됨** — 22 · 23 `unlocked[]`, 37 `unlocks[]`, 21 `stageUp` | |
| 캠 함께한 시간 서버 저장 (변경 통보 10, 11-22 갭) | **해소됨** — `presentSeconds`(카메라 켜짐 + 얼굴 보임) · `cameraOnSeconds` 저장 | `api.md` 21 · 22 |
| 기간별 기록 · 합계 (변경 통보 10) | **부분 해소 (API 38)** — 합계 · 칸 · 메이트별 · 최근 5개. 전체 목록 · 페이지 없음 | 7장 |
| 내 메이트 목록 (변경 통보 09) | **해소됨 (API 37)** — 열린 날짜 · 잠김 문구는 없음 | 8장 |
| 지속 대화방 · 원문 보존 (11-22 갭) | **해소됨 (API 32)** | 10장 |
| 베타 약관 본문 (변경 통보 08) | **미해소** — 2026-11-25 `GET /api/terms`가 여전히 "(… 본문 준비 중)" | 실호출 |
| 남학생 메이트 등록 (11-22 갭) | **해소됨(데이터)** — 「서진」 공개. 이름 · 중복 정리 필요 | 3장 |
| 의상 선택 (변경 통보 11-요청 4) | 미정 — API 없음 | |
| 목표 시간 폐지(REQUEST R09) | **해소됨** — 16에 목표 시간 없음 | `api.md` 16 |

## 16. 연결 작업 순서 제안

각 단계가 끝나면 실계정으로 해당 흐름을 확인한다. 위험도는 "잘못 바꿨을 때 다른 화면까지 깨질 가능성"이다.

| 단계 | 할 일 | 끝나면 되는 것 | 위험도 | 메모 |
|---|---|---|---|---|
| 0 | 타입 정리: `src/shared/api/types.ts`를 11-25 기준으로 다시 쓴다(옛 `Room*` · `Memory*` · `StudySettlement` 제거, 새 타입 추가). OpenAPI 자동 생성 시 `Item` · `Recent` 충돌 · `JsonNode`는 손으로 고친다 | 컴파일러가 깨진 곳을 모두 알려 줌 | 낮음 | 이 단계만으로 화면 변화 없음 |
| 1 | 공통 · 인증: 기기 값(`deviceHash`) 생성 · 저장 유틸, 카카오 요청에 추가. 오류 코드 표(`client.ts`)와 `SESSION_*` 분기를 `CONNECTION_*`으로. 잠금 문구 10분 | 이메일 · 카카오 로그인 | 중간 | `deviceHash`는 가입 · 카카오 · 36이 같이 씀. 개인정보가 아닌 무작위 값으로(추정: 브라우저 저장 UUID 해시면 충분) |
| 2 | 홈 · 메이트 목록: `/home` `mates` · `lastMate` · `activeConnection` · 시간 2개로 `loadHome`과 `availableMates`를 다시 쓴다. `/rooms/*` 호출 제거. 이름 매핑에 「서진」 반영(또는 id 매핑) | **앱에 다시 들어갈 수 있음** (P0-1) | **높음** | 룸 · 캐릭터 2단 id(`roomId` · `characterId`)가 앱 곳곳의 키라 영향이 넓다. 메이트 id 하나로 바꾸는 범위를 먼저 검색해서 정한다 |
| 3 | 온보딩 실제 포트: `BetaAccountPort`를 `PATCH /me`(`avatarId` · `birthDate` · `honorific` · `aboutMe`)로 구현하고 운영 `mountApp`에 연결 | 베타 전 가입자 · 카카오 가입자 온보딩 완료 (P0-3) | 중간 | 생년월일은 한 번만 저장된다. 만 14세 미만 400 처리 |
| 4 | 연결 전 과정: 16(`mateId`) · 17 · 18(`PRESENT`/`AWAY`/`RETURN`/`IDLE_TALK`, 응답 `reaction`) · 19 · 20/28 · 21/22(누적 4개 + `endType`) · 23 경로와 응답. `presence-clock`에서 `FOCUS`/`BREAK` 제거, 동작 이벤트는 서버로 보내지 않음(아바타 따라 하기용으로만). PIP · 카메라 켠 시간 집계 | 연결 → 대화 → 끊기 → 기록 (P0-4~7) | **높음** | 쉬는 시간 개념 삭제가 연결 화면 상태 흐름에 걸린다. heartbeat 검사(`present ≤ cameraOn ≤ connected`)를 클라이언트에서도 지켜야 끊기가 400이 안 난다 |
| 5 | 이어하기 · 끝난 연결: `activeConnection`, 409 `detail.connectionId`, `CONNECTION_ENDED` 흐름 | 새로고침 · 탭 닫기 뒤 복귀 | 중간 | 4와 같이 확인 |
| 6 | 로컬 mock 갱신: `local-demo/transport.ts`와 mock 포트를 11-25 모양으로 | mock 모드와 실서버 모드가 같은 코드 경로 | 중간 | 4와 같은 PR로 하면 테스트가 덜 깨짐(추정) |
| 7 | 메이트 상세 · 모델: 31로 `MateContentPort.load`, `format: ALIVING2D_V2` 인식, 엔진 출처 허용 목록에 CDN 추가, 48로 로그인 화면 모델 | 메이트 상세 · 연결 · 로그인 화면이 실제 모델로 (엔진 주소가 등록된 뒤) | 중간 | 엔진 주소가 서버에 등록되기 전에는 정지 이미지가 정상 동작. 출처 허용은 보안 검토 대상(Codex 리뷰 권장) |
| 8 | 크레딧 · 초대 · 설정: 33 · 34 · 35 · 36 · 39로 `BetaFeaturePort` 실제 구현, 29 · 30 설정 동기화, 가입 → 36 두 단계 | 크레딧 · 친구 초대 · 설정 서버 저장 | 중간 | 출석 위젯은 PM 결정 후 |
| 9 | 기록 · 내 메이트 · 대화방 · 초기화: 38 · 37 · 32 · 47. 기존 합산 코드 정리, `stageProgress` ÷100, 초기화 범위 계약 변경 | 다른 기기에서도 같은 기록 · 대화 | 낮음~중간 | 하루 경계(오전 5시) 결정 필요 |
| 10 | 새 화면: 알림(43 · 44), 평가 · 신고(40 · 41), 베타 피드백(42), 정원 초과 · 출시 알림(45), 메이트 공개 알림(46), 안전 경고 · 정지, 음성 재생(28 `audio`) | P0 · P1 나머지 | 낮음 | 화면 디자인이 먼저 필요한 항목 |

**최소 경로.** 실제 서버로 "로그인 → 홈 → 연결 → 끊기"를 다시 돌리려면 1 · 2 · 3 · 4 · 5가 필요하다. 이 다섯 단계는 서로 얽혀 있어 한 브랜치에서 같이 하는 편이 안전하다(추정).

## 17. 백엔드 · PM에 다시 요청할 것

| 대상 | 요청 | 급한 정도 |
|---|---|---|
| 백엔드 (데이터) | 채린 · 서진 모델에 엔진 주소 등록(`PUT /internal/content/models/{id}/runtime`) | 12/1 전 필요 (없으면 정지 이미지) |
| 백엔드 (데이터) | 메이트 정리: id 1 「말포이」(옛 Cubism 채린 모델)와 서진 중복(id 2 · 3)을 공개 목록에서 뺄지 | 12/1 전 필요 |
| 백엔드 · PM | 남학생 메이트 이름 확정: 서버 「서진」 ↔ 프런트 「서도현」 | 12/1 전 필요 |
| 백엔드 (데이터) | 아바타 6종(chitose · epsilon · haru_greeter · hiyori · natori · wanko) 등록 여부. 시드는 3종 | 12/1 전 필요 |
| 백엔드 | 약관 본문 게시 (`GET /api/terms`가 아직 "본문 준비 중") | **가입 전제** |
| 백엔드 | `/me`에 `avatarId` | 있으면 좋음(지금은 썸네일로 추정) |
| 백엔드 | 31에 `farewellLine` | 있으면 좋음 |
| 백엔드 | 22 · 23에 `mode`, 이전 · 다음 단계 이름 | 있으면 좋음 |
| 백엔드 | 38에 기간 안 연결 전체 목록(페이지) — 화면이 쓴다면 | P1 |
| 백엔드 | OpenAPI 이름 충돌 수정(`Item` · `Recent`), 30 요청 스키마를 `JsonNode` 대신 설정 객체로, 성공 상태(4 · 24 · 27 · 18) 표기 | 있으면 좋음 (타입 생성 정확도) |
| 백엔드 | 운영 TTS 공급자가 실제 음성인지(기본은 무음) | 12/1 전 확인 |
| PM | 출석 보상 위젯: 서버 규칙(매일 1,500)으로 바꿀지, n일차 보상을 서버에 요청할지 | 12/1 전 필요 |
| PM | 대화 초기화 범위 문구(친밀도 · 해금은 안 지워짐) | 12/1 전 필요 |
| PM | 하루 경계: 기록 화면도 오전 5시 기준으로 할지 | 있으면 좋음 |
| PM | 말 걸기 조건: 서버 명세는 "얼굴이 보일 때"만, 프런트는 카메라를 끄면 계속 셈(`idle-talk.ts`). 어느 쪽인지 | 있으면 좋음 |
| PM · 백엔드 | 로그인 화면에 띄울 메이트(채린만 · 번갈아) | 있으면 좋음 |

## 18. 근거

- OpenAPI: [BACKEND_OPENAPI_2026-11-25.json](BACKEND_OPENAPI_2026-11-25.json) (SHA-256 `1a478f65…0264662`)
- 백엔드 명세 · 코드: `LIKELION-CAPSULE/Backend_lab` `develop` `10a67d1` — `docs/specs/api.md`, `src/main/java/com/capsule/**`(파일은 본문에 표기)
- 운영 호출(로그인 없이, 2026-11-25 12:06 KST 무렵): `GET /api/login-mates`, `GET /api/terms`
- 프런트 코드: 이 브랜치의 `src/**` (본문에 `파일:행`)
- 이전 요청 문서: [DESIGN_CHANGE_NOTICE_BACKEND.md](DESIGN_CHANGE_NOTICE_BACKEND.md), [CAPSULE_WEB_BETA_API_GAPS_2026-11-22.md](CAPSULE_WEB_BETA_API_GAPS_2026-11-22.md), [MATE_MODEL_V2_CONTRACT.md](MATE_MODEL_V2_CONTRACT.md)
