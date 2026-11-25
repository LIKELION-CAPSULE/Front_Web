# 백엔드 OpenAPI 변경표 · 2026-11-22 → 2026-11-25

작성일: **2026-11-25 (Asia/Seoul)** · 비교 대상: [11-22 스냅샷](BACKEND_OPENAPI_2026-11-22.json) ↔ [11-25 스냅샷](BACKEND_OPENAPI_2026-11-25.json)

프런트가 받을 영향과 연결 순서는 [프런트 연결 갭 분석](API_FRONT_GAP_2026-11-25.md)에, 엔드포인트와 스키마 전체는 [BACKEND_API.md](BACKEND_API.md)에 정리했다. 이 문서는 **두 스냅샷의 기계 비교 결과**와 그 의미를 적는다.

## 1. 스냅샷

| 항목 | 2026-11-22 | 2026-11-25 |
|---|---|---|
| 파일 | `BACKEND_OPENAPI_2026-11-22.json` | `BACKEND_OPENAPI_2026-11-25.json` (받은 바이트 그대로) |
| SHA-256 | `22ab78c7cb136a59c8bd80bf5bf32ee211fbed4a5c5d66ddea0f60ffe8e18e37` | `1a478f659fb3d5442aebda17436760d2b429775b9996a57061033db530264662` |
| 크기 | — | 46,973 bytes |
| 경로 · 작업 · 스키마 | 24 · 27 · 69 | **41 · 44 · 114** |
| `info` | `캡슐 API` · `dev` · "명세 원본: docs/specs/api.md" | 같음 |
| 보안 | 전역 `bearer`(JWT), 작업별 재정의 없음 | 같음 |

- 2026-11-25에 `https://api.capsule.ai.kr/v3/api-docs`와 `https://backendlab-production-3052.up.railway.app/v3/api-docs`를 각각 받았다. 두 파일의 SHA-256이 같다(바이트 단위 동일).
- 백엔드 저장소 `LIKELION-CAPSULE/Backend_lab`의 `develop` 최신 커밋은 `10a67d1`(2026-11-25 09:56 KST, "19 반응 대사 음성")이다. 이 커밋에서 추가된 `ReactionResponse.charged` · `credits`가 OpenAPI에도 있다. 그래서 **배포본은 `10a67d1` 이후 상태로 본다(추정)**. 이 문서의 "코드 근거"는 이 커밋 기준이다.

## 2. 요약

1. **공부 세션 → 연결.** `/api/sessions/*` 8개 작업이 `/api/connections/*`로 바뀌었다. 경로 변수 `sessionId`는 `connectionId`가 됐고, 23 리포트 조회는 `GET /api/connections/{connectionId}`(접미사 `/report` 없음)가 됐다.
2. **삭제 3개 번호, 작업 3개.** 12 `GET /api/rooms/{roomId}`, 13 `POST /api/me/memories`, 14 `GET /api/me/memories`. 백엔드 명세상 부르면 404 `NOT_FOUND`.
3. **추가 20개(29~48).** 설정, 메이트 상세·내 메이트·대화방 기록, 크레딧, 초대, 내 기록, 답변 평가·신고, 베타 피드백, 알림, 출시·메이트 공개 알림, 대화 초기화, 로그인 화면 메이트.
4. **요청 모양이 바뀐 기존 작업.** 6 카카오(`deviceHash` 필수), 4 가입(`birthDate` · `deviceHash` 필수), 16 시작(`mateId` 하나), 18 이벤트(type 4종), 21 · 22(누적값 4개). 프런트가 지금 보내는 본문은 이 작업들에서 400이 된다.
5. **응답 모양이 바뀐 기존 작업.** 8 `/me`, 11 `/home`, 16 · 17 · 22 · 23, 18 이벤트, 19 반응, 20 · 28 대화.

## 3. 경로 이름 변경 (세션 → 연결)

| 번호 | 11-22 | 11-25 | 이름 변화 | 다른 변화 |
|---|---|---|---|---|
| 16 | `POST /api/sessions` | `POST /api/connections` | 공부 시작 → 연결 시작 | 요청 `StartRequest` 필드 전체 교체 |
| 17 | `POST /api/sessions/{sessionId}/resume` | `POST /api/connections/{connectionId}/resume` | 세션 이어하기 → 연결 이어하기 | — |
| 18 | `POST /api/sessions/{sessionId}/events` | `POST /api/connections/{connectionId}/events` | 공부 상태 기록 → 상태 기록 | `EventResponse` 모양 교체 |
| 19 | `POST /api/sessions/{sessionId}/events/{eventId}/reaction` | `POST /api/connections/{connectionId}/events/{eventId}/reaction` | 같음 | — |
| 20 | `POST /api/sessions/{sessionId}/messages` | `POST /api/connections/{connectionId}/messages` | 같음 | — |
| 21 | `POST /api/sessions/{sessionId}/heartbeat` | `POST /api/connections/{connectionId}/heartbeat` | 같음 | 응답 **204 → 200** `HeartbeatResponse` |
| 22 | `POST /api/sessions/{sessionId}/end` | `POST /api/connections/{connectionId}/end` | 공부 종료 → 연결 끊기 | — |
| 23 | `GET /api/sessions/{sessionId}/report` | `GET /api/connections/{connectionId}` | 리포트 조회 → 연결 기록 조회 | 경로 끝 `/report` 없어짐 |
| 28 | `POST /api/sessions/{sessionId}/messages/stream` | `POST /api/connections/{connectionId}/messages/stream` | 같음 | — |

옛 경로는 남아 있지 않다. 백엔드 명세 공통 규칙상 없는 경로는 토큰이 있으면 404 `NOT_FOUND`, 없으면 401 `UNAUTHORIZED`다(`docs/specs/api.md` '공통 규칙').

## 4. 삭제

| 번호 | 작업 | 대신하는 것 | 근거 |
|---|---|---|---|
| 12 | `GET /api/rooms/{roomId}` 스터디룸 상세 | 31 메이트 상세 | `api.md` 12 "삭제 (2026-11-23)" |
| 13 | `POST /api/me/memories` 일정 저장 | 없음 (베타 화면에 일정 없음) | `api.md` 13 "삭제 (2026-11-24)". 저장된 일정은 대화 프롬프트가 계속 읽는다 |
| 14 | `GET /api/me/memories` 내 일정 조회 | 없음 | 위와 같음 |

삭제된 스키마 15개: `ApiResponseMemoryList`, `ApiResponseMemoryResponse`, `ApiResponseRoomDetail`, `CharacterBrief`, `CharacterRef`, `CreateMemoryRequest`, `EventCharacter`, `HomeRoom`, `MemoryList`, `MemoryResponse`, `RelationBrief`, `RoomCharacter`, `RoomDetail`, `RoomView`, `StudySettlement`.

## 5. 추가

| 번호 | 작업 | 요청 | 성공 응답 | 인증 |
|---|---|---|---|---|
| 29 | `GET /api/me/settings` 설정 조회 | — | 200 `UserSettings` | 필요 |
| 30 | `PATCH /api/me/settings` 설정 변경 | `JsonNode`(본문 필수) | 200 `UserSettings` | 필요 |
| 31 | `GET /api/mates/{mateId}` 메이트 상세 | — | 200 `MateDetailResponse` | 필요 |
| 32 | `GET /api/mates/{mateId}/messages` 대화방 기록 | query `cursor` · `size` | 200 `ChatRoomResponse` | 필요 |
| 33 | `GET /api/credits` 내 크레딧 | — | 200 `CreditSummaryResponse` | 필요 |
| 34 | `GET /api/credits/transactions` 크레딧 내역 | query `filter` · `cursor` · `size` | 200 `CreditTransactionsResponse` | 필요 |
| 35 | `GET /api/referrals/me` 초대 현황 | — | 200 `ReferralStatus` | 필요 |
| 36 | `POST /api/referrals` 초대 코드 입력 | `EnterReferralRequest` | 201 `ReferralEntered` | 필요 |
| 37 | `GET /api/mates/me` 내 메이트 | — | 200 `MyMatesResponse` | 필요 |
| 38 | `GET /api/records` 내 기록 | query `range` · `date` · `mateId` | 200 `RecordsResponse` | 필요 |
| 39 | `GET /api/referrals/{code}` 초대 코드 확인 | path `code` | 200 `ReferralEntered` | **불필요** |
| 40 | `PUT /api/messages/{requestId}/rating` 답변 평가 | `MessageRatingRequest` | 204 | 필요 |
| 41 | `POST /api/messages/{requestId}/report` 답변 신고 | `MessageReportRequest` | 201 `MessageReportResponse` | 필요 |
| 42 | `POST /api/feedback` 베타 피드백 | `FeedbackRequest` | 201 `FeedbackCreated` | 필요 |
| 43 | `GET /api/notifications` 알림 목록 | query `before` · `size` | 200 `NotificationList` | 필요 |
| 44 | `POST /api/notifications/read` 알림 읽음 | `ReadRequest`(본문 선택) | 200 `Unread` | 필요 |
| 45 | `POST /api/beta/waitlist` 출시 알림 신청 | `WaitlistRequest` | 204 | **불필요** |
| 46 | `POST /api/mates/{mateId}/alert` 메이트 공개 알림 신청 | — | 204 | 필요 |
| 47 | `POST /api/mates/{mateId}/conversation/reset` 대화 초기화 | — | 204 | 필요 |
| 48 | `GET /api/login-mates` 로그인 화면 메이트 | — | 200 `LoginMatesResponse` | **불필요** |

"인증" 열은 OpenAPI가 아니라 백엔드 코드와 명세로 확인했다. OpenAPI는 모든 작업에 전역 bearer를 붙인다. 로그인 없이 부를 수 있는 작업은 `api.md` 각 절의 "인증: 불필요"와 커밋 #194 · #212 · #220(보안 설정에 공개 경로 추가)을 따랐다.

추가된 스키마 59개(감싸는 `ApiResponse*` 15개 포함): `Background`, `BackgroundView`, `Bucket`, `ChatRoomResponse`, `CreditSummaryResponse`, `CreditTransactionsResponse`, `Credits`, `EnterReferralRequest`, `FeedbackCreated`, `FeedbackRequest`, `HeartbeatResponse`, `IntimacyView`, `Item`, `JsonNode`, `LastMate`, `LoginMatesResponse`, `Mate`, `MateCard`, `MateDetailResponse`, `MateRef`, `MateSummary`, `Message`, `MessageRatingRequest`, `MessageReportRequest`, `MessageReportResponse`, `MyMate`, `MyMatesResponse`, `NotificationList`, `Now`, `ReactionView`, `ReadRequest`, `Recent`, `RecordsResponse`, `ReferralEntered`, `ReferralFriend`, `ReferralRewardView`, `ReferralStatus`, `Relation`, `SettingsInfo`, `StageUp`, `Unlock`, `Unlocked`, `Unread`, `UserSettings`, `WaitlistRequest`, 그리고 `ApiResponse` 감싸기 15개.

## 6. 기존 스키마의 필드 변화

기호: `+` 추가, `−` 삭제, `~` 바뀜. `*`는 OpenAPI `required`. 필수 여부를 OpenAPI가 표시하지 않는 필드도 서버 검증으로는 필수일 수 있다. 서버 검증은 오른쪽 열에 적었다.

| 스키마 | 변화 | 서버 검증 · 의미 (코드 근거) |
|---|---|---|
| `StartRequest` | +`mateId`\* · −`roomId` · −`characterId` · −`targetMinutes` | 메이트 하나로 연결. 목표 시간 개념 삭제 |
| `StartResponse` | +`connectionId` · +`mate`(Figure) · +`settings`(SettingsInfo) · +`firstMeet` · +`greeting`(ReactionView) · +`minorRemainingSeconds` · +`relation`(Now) · +`credits` · +`backgrounds[]` · +`background` · −`sessionId` · −`targetMinutes` · −`room` · −`character` | `startedAt` · `avatar` · `me` · `serverTime`는 그대로 |
| `ResumeResponse` | +`connectionId` · +`mate` · +`connectedSeconds` · +`presentSeconds` · +`cameraOnSeconds` · +`pipSeconds` · +`minorRemainingSeconds` · +`backgrounds[]` · +`background` · −`sessionId` · −`targetMinutes` · −`room` · −`character` · −`studySeconds` · −`breakSeconds` | 누적값은 마지막 heartbeat 값(없으면 0) |
| `Figure` | +`format` · +`engineUrl` · +`playerUrl` · +`reactionsUrl` | `format` = `CUBISM` · `ALIVING2D_V2`. 엔진 3필드는 없으면 null (`content/api/ContentTypes.java`) |
| `ModelInfo` | +`format` · +`engineUrl` · +`playerUrl` · +`reactionsUrl` | 위와 같음 |
| `Me` | +`honorific` | 없으면 null |
| `ActiveSessionSummary` | +`connectionId` · +`mateId` · +`mateName` · −`sessionId` · −`roomId` · −`roomName` · −`characterName` | 이름은 `ActiveSessionSummary` 그대로 |
| `HomeResponse` | +`todayPresentSeconds` · +`todayConnectedSeconds` · +`activeConnection` · +`lastMate` · +`mates[]`(MateCard) · −`todayStudySeconds` · −`activeSession` · −`rooms` | 하루 기준은 오전 5시(KST) |
| `MeResponse` | +`activeConnection` · +`birthDate`(date) · +`isMinor` · +`honorific` · +`aboutMe` · +`referralCode` · +`credits` · +`loginType` · +`unreadNotifications` · −`activeSession` | `onboardingRequired`가 **아바타 또는 생년월일이 없으면** true로 바뀜 (`api.md` 8). `loginType` = `EMAIL` · `KAKAO` |
| `UpdateMeRequest` | +`birthDate` · +`honorific` · +`aboutMe` | `birthDate`는 저장된 값이 없을 때 한 번만. 호칭 1~10자, 나에 대해 0~50자 |
| `SignupRequest` | +`birthDate` · +`deviceHash` | 둘 다 서버에서 필수 (`user/service/AuthService.java:131`, `SignupPolicy.validDeviceHash`). 만 14세 미만 400 `UNDER_14`, 정원 초과 403 `BETA_FULL` |
| `KakaoRequest` | +`deviceHash` | **기존 사용자 로그인에도 필수.** 카카오 호출 전에 검사하고 없으면 400 `INVALID_REQUEST` (`AuthService.java:189`) |
| `EventResponse` | +`reaction`(ReactionView) · −`characters[]` | `reaction.expression`은 **문자열**(표정 이름). 예전 `characters[].expression`은 객체 `{name, file}`였다 |
| `HeartbeatRequest` | +`connectedSeconds` · +`cameraOnSeconds` · +`pipSeconds` · −`studySeconds` | 4개 모두 필수, `0 ≤ present ≤ cameraOn ≤ connected ≤ 경과`, `0 ≤ pip ≤ connected`. 어기면 400 `INVALID_CONNECTION_TIME` |
| `EndRequest` | +`connectedSeconds` · +`cameraOnSeconds` · +`pipSeconds` · +`endType` · −`studySeconds` | 누적값 검사는 heartbeat와 같음. `endType` = `NORMAL`(기본) · `AUTO_AWAY` · `MINOR_LIMIT` |
| `ReportResponse` | +`connectionId` · +`connectedSeconds` · +`cameraOnSeconds` · +`messageCount` · +`mate`(MateRef) · +`referralReward` · +`betaFeedbackAvailable` · −`sessionId` · −`roomName` · −`studySeconds` · −`character` · ~`relation`: `StudySettlement` → `IntimacyView` | 친밀도 5단계로 바뀜 (`api.md` 22 '친밀도 규칙') |
| `MessageRequest` | +`mode` · ~`inputType` enum `TEXT,QUICK` → `TEXT,QUICK,VOICE` | `mode` = `BASIC`(기본) · `ADVANCED`(1턴 30 크레딧) |
| `MessageResponse` | +`mode` · +`charged` · +`credits` · +`safety` · +`background`(Background) · +`voice` | `safety` = `WARNING` 또는 null |
| `ReactionResponse` | +`charged` · +`credits` | `tts: true`로 음성을 만들었을 때만 20 크레딧 (2026-11-25) |

바뀌지 않은 스키마: `AccessTokenResponse`, `AffinityChange`, `AvatarItem`(필드는 같고 `model`의 `ModelInfo`가 늘어남), `AvatarsResponse`, `ConfirmRequest`, `EmailRequest`, `EventRequest`(필드는 같고 허용 type이 바뀜, 아래), `ExpiresResponse`, `ExpressionRef`, `KakaoResponse`, `LoginRequest`, `LoginResponse`, `MotionRef`, `PasswordResetRequest`, `ReactionCharacter`, `ReactionRequest`, `SseEmitter`, `TermVersion`, `TermsResponse`, `VerificationResponse`.

## 7. OpenAPI에 드러나지 않는 의미 변화

OpenAPI는 대부분의 enum을 `string`으로만 적는다. 아래는 백엔드 코드에서 확인했다.

| 항목 | 11-22 | 11-25 | 코드 근거 |
|---|---|---|---|
| 18 `EventRequest.type` | `FOCUS` · `AWAY` · `RETURN` · `BREAK` · `DROWSY` · `YAWN` · `WAVE` · `HEAD_TURN` | **`PRESENT` · `AWAY` · `RETURN` · `IDLE_TALK`만** (그 밖은 400 `INVALID_EVENT`) | `session/domain/SessionEvent.java:32` `TYPES` |
| 19 trigger | 첫 FOCUS = GREETING, BREAK_END, 동작 type | `AWAY` · `RETURN` · `IDLE`(= `IDLE_TALK`). 인사는 16 `greeting`으로 | `dialogue/service/DialogueService.java:800-805`, `session/service/SessionService.java:515-520` |
| 오류 코드 | `SESSION_NOT_FOUND` · `SESSION_ENDED` · `SESSION_IN_PROGRESS` · `SESSION_ALREADY_IN_PROGRESS` · `INVALID_STUDY_TIME` · `ROOM_NOT_FOUND` · `CHARACTER_NOT_IN_ROOM` · `INVALID_TARGET_MINUTES` | `CONNECTION_NOT_FOUND` · `CONNECTION_ENDED` · `CONNECTION_IN_PROGRESS` · `CONNECTION_ALREADY_IN_PROGRESS`(`detail.connectionId`) · `INVALID_CONNECTION_TIME` · `MATE_NOT_FOUND` · `MATE_COMING_SOON` 등 | `session/domain/SessionErrorCode.java`, `api.md` 공통 규칙 2026-11-23 |
| 새 오류 코드 | — | `UNDER_14` · `INVALID_BIRTH_DATE` · `BETA_FULL` · `INVALID_HONORIFIC` · `INVALID_ABOUT_ME` · `INVALID_SETTINGS` · `MINOR_DAILY_LIMIT` · `CHAT_SUSPENDED` · `CREDIT_INSUFFICIENT` · `REFERRAL_*` 5종 · `FEEDBACK_ALREADY_TODAY` · `MESSAGE_NOT_FOUND` · `ALREADY_REPORTED` · `MATE_ALREADY_OPEN` | `user/domain/UserErrorCode.java`, `dialogue/domain/DialogueErrorCode.java` |
| 하루 경계 | 한국 날짜(자정) | **오전 5시(KST)** — 홈 오늘 시간 · 청소년 3시간 · 출석 크레딧 · 친밀도 하루 한도 · 내 기록 | `api.md` 16 '하루 기준', 33 '크레딧 규칙' |
| 로그인 잠금 | 5회 실패 5분 | 5회 실패 **10분** | `api.md` 5 (2026-11-23) |
| `aboutMe` 길이 | — | 0~50자 | `api.md` 10 |

## 8. OpenAPI 표기 주의 (스냅샷을 그대로 믿으면 틀리는 곳)

| 위치 | OpenAPI 표기 | 실제 (코드) | 근거 |
|---|---|---|---|
| 34 `CreditTransactionsResponse.items[]` | `Item` = 알림 항목 모양(`body` · `link` · `read`) | `id` · `type` · `title` · **`change`** · **`balanceAfter`** · `createdAt` | 이름이 같은 `Item` 레코드 두 개(`credit/dto/CreditTransactionsResponse.java:10`, `user/dto/NotificationList.java:9`)를 springdoc이 하나로 합쳤다 |
| 37 `MyMate.recent[]` | `Recent` = 내 기록 모양(`mateId` · `mateName` 포함) | `connectionId` · `endedAt` · `presentSeconds` · `connectedSeconds`만 | 같은 이유 (`session/dto/MyMatesResponse.java:42`, `session/dto/RecordsResponse.java:28`) |
| 30 요청 본문 | `JsonNode`(Jackson 내부 속성 나열) | 29 응답 키 중 바꿀 것만 담은 JSON 객체 | `api.md` 30 |
| 4 가입 성공 상태 | 200 | **201** | `user/controller/AuthController.java:81` |
| 24 로그아웃 | 200 | **204** | `AuthController.java:54` |
| 27 탈퇴 | 200 | **204** | `user/controller/MeController.java:69` |
| 18 이벤트 | 200 | 새 이벤트 **201**, 같은 (`type`, `occurredAt`) 재전송 200 | `session/controller/SessionController.java:75` |
| 28 스트리밍 | `SseEmitter`(`timeout`) | `text/event-stream`: `reply` · `audio` · `audio_end` · `done` · `error` | `api.md` 28 |
| `ReactionView.audio` | 타입 없음 | 지금은 늘 null | `api.md` 16 · 18 |
| enum 대부분 | `string` | 위 7절과 [BACKEND_API.md 스키마 사전](BACKEND_API.md#8-스키마-사전) 참고 | — |

## 9. 다시 받는 방법

```bash
curl --fail --silent --show-error --location --max-time 40 \
  'https://api.capsule.ai.kr/v3/api-docs' --output /tmp/capsule-openapi.json
shasum -a 256 /tmp/capsule-openapi.json
```

해시가 위 11-25 값과 같으면 이 문서가 그대로 유효하다.
