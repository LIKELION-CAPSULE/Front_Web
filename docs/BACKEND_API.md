# CAPSULE 백엔드 API 정리

확인일: **2026-11-25 (Asia/Seoul)** · 기준: [OpenAPI 2026-11-25 스냅샷](BACKEND_OPENAPI_2026-11-25.json) + 백엔드 코드 `Backend_lab@10a67d1`

- 이전 판(2026-11-05 기준, 26개 API, `/api/sessions` · 스터디룸 · 일정)은 Git 기록에 남아 있다. 그 시점의 점검 결과는 [API_AUDIT_2026-11-05](API_AUDIT_2026-11-05.md) · [API_AUDIT_2026-11-22](API_AUDIT_2026-11-22.md) 같은 기록 문서를 본다. 기록 문서는 고치지 않았다.
- 11-22 대비 바뀐 점: [OpenAPI 변경표](BACKEND_OPENAPI_DIFF_2026-11-25.md)
- 프런트가 지금 무엇을 부르고, 무엇이 깨지고, 어떤 순서로 연결할지: [프런트 연결 갭 분석](API_FRONT_GAP_2026-11-25.md)

## 1. 출처와 확인 범위

| 항목 | 값 |
|---|---|
| Swagger UI | `https://api.capsule.ai.kr/swagger-ui/index.html` (Railway 주소 `https://backendlab-production-3052.up.railway.app`도 같은 서버) |
| OpenAPI 원본 | `GET https://api.capsule.ai.kr/v3/api-docs` — 두 주소의 응답이 바이트 단위로 같음 (2026-11-25 확인) |
| OpenAPI 버전 · 제목 | `3.1.0` · `캡슐 API` (`dev`) |
| 규모 | **41개 경로 · 44개 작업 · 114개 스키마** (번호 1~11, 16~48. 12~15는 없음) |
| 보관 원본 | [BACKEND_OPENAPI_2026-11-25.json](BACKEND_OPENAPI_2026-11-25.json) |
| 원본 SHA-256 | `1a478f659fb3d5442aebda17436760d2b429775b9996a57061033db530264662` |
| 명세 원본 | 백엔드 저장소 `docs/specs/api.md` (OpenAPI `info.description`이 가리키는 파일) |
| 코드 근거 | `LIKELION-CAPSULE/Backend_lab` `develop` `10a67d1` (2026-11-25 09:56 KST). 아래 "코드 근거" 경로는 `src/main/java/com/capsule/` 기준 |

**확인 범위.** 이 문서는 OpenAPI와 백엔드 코드 · 명세를 읽어서 쓴 것이다. 실제 호출은 로그인이 필요 없는 `GET /api/login-mates`(48) 한 번만 했다. 인증이 필요한 작업의 운영 데이터(예: 운영 DB의 아바타 수, 메이트 엔진 주소)는 확인하지 않았다. 사용자가 실계정으로 연결해 확인할 예정이다.

**배포 시점(추정).** `10a67d1`에서 추가된 `ReactionResponse.charged` · `credits`가 OpenAPI에 있으므로, 배포본은 이 커밋 이후로 본다.

## 2. 공통 계약

### 인증

- `Authorization: Bearer <accessToken>`. 액세스 토큰은 30분.
- 리프레시 토큰은 HttpOnly 쿠키 `refresh_token`(`Path=/api/auth`, `SameSite=Lax`, 운영은 `Secure`). 쓸 때마다 교체된다. 여러 탭이 동시에 갱신하면 하나만 성공한다.
- 어떤 API든 401 `AUTH_TOKEN_EXPIRED`면 7 토큰 갱신을 한 번 부르고 다시 보낸다.
- OpenAPI는 모든 작업에 전역 bearer를 붙인다. **실제로 로그인 없이 부를 수 있는 작업**은 아래뿐이다 (`common/security/SecurityConfig.java` `publicEndpoints()`).

| 로그인 없이 | 작업 |
|---|---|
| 인증 | 1 약관, 2 · 3 이메일 인증, 4 가입, 5 로그인, 6 카카오, 7 갱신, 24 로그아웃, 25 · 26 비밀번호 재설정 |
| 베타 | 39 초대 코드 확인, 45 출시 알림 신청, 48 로그인 화면 메이트 |

공개 작업에 토큰을 붙여도 무시한다(`ignoreTokenOnPublicEndpoints`). 그 밖의 작업은 토큰이 없으면 401 `UNAUTHORIZED`다.

### 응답 모양 (2026-11-19부터)

```json
{ "success": true, "data": { "...": "각 API 응답" } }
{ "success": false, "code": "CONNECTION_ENDED", "message": "CONNECTION_ENDED", "detail": {} }
```

- 본문이 있는 성공 응답은 모두 `data`로 감싼다. OpenAPI의 `ApiResponse*` 스키마 30개가 이 감싸기다. 아래 표의 "응답"은 `data` 안의 스키마다.
- 204 · 202(본문 없음)는 감싸지 않는다.
- 28 스트리밍의 `reply` · `done` · `audio` · `audio_end` 이벤트 데이터는 감싸지 않는다. `error` 이벤트만 오류 모양이다.
- 오류는 `code`로 나눈다. `message`는 지금 `code`와 같은 값이라 화면 문구로 쓰지 않는다. `detail`은 보통 `{}`이고, 쓰는 곳은 409 `CONNECTION_ALREADY_IN_PROGRESS`(`detail.connectionId`), 400 `INVALID_CODE`(`detail.remainingAttempts`), 403 `CHAT_SUSPENDED`(`detail.until`), 409 `CREDIT_INSUFFICIENT`(`detail.credits`)다.

### 공통 오류

| 상태 | code | 언제 |
|---|---|---|
| 400 | `INVALID_REQUEST` | JSON 형식 · 타입이 틀림. 숫자 모양 문자열 `"50"`은 숫자로 받음. 각 API의 검증보다 먼저 걸림 |
| 401 | `UNAUTHORIZED` | 토큰 없이 인증 필요 API |
| 401 | `AUTH_TOKEN_EXPIRED` | 토큰 만료 · 잘못됨 → 7 갱신 후 다시 |
| 404 | `NOT_FOUND` | 없는 경로 (토큰이 있을 때. 없으면 401이 먼저) — 옛 `/api/sessions/*` · `/api/rooms/*` · `/api/me/memories`도 여기 |
| 405 | `METHOD_NOT_ALLOWED` | 경로는 있고 메서드가 틀림 |
| 429 | `TOO_MANY_REQUESTS` | 속도 제한 (2 · 25 같은 이메일 1분 1번, 20 · 28 1분 30번, 39 같은 IP 1분 30번, 45 같은 IP 1분 5번, 48 같은 IP 1분 60번) |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

코드 근거: `common/error/CommonErrorCode.java`.

### 데이터 규칙

- 시각(`startedAt` 등)은 UTC ISO-8601. 날짜(`birthDate`, 38 `date`)는 한국 날짜.
- **하루는 한국 시간 오전 5시에 바뀐다.** 홈의 오늘 시간, 청소년 하루 3시간, 출석 크레딧, 친밀도 하루 한도, 베타 평가 하루 1번, 38 내 기록이 모두 이 기준이다 (`api.md` 16 '하루 기준').
- id는 모두 `integer(int64)`. `requestId`는 UUID 문자열. **`mateId` = 캐릭터 id**라서 20 · 28의 `characterId`와 같은 값이다.
- OpenAPI의 `required`는 4개 스키마(`MessageRequest`, `MessageReportRequest`, `ReactionRequest`, `StartRequest`)에만 있다. 나머지 필수 여부는 서버 검증을 따른다(스키마 사전의 "의미 · 값" 열).
- 응답 필드는 대부분 null일 수 있다. OpenAPI에 nullable 표시가 없으니 스키마 사전의 "없으면 null"을 따른다.
- 프런트는 같은 출처 프록시 `/api/backend/*`를 거쳐 부른다(`server/backend-proxy.ts`). 프록시는 경로를 그대로 `/api/*`로 넘기고 경로 허용 목록은 없다. 응답에는 `cache-control: no-store`를 붙인다.

## 3. 전체 엔드포인트 (44개)

번호는 OpenAPI `summary`의 번호다. 분류는 OpenAPI 태그를 따랐다(태그 `공부 세션` · `리포트`는 이름만 옛것이고 내용은 연결이다). "요청"의 `(필수)`는 본문 자체가 필수라는 뜻이고, 안의 필드 필수 여부는 [스키마 사전](#8-스키마-사전)을 본다. 성공 상태는 **코드 기준**이며, OpenAPI 표기와 다르면 괄호에 적었다.

### 3.1. 인증

| 번호 | 메서드·경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| 1 | `GET /api/terms` | 가입 화면의 필수 약관 2종 최신 버전 | 없음 | `200` → [TermsResponse](#termsresponse) |
| 2 | `POST /api/auth/email/verification` | 6자리 인증번호 발송(5분). 1분에 1번 | [EmailRequest](#emailrequest) (필수) | `202` → [ExpiresResponse](#expiresresponse) |
| 3 | `POST /api/auth/email/verification/confirm` | 인증번호 확인 → 가입용 토큰(10분). 5회 틀리면 번호 폐기 | [ConfirmRequest](#confirmrequest) (필수) | `200` → [VerificationResponse](#verificationresponse) |
| 4 | `POST /api/auth/email/signup` | 가입 + 바로 로그인. **생년월일 · 기기 값 필수**, 만 14세 미만 거부, 정원 초과 403 | [SignupRequest](#signuprequest) (필수) | `201`(OpenAPI 200) → [LoginResponse](#loginresponse) |
| 5 | `POST /api/auth/email/login` | 이메일 로그인. 5회 실패 시 10분 잠금 | [LoginRequest](#loginrequest) (필수) | `200` → [LoginResponse](#loginresponse) |
| 6 | `POST /api/auth/social/KAKAO` | 카카오 로그인 · 가입. **`deviceHash`가 없으면 기존 사용자도 400** | [KakaoRequest](#kakaorequest) (필수) | `200` → [KakaoResponse](#kakaoresponse) |
| 7 | `POST /api/auth/refresh` | 리프레시 쿠키로 액세스 토큰 재발급 | 없음 (쿠키) | `200` → [AccessTokenResponse](#accesstokenresponse) |
| 24 | `POST /api/auth/logout` | 리프레시 토큰 폐기. 진행 중 연결은 유지 | 없음 (쿠키) | `204`(OpenAPI 200) |
| 25 | `POST /api/auth/password/reset-request` | 재설정 메일. 가입 여부와 상관없이 같은 응답 | [EmailRequest](#emailrequest) (필수) | `202` 본문 없음 |
| 26 | `POST /api/auth/password/reset` | 토큰 + 새 비밀번호. 모든 기기 로그아웃 | [PasswordResetRequest](#passwordresetrequest) (필수) | `204` |

### 3.2. 온보딩 · 홈 · 계정

| 번호 | 메서드·경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| 8 | `GET /api/me` | 내 정보 · 온보딩 필요 여부(**아바타 또는 생년월일 없음**) · 진행 중 연결 · 크레딧 · 안 읽은 알림. **그날 출석 크레딧 지급** | 없음 | `200` → [MeResponse](#meresponse) |
| 9 | `GET /api/avatars` | 고를 수 있는 아바타와 모델 | 없음 | `200` → [AvatarsResponse](#avatarsresponse) |
| 10 | `PATCH /api/me` | 닉네임 · 아바타 · 생년월일(한 번) · 호칭 · 나에 대해. 보낸 값만 | [UpdateMeRequest](#updatemerequest) (필수) | `200` → [MeResponse](#meresponse) |
| 11 | `GET /api/home` | 오늘 함께한 · 연결 시간, 이어하기, 마지막 메이트, 메이트 카드 목록 | 없음 | `200` → [HomeResponse](#homeresponse) |
| 27 | `DELETE /api/me` | 탈퇴. 개인정보 비움 · 대화 기억 삭제 · 모든 기기 로그아웃. 진행 중 연결이 있으면 409 | 없음 | `204`(OpenAPI 200) |
| 29 | `GET /api/me/settings` | 설정 7개. 저장 안 한 값은 기본값 | 없음 | `200` → [UserSettings](#usersettings) |
| 30 | `PATCH /api/me/settings` | 보낸 키만 바꾸고 전체 설정 반환. `null`이면 기본값 | 설정 키 객체 (필수, OpenAPI는 [JsonNode](#jsonnode)) | `200` → [UserSettings](#usersettings) |
| 31 | `GET /api/mates/{mateId}` | 메이트 상세: 모델 · 일러스트 · 세계관 · 내 역할 · 인트로 · 목소리 샘플 · 준비 중 · 이전 대화 여부 | 없음 | `200` → [MateDetailResponse](#matedetailresponse) |
| 43 | `GET /api/notifications` | 알림 목록, 최신순 | query `before` · `size` | `200` → [NotificationList](#notificationlist) |
| 44 | `POST /api/notifications/read` | 알림 읽음. `ids`가 없으면 전부 | [ReadRequest](#readrequest) (선택) | `200` → [Unread](#unread) |
| 45 | `POST /api/beta/waitlist` | 정원이 찼을 때 출시 알림 이메일. **로그인 없이** | [WaitlistRequest](#waitlistrequest) (필수) | `204` |
| 46 | `POST /api/mates/{mateId}/alert` | 준비 중 메이트 '알림 받기' | 없음 | `204` |
| 48 | `GET /api/login-mates` | 로그인 전 화면의 메이트와 모델. **로그인 없이**, `Cache-Control: public, max-age=300` | 없음 | `200` → [LoginMatesResponse](#loginmatesresponse) |

### 3.3. 연결 (태그: 공부 세션)

| 번호 | 메서드·경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| 16 | `POST /api/connections` | 메이트 1명과 연결 시작 + 메이트 · 내 아바타 모델, 설정, 인사, 친밀도, 크레딧, 배경 | [StartRequest](#startrequest) (필수) | `201` → [StartResponse](#startresponse) |
| 17 | `POST /api/connections/{connectionId}/resume` | 비정상 종료된 연결 이어하기. 끊긴 동안은 시간에 안 들어감 | 없음 | `200` → [ResumeResponse](#resumeresponse) |
| 18 | `POST /api/connections/{connectionId}/events` | 카메라 상태 · 말 걸기 타이머 1건 → `eventId` + 반응 표정. type은 `PRESENT` · `AWAY` · `RETURN` · `IDLE_TALK` | [EventRequest](#eventrequest) (필수) | `201`, 같은 이벤트 재전송 `200`(OpenAPI 200) → [EventResponse](#eventresponse) |
| 21 | `POST /api/connections/{connectionId}/heartbeat` | 1분마다 생존 신호 + 누적 시간 4개 → 청소년 남은 시간 · 단계 상승 미리보기 | [HeartbeatRequest](#heartbeatrequest) (OpenAPI 선택, 서버는 필수) | `200` → [HeartbeatResponse](#heartbeatresponse) |
| 37 | `GET /api/mates/me` | 한 번이라도 연결한 메이트: 친밀도 · 해금 · 최근 기록 | 없음 | `200` → [MyMatesResponse](#mymatesresponse) |
| 38 | `GET /api/records` | 기간별(WEEK · MONTH · YEAR) 시간 · 달력 칸 · 메이트별 · 최근 연결 | query `range`(필수) · `date` · `mateId` | `200` → [RecordsResponse](#recordsresponse) |

### 3.4. 대화

| 번호 | 메서드·경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| 19 | `POST /api/connections/{connectionId}/events/{eventId}/reaction` | `eventId`로 메이트 대사(LLM) · 표정. `tts: true`면 대사 음성(20 크레딧) | [ReactionRequest](#reactionrequest) (필수) | `200` → [ReactionResponse](#reactionresponse) |
| 20 | `POST /api/connections/{connectionId}/messages` | 대화 → 답장 · 표정 · 호감도 · 크레딧 · 안전 · 배경. 음성 없음 | [MessageRequest](#messagerequest) (필수) | `200` → [MessageResponse](#messageresponse) |
| 28 | `POST /api/connections/{connectionId}/messages/stream` | 20과 같은 대화를 SSE로. 음성은 여기서만 | [MessageRequest](#messagerequest) (필수) | `200` `text/event-stream` (OpenAPI [SseEmitter](#sseemitter)) |
| 32 | `GET /api/mates/{mateId}/messages` | 이 메이트와의 대화방 기록(이전 연결 포함), 최신순 커서 | query `cursor` · `size` | `200` → [ChatRoomResponse](#chatroomresponse) |
| 40 | `PUT /api/messages/{requestId}/rating` | 답장 평가 UP · DOWN · null(취소) | [MessageRatingRequest](#messageratingrequest) (필수) | `204` |
| 41 | `POST /api/messages/{requestId}/report` | 답장 신고. 대화방과 다음 답장의 이전 대화에서 빠짐 | [MessageReportRequest](#messagereportrequest) (필수) | `201` → [MessageReportResponse](#messagereportresponse) |
| 47 | `POST /api/mates/{mateId}/conversation/reset` | 대화 초기화: 대화방 기록 가림 · 지난 대화 카드 · 기억한 사실 삭제. 연결 중이면 409 | 없음 | `204` |

### 3.5. 연결 기록 (태그: 리포트)

| 번호 | 메서드·경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| 22 | `POST /api/connections/{connectionId}/end` | 연결 끊기 + 정산 + 친밀도 · 초대 보상. 이미 끝났으면 같은 결과 | [EndRequest](#endrequest) (필수) | `200` → [ReportResponse](#reportresponse) |
| 23 | `GET /api/connections/{connectionId}` | 연결 기록 다시 불러오기 (22와 같은 응답) | 없음 | `200` → [ReportResponse](#reportresponse) |
| 42 | `POST /api/feedback` | 베타 피드백: 연결 기록 위 평가(하루 1번) · 의견 보내기 | [FeedbackRequest](#feedbackrequest) (필수) | `201` → [FeedbackCreated](#feedbackcreated) |

### 3.6. 크레딧 · 초대

| 번호 | 메서드·경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| 33 | `GET /api/credits` | 오늘 남은 · 출석분 · 초대분 · 오늘 쓴 양 · 초대 보상 횟수 | 없음 | `200` → [CreditSummaryResponse](#creditsummaryresponse) |
| 34 | `GET /api/credits/transactions` | 크레딧 내역, 최신순 커서 | query `filter` · `cursor` · `size` | `200` → [CreditTransactionsResponse](#credittransactionsresponse) |
| 35 | `GET /api/referrals/me` | 내 코드 · 링크 · 보상 수 · 초대한 친구 · 코드 입력 가능 여부 | 없음 | `200` → [ReferralStatus](#referralstatus) |
| 36 | `POST /api/referrals` | 받은 초대 코드 입력. 가입 7일 안 한 번 | [EnterReferralRequest](#enterreferralrequest) (필수) | `201` → [ReferralEntered](#referralentered) |
| 39 | `GET /api/referrals/{code}` | 누구 코드인지 확인. **로그인 없이** | 없음 | `200` → [ReferralEntered](#referralentered) |

### 경로 · 쿼리 · 쿠키 파라미터

| 작업 | 위치 · 이름 | 타입 | 필수 | 값 · 제약 (코드 · 명세 기준) |
|---|---|---|---|---|
| 7 · 24 | cookie `refresh_token` | string | 아니요 | 없거나 폐기된 토큰이어도 24는 204 |
| 17 · 18 · 19 · 20 · 21 · 22 · 23 · 28 | path `connectionId` | integer (int64) | 예 | 내 연결이 아니면 404 `CONNECTION_NOT_FOUND` |
| 19 | path `eventId` | integer (int64) | 예 | 18 응답의 값 |
| 31 · 32 · 46 · 47 | path `mateId` | integer (int64) | 예 | 없거나 비활성 404 `MATE_NOT_FOUND` |
| 32 | query `cursor` | string | 아니요 | 앞 응답의 `nextCursor` |
| 32 · 34 | query `size` | integer | 아니요 | 기본 20, 최대 50. 범위 밖 400 |
| 34 | query `filter` | string | 아니요 | `ALL`(기본) · `ATTENDANCE` · `USE` · `INVITE` |
| 34 | query `cursor` | string | 아니요 | 앞 응답의 `nextCursor` |
| 38 | query `range` | string | **예** (OpenAPI는 선택) | `WEEK`(월~일) · `MONTH` · `YEAR`. 없으면 400 |
| 38 | query `date` | string | 아니요 | 기준 날짜 `YYYY-MM-DD`. 기본 오늘(오전 5시 기준) |
| 38 | query `mateId` | integer | 아니요 | 주면 그 메이트 연결만 |
| 39 | path `code` | string | 예 | 대소문자 무시 |
| 40 · 41 | path `requestId` | string | 예 | 32 `messages[].requestId` (내 대화방의 답장) |
| 43 | query `before` | integer (int64) | 아니요 | 이 id보다 오래된 것부터 |
| 43 | query `size` | integer | 아니요 | 1~50, 기본 20 |

## 4. 흐름과 규칙

### 4.1. 가입 · 로그인 · 온보딩

```text
GET  /api/login-mates                   → 로그인 화면 메이트 모델 (로그인 없이)
GET  /api/terms                         → 필수 약관 버전 id
POST /api/auth/email/verification       → 202 { expiresInSeconds: 300 }
POST /api/auth/email/verification/confirm → { verificationToken }
(초대 링크로 왔으면) GET /api/referrals/{code} → { inviterNickname, rewardOnFirstConnection }
POST /api/auth/email/signup { verificationToken, password, nickname, agreedTermVersionIds, birthDate, deviceHash }
     → 201 { accessToken, userId, onboardingRequired: true }
POST /api/auth/social/KAKAO { code, redirectUri, deviceHash } → { …, isNewUser, onboardingRequired }
GET  /api/me → onboardingRequired = (아바타 없음 || 생년월일 없음)
GET  /api/avatars
PATCH /api/me { avatarId, birthDate(카카오 · 베타 전 가입자), honorific?, aboutMe? } → onboardingRequired false
(가입 7일 안) POST /api/referrals { code, deviceHash }
```

- 카카오 가입자와 베타 전 가입자는 생년월일이 없어 `onboardingRequired = true`가 된다. 온보딩에서 10으로 생년월일을 받아야 홈으로 간다(`api.md` 6 · 8).
- 생년월일은 한 번만 저장된다(이미 있으면 무시). 만 14세 미만이면 저장하지 않고 400 `UNDER_14`.
- 베타 정원: 탈퇴하지 않은 가입자 수가 운영 설정 `betaMaxUsers`(기본 100) 이상이면 4 · 6(새 가입)이 403 `BETA_FULL` → 45 출시 알림 신청.
- `deviceHash`는 프런트가 만드는 기기 값(1~64자). 가입 기기를 `signup_devices`에 남겨 초대 부정을 막는다(같은 기기면 36이 400 `REFERRAL_SAME_DEVICE`).

### 4.2. 연결 (시작 → 진행 → 끊기)

```text
POST /api/connections { mateId }
  → 201 connectionId, mate/avatar(Figure), me, settings, firstMeet, greeting, relation, credits,
        minorRemainingSeconds, backgrounds, background
연결 중:
  카메라에 얼굴이 보이기 시작   → 18 { type: PRESENT }      (reaction null)
  10초 이상 안 보임            → 18 { type: AWAY, occurredAt: 안 보이기 시작한 시각 } → 19 { intensity 1 } → 1분 2 → 5분 3
  다시 보임                   → 18 { type: RETURN } → 19
  말 걸기 타이머               → 18 { type: IDLE_TALK } → 19 (IDLE 대사)
  사용자 말                    → 28 stream (또는 20)
  1분마다                     → 21 heartbeat { connectedSeconds, presentSeconds, cameraOnSeconds, pipSeconds }
끊기:
  POST /api/connections/{id}/end { 누적 4개, endType } → ReportResponse
  GET  /api/connections/{id}                          → 같은 ReportResponse (새로고침)
```

- 연결 시간 제한은 없다(목표 시간 삭제). 만 19세 미만은 하루 3시간: 16이 403 `MINOR_DAILY_LIMIT`, 21의 `minorRemainingSeconds`가 0이면 프런트가 22를 `MINOR_LIMIT`로 부른다.
- 이미 진행 중이면 16이 409 `CONNECTION_ALREADY_IN_PROGRESS` + `detail.connectionId` → 이어하기 팝업.
- 준비 중 메이트는 409 `MATE_COMING_SOON`, 온보딩 전이면 403 `ONBOARDING_REQUIRED`.
- 쉬는 시간(BREAK) 개념은 없어졌다. 17 이어하기도 BREAK · FOCUS를 넣지 않는다.
- 카메라를 끄면 `AWAY`를 보내지 않는다. 자리 비움 10분(카메라를 끈 경우 입력 없음 10분)이면 프런트가 메이트 인사 뒤 22를 `AUTO_AWAY`로 부른다.

**비정상 종료.** heartbeat가 2분 넘게 없으면 끊긴 상태로 기다린다. 8 · 11의 `activeConnection` → 이어하기 팝업 → 17. 6시간 동안 이어하지 않으면 배치가 `AUTO_CLOSED`로 마감하고 마지막 heartbeat 값으로 정산한다. 17이 409 `CONNECTION_ENDED`면 23으로 간다.

**heartbeat · 끊기 검사.** `0 ≤ presentSeconds ≤ cameraOnSeconds ≤ connectedSeconds ≤ 시작부터 지난 시간`, `0 ≤ pipSeconds ≤ connectedSeconds`. 어기거나 본문이 없으면 400 `INVALID_CONNECTION_TIME`. 21은 400이어도 생존 신호(`last_heartbeat_at`)는 갱신한다.

### 4.3. 이벤트와 반응 (18 · 19)

| 18 type | 언제 | 18 `reaction.trigger` | 19 부르기 |
|---|---|---|---|
| `PRESENT` | 얼굴 감지 시작(처음 · 카메라를 다시 켬) | 없음(`reaction` null) | 안 부름 |
| `AWAY` | 10초 이상 안 보임 | `AWAY`, `intensity` = 이 연결에서 몇 번째(1~3) | `intensity` 1 → 1분 뒤 2 → 5분 뒤 3 (같은 `eventId`) |
| `RETURN` | 자리 비움 뒤 다시 보임 | `RETURN` | `eventId`만 |
| `IDLE_TALK` | 말 걸기 타이머 | `IDLE` | `eventId`만 → 메이트가 먼저 거는 말 |

코드 근거: `session/domain/SessionEvent.java:32`(허용 type), `session/service/SessionService.java:515`(18 반응), `dialogue/service/DialogueService.java:800`(19 trigger). 그 밖의 type(옛 `FOCUS` · `BREAK` · `DROWSY` · `YAWN` · `WAVE` · `HEAD_TURN`)은 400 `INVALID_EVENT`. 같은 (`type`, `occurredAt`) 재전송은 200 + 기존 응답.

- 인사는 18 · 19가 아니라 16 응답의 `greeting`이다(`trigger: GREETING`, 지금 `line`은 null이고 `expression`만 있음).
- 18의 `reaction.expression`은 **문자열** 표정 이름이다. 19 · 20 · 28의 `expression`은 객체 [ExpressionRef](#expressionref)다.
- 19는 LLM이 대사를 만들고 결정 모델이 표정을 고른다. 7초를 넘거나 실패하면 미리 쓴 대사(`fallback: true`).
- 19의 응답 `requestId`가 마지막으로 보낸 값이 아니면 버린다(복귀했는데 늦게 온 '자리 비웠어?' 방지).

**말 걸기 (`IDLE_TALK`, 2026-11-25, J-20 임시값).** 타이머는 프런트, 대사는 서버(19)가 만든다.

1. 설정 `talkFrequency`가 `QUIET`면 안 함, `SOMETIMES` 3분, `OFTEN` 1분.
2. 마지막 대화(사용자 말 · 받은 답장 · 반응 대사) 뒤로 그 시간 동안 대화가 없고 얼굴이 보이는 상태(`PRESENT` · `RETURN` 뒤)일 때 보낸다. 자리 비움 중에는 멈추고 돌아오면 처음부터 센다. 보낸 뒤에도 처음부터 센다.
3. 크레딧: **대사는 무료.** `tts: true`로 음성을 받으면 20 (`api.md` 19 '음성').

### 4.4. 대화 (20 · 28)

- 요청 `{ requestId, characterId, content(1~300자), inputType(TEXT · QUICK · VOICE), mode?, tts? }`. `characterId`는 연결 중인 메이트 id(= `mateId`).
- 같은 `requestId`는 한 번만 처리하고 저장된 답장을 돌려준다(재전송은 `affinity.delta` 0, 표정 null, 속도 제한에 안 셈).
- **28 이벤트:** `reply`(지금까지 글 전체) 0번 이상 → `done`(20 응답 전체) 1번. 음성이 켜진 턴은 `audio { seq, format: "mp3", data }` 조각이 사이사이와 `done` 뒤에 오고 마지막에 `audio_end { chunks, complete }`. 스트림 도중 오류는 `done` 대신 `error`. 스트림을 열기 전 오류는 보통 JSON 오류 응답이다.
- 28은 `Accept: text/event-stream, application/json`을 보낸다. `EventSource`가 아니라 `fetch`로 부른다.
- 첫 글자를 7초 안에 못 보내면 대체 대사(`reply` 없이 `done`만). 첫 글자를 보낸 뒤에는 끝까지 기다린다.
- 안전: 사용자 말을 LLM 전에 검사해서 위반이면 정해진 거절 대사 + `safety: "WARNING"`. 24시간 안에 3번이면 24시간 대화 정지(20 · 28이 403 `CHAT_SUSPENDED`, `detail.until`). 탐지 기준은 확정 필요(지금은 아무것도 잡지 않음).
- 배경: 답장 뒤 결정 모델이 배경을 바꿀 수 있다. 바뀌면 `background` 객체, 아니면 null.

### 4.5. 크레딧 규칙 (`api.md` 33, `dialogue/service/DialogueService.java:97-99`, `credit/service/CreditService.java:35`)

| 항목 | 값 |
|---|---|
| 출석분 | 하루 1,500. 다음 오전 5시에 남은 만큼 사라짐. 배치 없이 **그날 처음 크레딧을 읽거나 쓸 때** 지급 · 소멸(8 · 16 · 33 · 34 · 차감) |
| 초대분 | 친구 초대 보상 1,000. 사라지지 않음 |
| 쓰는 순서 | 출석분부터 |
| 기본 모드 대화 | 0 (크레딧이 0이어도 계속) |
| 고급 모드 (`mode: ADVANCED`) | 1턴 30. 잔액이 30보다 적으면 409 `CREDIT_INSUFFICIENT`(아무것도 저장 안 함) → 기본 모드로 다시 보냄 |
| 보이스 (28 `tts: true`) | 20. 고급 모드와 같이면 50. 모자라면 음성 없이 글만(오류 아님) |
| 반응 대사 음성 (19 `tts: true`) | 20. 모자라면 음성 없이 글만 |
| 말 걸기 대사 (18 `IDLE_TALK` → 19) | 0 (음성을 받을 때만 20) |
| 차감 시점 | 답장이 성공한 뒤, 같은 `requestId`는 한 번만. 대체 대사 · 안전 경고 턴은 0 |
| 음성 켜짐 조건 | 요청 `tts: true` + 설정 `voiceEnabled` true + 잔액이 이번 턴 비용 이상 |
| 내역 문구 | `고급 모드 · 채린` · `보이스 대화 · 채린` · `고급 모드 · 보이스 대화 · 채린`, 출석 `출석`, 소멸 `출석분 소멸`, 초대 `친구 초대 · <닉네임>님 …` |

음성 공급자는 운영 설정(`capsule.tts`)이고 기본값은 무음 mp3를 주는 가짜 공급자다. 운영 배포의 공급자 설정은 저장소로 확인할 수 없다(확인 필요).

### 4.6. 초대 규칙 (`api.md` 36, `user/service/ReferralService.java`)

- 코드 입력은 가입 후 7일 안에 한 번. 자기 코드 · 같은 기기는 거절. 대소문자 무시. 탈퇴한 사람의 코드는 없는 코드.
- 보상은 입력할 때가 아니라 **입력한 뒤 처음 끝나는 연결(22)**에서: 받은 사람 1,000 · 초대한 사람 1,000. 초대한 사람 몫은 10명까지.
- 22 · 23의 `referralReward`로 보상을 알 수 있고, 43 알림(`REFERRAL_REWARD`)도 생긴다.

### 4.7. 친밀도 규칙 (`api.md` 22, 숫자는 추천값)

- 인정 시간 = min(이번 `presentSeconds`, 오늘 남은 인정 한도). 하루 한도 2시간.
- 그날 이 메이트와 대화가 한 턴도 없으면 인정 시간은 절반.
- 단계 = 누적 인정 시간: 1 (0) · 2 (1시간) · 3 (5시간) · 4 (15시간) · 5 (40시간). 내려가지 않음.
- 단계가 오르면 해금 콘텐츠(`EXPRESSION` · `VOICE_LINE`)가 열린다. 21 `stageUp`은 연결 중 미리보기, 실제 정산은 22.
- 호감도(`affinity`, 대화 점수 0~100)는 따로 남아 20 · 28에만 나온다. 연결 기록에는 친밀도만 나온다.

### 4.8. 설정 (29 · 30)

| 키 | 값 (기본) | 서버에서 쓰는 곳 |
|---|---|---|
| `talkFrequency` | `QUIET` · `SOMETIMES` · `OFTEN` (`SOMETIMES`) | 저장만. 타이머는 프런트(4.3) |
| `voiceEnabled` | boolean (true) | 19 · 28 음성 켜짐 조건 |
| `voiceVolume` | 0~100 (70) | 저장만 |
| `voiceSpeed` | `SLOW` · `NORMAL` · `FAST` (`NORMAL`) | TTS 말 빠르기 (`dialogue/service/VoiceStreams.java:53`) |
| `pipBubble` | boolean (true) | 저장만 |
| `defaultMode` | `BASIC` · `ADVANCED` (`BASIC`) | 저장만. 실제 모드는 요청 `mode` |
| `pipSize` | `S` · `M` · `L` (`M`) | 저장만 |

마이크 · 카메라 기기, 단축키, 시선 따라오기는 서버에 없다(브라우저 저장). 16 응답 `settings`에 같은 7개가 온다.

### 4.9. 메이트 모델 (`ModelInfo` · `Figure`)

- `format`은 `CUBISM`(Cubism `.model3.json`) 또는 `ALIVING2D_V2`(Aliving2D 묶음 `model.json`). 새로 넣는 모델의 기본값은 `ALIVING2D_V2`. 아바타는 `CUBISM` 유지로 확정.
- `engineUrl` · `playerUrl` · `reactionsUrl`은 관리용 API(`PUT /internal/content/models/{modelId}/runtime`)로 등록해야 채워진다. 없으면 null.
- 모든 주소는 `CDN 주소 + 저장 경로`다(`content/adapter/ContentMapper.java` `model()`). 모델 · 엔진 파일은 Supabase Storage 공개 버킷의 버전 고정 경로(`<이름>/v<번호>/`, `aliving2d/v<번호>/`)에 있고 버킷 CORS는 `*`(`api.md` 48).
- 48 로그인 화면 메이트의 `model`은 31 메이트 상세의 `model`과 **같은 매퍼에서 나온 같은 값**이다(주소에 쿼리 · 서명 없음). 16 · 17의 `mate`(Figure)도 같은 매퍼에서 나온다.
- 표정은 `name`(반응 응답의 `expression` 값, 한국어 이름)으로 켠다.

**2026-11-25 운영 응답(48, 로그인 없이 GET).** 아래 `<CDN>`은 Supabase Storage 공개 버킷 주소다.

| id | 이름 | format | modelJsonUrl | 카드 이미지 | 엔진 3필드 |
|---|---|---|---|---|---|
| 1 | 말포이 | `CUBISM` | `<CDN>/live2d-model/chaerin/v3/chaerin.model3.json` | 없음 | null |
| 2 | 서진 | `ALIVING2D_V2` | `<CDN>/live2d-model/seojin/v5/model.json` | 있음 | null |
| 3 | 서진 | `ALIVING2D_V2` | `<CDN>/live2d-model/seojin/v4/model.json` | 없음 | null |
| 4 | 채린 | `ALIVING2D_V2` | `<CDN>/live2d-model/chaerin/v5/model.json` | 있음 | null |

운영 데이터는 바뀔 수 있다. 프런트 영향은 [갭 분석 §3](API_FRONT_GAP_2026-11-25.md#3-로그인-졸던-채린--48)에 정리했다.

## 5. 작업별 오류 코드

공통 오류(2장)는 빼고 적었다. 코드 근거: `user/domain/UserErrorCode.java`, `session/domain/SessionErrorCode.java`, `dialogue/domain/DialogueErrorCode.java`, `content/domain/ContentErrorCode.java`, 각 절의 `api.md`.

| 번호 | 오류 |
|---|---|
| 2 | 400 `INVALID_EMAIL` · 409 `EMAIL_ALREADY_USED` · 429 `TOO_MANY_REQUESTS` |
| 3 | 400 `INVALID_CODE`(`detail.remainingAttempts`) · `CODE_EXPIRED` · 429 `TOO_MANY_ATTEMPTS` |
| 4 | 400 `INVALID_PASSWORD` · `INVALID_NICKNAME` · `TERMS_REQUIRED` · `VERIFICATION_EXPIRED` · `UNDER_14` · `INVALID_BIRTH_DATE` · `INVALID_REQUEST`(`deviceHash`) · 403 `BETA_FULL` · 409 `EMAIL_ALREADY_USED` |
| 5 | 401 `INVALID_CREDENTIALS` · 429 `LOGIN_LOCKED`(5회 실패 10분) |
| 6 | 400 `INVALID_REQUEST`(`deviceHash` 없음) · 401 `SOCIAL_AUTH_FAILED` · 403 `BETA_FULL`(새 가입만) |
| 7 | 401 `REFRESH_TOKEN_INVALID` |
| 8 | 401 `AUTH_TOKEN_EXPIRED` |
| 10 | 400 `INVALID_NICKNAME` · `AVATAR_NOT_FOUND` · `UNDER_14` · `INVALID_BIRTH_DATE` · `INVALID_HONORIFIC` · `INVALID_ABOUT_ME` |
| 16 | 403 `ONBOARDING_REQUIRED` · `MINOR_DAILY_LIMIT` · 404 `MATE_NOT_FOUND` · 409 `MATE_COMING_SOON` · `CONNECTION_ALREADY_IN_PROGRESS`(`detail.connectionId`) |
| 17 | 404 `CONNECTION_NOT_FOUND` · 409 `CONNECTION_ENDED` |
| 18 | 400 `INVALID_EVENT` · 404 `CONNECTION_NOT_FOUND` · 409 `CONNECTION_ENDED` |
| 19 | 400 `INVALID_REQUEST`(`requestId` 없음 · AWAY `intensity` 범위 밖) · 404 `CONNECTION_NOT_FOUND` · `EVENT_NOT_FOUND` · 409 `CONNECTION_ENDED` |
| 20 · 28 | 400 `EMPTY_MESSAGE` · `INVALID_REQUEST`(300자 초과 · 없는 `inputType` · `mode`) · `CHARACTER_NOT_IN_SESSION` · 403 `CHAT_SUSPENDED`(`detail.until`) · 404 `CONNECTION_NOT_FOUND` · 409 `CONNECTION_ENDED` · `CREDIT_INSUFFICIENT`(`detail.credits`) · 429 `TOO_MANY_REQUESTS`(1분 30번). 28의 스트림 도중 오류는 `error` 이벤트(예: `CONNECTION_ENDED`) |
| 21 | 400 `INVALID_CONNECTION_TIME` · 404 `CONNECTION_NOT_FOUND` · 409 `CONNECTION_ENDED` |
| 22 | 400 `INVALID_CONNECTION_TIME` · `INVALID_REQUEST`(모르는 `endType`) · 404 `CONNECTION_NOT_FOUND` |
| 23 | 404 `CONNECTION_NOT_FOUND` · 409 `CONNECTION_IN_PROGRESS` |
| 25 | 400 `INVALID_EMAIL` · 429 `TOO_MANY_REQUESTS` |
| 26 | 400 `INVALID_PASSWORD` · `RESET_TOKEN_INVALID` |
| 27 | 409 `CONNECTION_IN_PROGRESS` |
| 30 | 400 `INVALID_SETTINGS` |
| 31 · 32 | 404 `MATE_NOT_FOUND` (32는 400 `INVALID_REQUEST`도: size · cursor) |
| 34 | 400 `INVALID_REQUEST`(filter · size · cursor) |
| 36 | 400 `INVALID_REQUEST` · `REFERRAL_SELF` · `REFERRAL_EXPIRED` · `REFERRAL_SAME_DEVICE` · 404 `REFERRAL_CODE_NOT_FOUND` · 409 `REFERRAL_ALREADY_ENTERED` |
| 38 | 400 `INVALID_REQUEST`(`range` 없음 · 형식) |
| 39 | 404 `REFERRAL_CODE_NOT_FOUND` · 429 `TOO_MANY_REQUESTS` |
| 40 | 400 `INVALID_REQUEST` · 404 `MESSAGE_NOT_FOUND` |
| 41 | 400 `INVALID_REQUEST` · 404 `MESSAGE_NOT_FOUND` · 409 `ALREADY_REPORTED` |
| 42 | 400 `INVALID_REQUEST` · 409 `FEEDBACK_ALREADY_TODAY` |
| 45 | 400 `INVALID_EMAIL` · 429 `TOO_MANY_REQUESTS` |
| 46 | 404 `MATE_NOT_FOUND` · 409 `MATE_ALREADY_OPEN` |
| 47 | 404 `MATE_NOT_FOUND` · 409 `CONNECTION_IN_PROGRESS` |
| 48 | 429 `TOO_MANY_REQUESTS` |

## 6. 현재 프런트와의 관계 (요약)

프런트는 아직 11-22 계약(`/api/sessions/*`, `rooms`, 목표 시간, 이벤트 8종)으로 부른다. 그래서 실제 서버에 붙이면 **홈 조회부터 실패한다.** 자세한 목록 · 우선순위 · 작업 순서는 [프런트 연결 갭 분석](API_FRONT_GAP_2026-11-25.md)에 있다.

## 7. 백엔드 명세에 "확정 필요"로 남은 것

| 항목 | 내용 (`api.md` 위치) |
|---|---|
| 고급 모드 모델 | 운영 설정 `capsule.llm.advanced-model`. 정해지기 전까지 기본 모드와 같은 모델 (20) |
| 안전 탐지 기준 | 판정 자리만 있고 아무것도 잡지 않음. 정지 횟수 · 기간 (20 '안전') |
| 말 걸기 조건 · 말투 | 간격은 확정(3분 · 1분), 조건 · 말투는 J-20 임시 (18) |
| 메이트 목소리 | 메이트별 목소리 선택 J-10 (28 '음성') |
| 친밀도 수치 | 하루 한도 · 단계 기준은 베타 데이터로 조정. 오전 5시를 넘긴 연결의 21 미리보기와 22 정산 차이 (21 · 22) |
| 대화 초기화 성격 | 사용자 버튼인지, 안전 제재 단계인지 (47) |
| 운영 공지 알림 | 43에 운영 공지 · `MATE_OPEN` 알림은 아직 없음 (43 · 46) |
| 초대 11번째 | 받은 사람 몫도 막을지 (36) |
| 베타 정원 | 탈퇴자를 정원에서 뺄지 (4) |
| 카카오 약관 고지 | 정식 출시 전 고지 방식 (6) |
| 고정 대사 감정값 | `fallback: true`일 때 `emotion` 값 (19) |
| 스크린샷 첨부 | 베타 피드백 첨부는 파일 저장소가 정해지면 (42) |

## 8. 스키마 사전

114개 중 `ApiResponse*` 감싸기 30개를 뺀 **84개**를 이름순으로 적는다. "OpenAPI 필수"는 원본 `required` 배열 기준이고, 서버가 실제로 요구하는 값은 "의미 · 값" 열에 적었다. 출처를 따로 적지 않은 의미는 백엔드 `docs/specs/api.md`의 해당 번호 절이다.

감싸기 30개는 모두 `{ success: boolean, data: <스키마> }` 모양이다: `ApiResponseAccessTokenResponse`, `ApiResponseAvatarsResponse`, `ApiResponseChatRoomResponse`, `ApiResponseCreditSummaryResponse`, `ApiResponseCreditTransactionsResponse`, `ApiResponseEventResponse`, `ApiResponseExpiresResponse`, `ApiResponseFeedbackCreated`, `ApiResponseHeartbeatResponse`, `ApiResponseHomeResponse`, `ApiResponseKakaoResponse`, `ApiResponseLoginMatesResponse`, `ApiResponseLoginResponse`, `ApiResponseMateDetailResponse`, `ApiResponseMeResponse`, `ApiResponseMessageReportResponse`, `ApiResponseMessageResponse`, `ApiResponseMyMatesResponse`, `ApiResponseNotificationList`, `ApiResponseReactionResponse`, `ApiResponseRecordsResponse`, `ApiResponseReferralEntered`, `ApiResponseReferralStatus`, `ApiResponseReportResponse`, `ApiResponseResumeResponse`, `ApiResponseStartResponse`, `ApiResponseTermsResponse`, `ApiResponseUnread`, `ApiResponseUserSettings`, `ApiResponseVerificationResponse`.

### AccessTokenResponse

7 토큰 갱신 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `accessToken` | string | — | 새 액세스 토큰(30분). 리프레시 토큰은 쓸 때마다 교체 |

### ActiveSessionSummary

8 · 11의 `activeConnection`. 이름은 옛 이름 그대로

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `connectionId` | integer (int64) | — | 진행 중 연결 id |
| `mateId` | integer (int64) | — | 메이트 id(= 캐릭터 id) |
| `mateName` | string | — | 이어하기 팝업 '○○과 다시 연결할까요?' |
| `startedAt` | string (date-time) | — | 연결 시작 시각(UTC) |

### AffinityChange

20 · 28 응답 `affinity`. 대화로 바뀐 호감도(친밀도와 별개)

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `delta` | integer (int32) | — | 이번 변화. 0이면 변화 없음, `fallback`이면 0 |
| `points` | integer (int32) | — | 호감도 0~100 |
| `level` | integer (int32) | — | 옛 공부 레벨. 화면에 쓰지 않음 |
| `levelUp` | boolean | — | 옛 필드, 늘 false (api.md 18) |
| `stage` | integer (int32) | — | 호감도 기준 관계 단계. 22의 친밀도 단계와 같은 값인지는 확인 필요 |
| `stageName` | string | — | 위 단계 이름 (확인 필요) |

### AvatarItem

9 아바타 한 개

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 아바타 id(10 `avatarId`) |
| `name` | string | — | 이름 |
| `thumbnailUrl` | string | — | 썸네일. 프로필 이미지로도 쓰임 |
| `model` | [ModelInfo](#modelinfo) | — | [ModelInfo](#modelinfo). 아바타는 `CUBISM` 유지로 확정 (api.md 9, 2026-11-24) |

### AvatarsResponse

9 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `avatars` | array<[AvatarItem](#avataritem)> | — | 고를 수 있는 아바타. 시드는 3개(Haru · Hiyori · Natori, `db/seed/R__demo_content.sql`). 운영 DB 값은 미확인 |

### Background

20 · 28 응답 `background`. 이번 답장으로 바뀐 배경, 그대로면 null

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `code` | string | — | 배경 코드 |
| `name` | string | — | 이름 |
| `imageUrl` | string | — | 이미지 주소 |

### BackgroundView

16 · 17 `backgrounds[]`. 이 메이트의 배경 전체

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `code` | string | — | 배경 코드(16 · 17 `background` 값) |
| `name` | string | — | 이름 |
| `imageUrl` | string | — | 이미지 주소. 미리 받아 두고 20 · 28에서 바뀌면 교체 |

### Bucket

38 `buckets[]`. 기간 칸

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `key` | string | — | WEEK · MONTH = `YYYY-MM-DD`, YEAR = `YYYY-MM`. 연결이 없는 칸도 0으로 나옴 |
| `presentSeconds` | integer (int32) | — | 함께한 시간(초) |
| `connectedSeconds` | integer (int32) | — | 연결 시간(초) |

### ChatRoomResponse

32 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `messages` | array<[Message](#message)> | — | 최신순 [Message](#message). 신고(41) · 초기화(47)한 메시지는 빠짐 |
| `nextCursor` | string | — | 다음 요청 `cursor`. 더 없으면 null |

### ConfirmRequest

3 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `email` | string | — | 인증번호를 받은 이메일 |
| `code` | string | — | 6자리(문자열, 앞자리 0 유지) |

### CreditSummaryResponse

33 응답 = [Credits](#credits) + 아래 2개

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `todayRemaining` | integer (int32) | — | Credits와 같음 |
| `attendanceRemaining` | integer (int32) | — | Credits와 같음 |
| `attendanceExpiresAt` | string (date-time) | — | Credits와 같음 |
| `inviteBalance` | integer (int32) | — | Credits와 같음 |
| `low` | boolean | — | Credits와 같음 |
| `exhausted` | boolean | — | Credits와 같음 |
| `attendanceGrantedNow` | boolean | — | Credits와 같음 |
| `todayUsed` | integer (int32) | — | 오늘(오전 5시부터) 쓴 크레딧 |
| `invitedFriends` | integer (int32) | — | 초대 보상을 받은 횟수 |

### CreditTransactionsResponse

34 응답. **OpenAPI의 `items` 모양은 틀렸다**(아래 [Item](#item) 참고)

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `items` | array<[Item](#item)> | — | 실제 항목: `id` · `type`(`ATTENDANCE` · `INVITE` · `USE` · `EXPIRE`) · `title` · `change`(지급 +, 사용 · 소멸 −) · `balanceAfter` · `createdAt` (`credit/dto/CreditTransactionsResponse.java`) |
| `nextCursor` | string | — | 더 이전 내역. 없으면 null |

### Credits

8 · 16 · 20 · 28 · 19의 크레딧 요약 (api.md 33)

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `todayRemaining` | integer (int32) | — | 지금 쓸 수 있는 양 = 출석분 + 초대분 |
| `attendanceRemaining` | integer (int32) | — | 오늘 출석분 남은 양 (하루 1,500) |
| `attendanceExpiresAt` | string (date-time) | — | 출석분이 사라지는 시각(다음 오전 5시 KST) |
| `inviteBalance` | integer (int32) | — | 초대분 남은 양 (사라지지 않음) |
| `low` | boolean | — | `todayRemaining` < 100 |
| `exhausted` | boolean | — | `todayRemaining` = 0 |
| `attendanceGrantedNow` | boolean | — | 이 요청에서 오늘 출석분을 방금 지급했으면 true. 하루 한 번만 (출석 토스트) |

### EmailRequest

2 · 25 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `email` | string | — | 이메일. 서버가 소문자로 바꿈 |

### EndRequest

22 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `connectedSeconds` | integer (int32) | — | 연결 시작부터 누적 연결 시간(초). 필수 |
| `presentSeconds` | integer (int32) | — | 카메라가 켜져 있고 얼굴이 보인 시간. 필수 |
| `cameraOnSeconds` | integer (int32) | — | 카메라를 켠 시간. 필수 |
| `pipSeconds` | integer (int32) | — | PIP로 띄운 시간. 필수 |
| `endType` | string | — | `NORMAL`(기본) · `AUTO_AWAY`(자리 비움 · 입력 없음 10분) · `MINOR_LIMIT`(청소년 3시간). 모르는 값 400 `INVALID_REQUEST` |

### EnterReferralRequest

36 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `code` | string | — | 받은 초대 코드. 대소문자 무시 |
| `deviceHash` | string | — | 기기 값 1~64자. 필수 |

### EventRequest

18 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `type` | string | — | **`PRESENT` · `AWAY` · `RETURN` · `IDLE_TALK`만** (`session/domain/SessionEvent.java:32`). 그 밖은 400 `INVALID_EVENT` |
| `occurredAt` | string (date-time) | — | 발생 시각. `AWAY`는 안 보이기 시작한 시각. 연결 시작보다 이르면 시작 시각으로 맞춤 |

### EventResponse

18 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `eventId` | integer (int64) | — | 19에 쓰는 id |
| `reaction` | [ReactionView](#reactionview) | — | [ReactionView](#reactionview). `PRESENT`면 null |

### ExpiresResponse

2 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `expiresInSeconds` | integer (int32) | — | 인증번호 유효시간(300) |

### ExpressionRef

19 · 20 · 28의 표정

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `name` | string | — | 표정 이름(예: `삐짐`). Aliving2D는 `model.json`의 label로 찾음 (api.md 9) |
| `file` | string | — | Cubism 표정 파일 경로. 없으면 null |

### FeedbackCreated

42 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `feedbackId` | integer (int64) | — | 만든 피드백 id |

### FeedbackRequest

42 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `kind` | string | — | `RATING` · `BUG` · `SUGGESTION`. 필수 |
| `score` | integer (int32) | — | RATING이면 1~4 필수 |
| `text` | string | — | BUG · SUGGESTION이면 필수, 1,000자 이하. RATING은 선택 한 줄 |
| `connectionId` | integer (int64) | — | 연결 기록에서 보낼 때. 내 연결이어야 함 |

### Figure

16 · 17의 `mate` · `avatar`. [ModelInfo](#modelinfo)를 펼친 모양

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 메이트 또는 아바타 id |
| `name` | string | — | 이름 |
| `profileImageUrl` | string | — | 프로필 이미지 |
| `format` | string | — | `CUBISM` · `ALIVING2D_V2` (`content/api/ContentTypes.java`) |
| `modelJsonUrl` | string | — | 모델 주소 |
| `scale` | number (double) | — | Cubism 배치값 |
| `offsetX` | integer (int32) | — | Cubism 배치값 |
| `offsetY` | integer (int32) | — | Cubism 배치값 |
| `engineUrl` | string | — | Aliving2D `engine.js`. CUBISM이거나 없으면 null |
| `playerUrl` | string | — | Aliving2D `player.js`. 없으면 null |
| `reactionsUrl` | string | — | 반응표. 없으면 null |

### HeartbeatRequest

21 요청. 4개 모두 연결 시작부터 누적(초), 모두 필수

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `connectedSeconds` | integer (int32) | — | 연결 시간 |
| `presentSeconds` | integer (int32) | — | 함께한 시간 = 카메라 켜짐 + 얼굴 보임 |
| `cameraOnSeconds` | integer (int32) | — | 카메라 켠 시간 |
| `pipSeconds` | integer (int32) | — | PIP 시간. 검사: `0 ≤ present ≤ cameraOn ≤ connected ≤ 경과`, `0 ≤ pip ≤ connected` |

### HeartbeatResponse

21 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `minorRemainingSeconds` | integer (int32) | — | 만 19세 미만이면 오늘 남은 연결 시간(초), 아니면 null. 0이면 22를 `MINOR_LIMIT`로 |
| `serverTime` | string (date-time) | — | 서버 시각 |
| `stageUp` | [StageUp](#stageup) | — | [StageUp](#stageup). 이번에 단계가 오를 만큼 함께했으면, 아니면 null. 연결마다 단계당 한 번 |

### HomeResponse

11 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `todayPresentSeconds` | integer (int32) | — | 오늘(오전 5시 기준) 끝낸 연결의 함께한 시간 합 |
| `todayConnectedSeconds` | integer (int32) | — | 오늘 끝낸 연결의 연결 시간 합 |
| `activeConnection` | [ActiveSessionSummary](#activesessionsummary) | — | [ActiveSessionSummary](#activesessionsummary). 없으면 null |
| `lastMate` | [LastMate](#lastmate) | — | [LastMate](#lastmate). 연결한 적 없으면 null(첫 방문) |
| `mates` | array<[MateCard](#matecard)> | — | 활성 메이트 [MateCard](#matecard), 정렬 순서 |

### IntimacyView

22 · 23 `relation`. 친밀도 5단계 (api.md 22 '친밀도 규칙')

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `stageBefore` | integer (int32) | — | 끝나기 전 단계 1~5 |
| `stageAfter` | integer (int32) | — | 끝난 뒤 단계 1~5 |
| `stageName` | string | — | 끝난 뒤 단계 이름(메이트마다 다름) |
| `stageUp` | boolean | — | 단계가 올랐는지 |
| `creditedSeconds` | integer (int32) | — | 이번에 인정된 시간 |
| `nextStageSeconds` | integer (int32) | — | 다음 단계까지 남은 인정 시간. 5단계면 null |
| `stageProgress` | integer (int32) | — | 지금 단계 안 진행 **0~100**(정수). 5단계면 100 |
| `unlocked` | array<[Unlocked](#unlocked)> | — | 이번에 열린 [Unlocked](#unlocked) |

### Item

**OpenAPI 이름 충돌.** 같은 이름의 레코드 두 개가 하나로 합쳐져, 이 정의는 43 알림 항목 모양이다. 34 크레딧 내역 항목은 [CreditTransactionsResponse](#credittransactionsresponse) 참고

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 알림 id(44 `ids`, 43 `before`) |
| `type` | string | — | `STAGE_UP` · `ATTENDANCE` · `REFERRAL_REWARD` (api.md 43) |
| `title` | string | — | 제목 |
| `body` | string | — | 본문. 없으면 null |
| `link` | string | — | 누르면 갈 곳(`/mates/me` · `/credits` · `/credits/invite`). 없으면 null |
| `read` | boolean | — | 읽음 여부 |
| `createdAt` | string (date-time) | — | 만든 시각 |

### JsonNode

30 요청. **OpenAPI가 Jackson 내부 속성을 나열한 것**이고 실제로는 [UserSettings](#usersettings) 키 중 바꿀 것만 담은 객체. 모르는 키 · 허용 밖 값 · 타입 틀림은 400 `INVALID_SETTINGS`, `null`은 기본값으로

필드 표는 생략한다(OpenAPI의 `nodeType` · `textual` 등 24개는 요청 필드가 아님).

### KakaoRequest

6 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `code` | string | — | 카카오 인가 코드 |
| `redirectUri` | string | — | 카카오 앱에 등록한 리다이렉트 주소 |
| `deviceHash` | string | — | 기기 값 1~64자. **기존 사용자 로그인에도 필수** (`user/service/AuthService.java:189`). 새로 가입할 때만 저장 |

### KakaoResponse

6 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `accessToken` | string | — | 액세스 토큰(30분) |
| `userId` | integer (int64) | — | 사용자 id |
| `isNewUser` | boolean | — | 이번에 가입했는지 |
| `onboardingRequired` | boolean | — | 아바타 또는 생년월일이 없으면 true |

### LastMate

11 `lastMate`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 메이트 id |
| `name` | string | — | 이름 |
| `illustrationUrl` | string | — | 전신 일러스트 |

### LoginMatesResponse

48 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `mates` | array<[Mate](#mate)> | — | [Mate](#mate). 공개(준비 중 아님) · 활성 · 전연령 · 모델이 있는 메이트만, 정렬 순서. 없으면 `[]` |

### LoginRequest

5 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `email` | string | — | 가입한 이메일 |
| `password` | string | — | 비밀번호 |

### LoginResponse

4 · 5 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `accessToken` | string | — | 액세스 토큰(30분). 리프레시 토큰은 HttpOnly 쿠키 |
| `userId` | integer (int64) | — | 사용자 id |
| `onboardingRequired` | boolean | — | 가입 직후는 늘 true. 로그인은 아바타 또는 생년월일이 없으면 true |

### Mate

48 `mates[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 메이트 id |
| `name` | string | — | 이름 |
| `ageRating` | string | — | `ALL`만 나옴 |
| `cardImageUrl` | string | — | 모델 전 · 실패 때 정지 이미지(11 홈 카드와 같은 그림). 없으면 null |
| `model` | [ModelInfo](#modelinfo) | — | [ModelInfo](#modelinfo). 31 메이트 상세의 `model`과 **같은 매퍼 · 같은 값** (`content/controller/LoginMatesController.java` `view`) |

### MateCard

11 `mates[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 메이트 id |
| `name` | string | — | 이름 |
| `oneLiner` | string | — | 한 줄 소개. 없으면 null |
| `ageRating` | string | — | `ALL` · `ADULT` |
| `hashtags` | array<string> | — | 해시태그. 없으면 `[]` |
| `cardImageUrl` | string | — | 카드 이미지 |
| `comingSoon` | boolean | — | 준비 중이면 true |

### MateDetailResponse

31 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 메이트 id(= 캐릭터 id, 20 `characterId`와 같은 값) |
| `name` | string | — | 이름 |
| `oneLiner` | string | — | 한 줄 소개 |
| `ageRating` | string | — | `ALL` · `ADULT` |
| `hashtags` | array<string> | — | 해시태그 |
| `illustrationUrl` | string | — | 세로 일러스트 |
| `voiceSampleUrl` | string | — | '목소리 듣기' mp3. 대화 음성과 같은 목소리(ADR 0036). 없으면 null |
| `world` | string | — | 세계관 |
| `myRole` | string | — | 내 역할 |
| `intro` | string | — | 인트로 |
| `model` | [ModelInfo](#modelinfo) | — | [ModelInfo](#modelinfo). 준비 중이면 null |
| `comingSoon` | boolean | — | 준비 중이면 true → 연결 버튼 막기 |
| `hasConversation` | boolean | — | 이 메이트와 대화가 있으면 true → 32로 이전 대화 |

### MateRef

22 · 23 `mate`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 메이트 id |
| `name` | string | — | 이름 |
| `illustrationUrl` | string | — | 전신 일러스트 |
| `myRole` | string | — | 내 역할 |

### MateSummary

38 `mates[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `mateId` | integer (int64) | — | 메이트 id |
| `name` | string | — | 이름 |
| `presentSeconds` | integer (int32) | — | 기간 안 함께한 시간 |
| `connectedSeconds` | integer (int32) | — | 기간 안 연결 시간 |
| `connectionCount` | integer (int32) | — | 기간 안 연결 수 |
| `stage` | integer (int32) | — | 지금 친밀도 단계 |

### Me

16 · 17 `me`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `nickname` | string | — | 닉네임 |
| `honorific` | string | — | 메이트가 부르는 이름. 없으면 null |
| `profileImageUrl` | string | — | 아바타 썸네일 |

### MeResponse

8 · 10 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `userId` | integer (int64) | — | 사용자 id |
| `nickname` | string | — | 닉네임 |
| `email` | string | — | 이메일(카카오 가입은 null일 수 있음) |
| `onboardingRequired` | boolean | — | **아바타 또는 생년월일**이 없으면 true |
| `activeConnection` | [ActiveSessionSummary](#activesessionsummary) | — | [ActiveSessionSummary](#activesessionsummary). 없으면 null |
| `profileImage` | string | — | 아바타 썸네일. 아바타 전이면 null |
| `birthDate` | string (date) | — | `YYYY-MM-DD`. 없으면 null |
| `isMinor` | boolean | — | 만 19세 미만이면 true. 생년월일이 없으면 false |
| `honorific` | string | — | 호칭. 없으면 null |
| `aboutMe` | string | — | 나에 대해. 없으면 null |
| `referralCode` | string | — | 내 초대 코드(예: `CAP-XXXX`) |
| `credits` | [Credits](#credits) | — | [Credits](#credits). **이 조회에서 그날 출석 크레딧이 지급됨** |
| `loginType` | string | — | `EMAIL` · `KAKAO` |
| `unreadNotifications` | integer (int32) | — | 안 읽은 알림 수 |

### Message

32 `messages[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `requestId` | string (uuid) | — | 사용자 말과 그 답장이 같은 값. 40 · 41의 경로 값 |
| `sender` | string | — | `USER` · `MATE` |
| `content` | string | — | 내용 |
| `inputType` | string | — | 사용자 말만 `TEXT` · `QUICK` · `VOICE`, 답장은 null |
| `rating` | string | — | 답장에 남긴 평가 `UP` · `DOWN` · null |
| `createdAt` | string (date-time) | — | 시각 |
| `connectionId` | integer (int64) | — | 그 말을 나눈 연결 |

### MessageRatingRequest

40 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `rating` | string | — | enum `UP` · `DOWN` · `UP` · `DOWN` · null(취소) |

### MessageReportRequest

41 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `reason` | string | 예 | enum `INAPPROPRIATE` · `VIOLENT` · `OUT_OF_CHARACTER` · `OTHER` · `INAPPROPRIATE` · `VIOLENT` · `OUT_OF_CHARACTER` · `OTHER` |
| `detail` | string | — | minLength 0, maxLength 300 · 300자 이하. `OTHER`면 필수 |

### MessageReportResponse

41 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `reportId` | integer (int64) | — | 신고 id |

### MessageRequest

20 · 28 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `requestId` | string (uuid) | 예 | 프런트가 만든 UUID. 같은 값 재전송은 한 번만 처리 |
| `characterId` | integer (int64) | 예 | 연결 중인 메이트 id |
| `content` | string | 예 | minLength 0, maxLength 300 · 1~300자. 비면 400 `EMPTY_MESSAGE` |
| `inputType` | string | 예 | enum `TEXT` · `QUICK` · `VOICE` · `TEXT` · `QUICK` · `VOICE`(STT 글자) |
| `mode` | string | — | enum `BASIC` · `ADVANCED` · `BASIC`(기본, 0) · `ADVANCED`(1턴 30). 없으면 BASIC |
| `tts` | boolean | — | true면 음성. **28에서만** 음성 조각을 보냄, 20은 무시 |

### MessageResponse

20 응답, 28 `done`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `requestId` | string (uuid) | — | 요청 그대로 |
| `characterId` | integer (int64) | — | 요청 그대로 |
| `content` | string | — | 답장 |
| `emotion` | string | — | 표정 이름(표시 · 기록용, 고정 enum 아님) |
| `motion` | [MotionRef](#motionref) | — | [MotionRef](#motionref). 보통 null |
| `expression` | [ExpressionRef](#expressionref) | — | [ExpressionRef](#expressionref) |
| `affinity` | [AffinityChange](#affinitychange) | — | [AffinityChange](#affinitychange) |
| `fallback` | boolean | — | LLM 7초 초과 등으로 대체 대사를 썼는지 |
| `audioBase64` | string | — | 늘 null (음성은 28 `audio` 이벤트) |
| `mode` | string | — | enum `BASIC` · `ADVANCED` · 이 답장에 쓴 모드 |
| `charged` | integer (int32) | — | 이번 차감: 고급 30 · 보이스 20 · 둘 다 50. 대체 대사 · 안전 경고는 0 |
| `credits` | [Credits](#credits) | — | [Credits](#credits) 차감 뒤 |
| `safety` | string | — | 안전 경고 턴이면 `WARNING`, 아니면 null |
| `background` | [Background](#background) | — | [Background](#background). 바뀌었을 때만 |
| `voice` | boolean | — | 이번 턴에 음성을 보냈는지(28). 20 · 재전송은 false |

### ModelInfo

9 · 31 · 48의 `model`. 주소 규칙은 `content/adapter/ContentMapper.java` `model()`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `format` | string | — | `CUBISM`(Cubism `.model3.json`) · `ALIVING2D_V2`(Aliving2D 묶음 `model.json`) |
| `modelJsonUrl` | string | — | CDN 주소 + 저장 경로 |
| `scale` | number (double) | — | Cubism 배치값(Aliving2D는 의미 다름) |
| `offsetX` | integer (int32) | — | Cubism 배치값 |
| `offsetY` | integer (int32) | — | Cubism 배치값 |
| `engineUrl` | string | — | Aliving2D `engine.js`. 관리용 API로 등록하지 않았으면 null |
| `playerUrl` | string | — | Aliving2D `player.js`. 없으면 null |
| `reactionsUrl` | string | — | 반응표. 없으면 null |

### MotionRef

19 · 20 · 28의 모션

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `group` | string | — | 모션 그룹 |
| `file` | string | — | 모션 파일 |

### MyMate

37 `mates[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 메이트 id |
| `name` | string | — | 이름 |
| `cardImageUrl` | string | — | 카드 이미지 |
| `firstMetAt` | string (date-time) | — | 처음 연결 시작 시각 |
| `lastConnectedAt` | string (date-time) | — | 마지막 연결 시작 시각 |
| `connectionCount` | integer (int32) | — | 끝난 연결 수 |
| `totalPresentSeconds` | integer (int32) | — | 누적 함께한 시간 |
| `totalConnectedSeconds` | integer (int32) | — | 누적 연결 시간 |
| `relation` | [Relation](#relation) | — | [Relation](#relation) |
| `unlocks` | array<[Unlock](#unlock)> | — | 이 메이트의 해금 콘텐츠 전부 [Unlock](#unlock) |
| `recent` | array<[Recent](#recent)> | — | 최근 끝난 연결 5개. **실제 모양은 `connectionId` · `endedAt` · `presentSeconds` · `connectedSeconds`** (OpenAPI의 [Recent](#recent)는 38 모양으로 합쳐짐) |

### MyMatesResponse

37 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `mates` | array<[MyMate](#mymate)> | — | 마지막 연결이 최근인 순. 끝난 연결이 없으면 `[]` |

### NotificationList

43 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `items` | array<[Item](#item)> | — | [Item](#item)(알림 모양) |
| `unreadCount` | integer (int32) | — | 안 읽은 수(8 `unreadNotifications`와 같음) |
| `nextBefore` | integer (int64) | — | 다음 페이지 `before`. 끝이면 null |

### Now

16 `relation`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `stage` | integer (int32) | — | 친밀도 단계 1~5 |
| `stageName` | string | — | 단계 이름 |

### PasswordResetRequest

26 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `token` | string | — | 재설정 링크의 `token` |
| `newPassword` | string | — | 8자 이상, 72바이트 이하 |

### ReactionCharacter

19 `characters[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `characterId` | integer (int64) | — | 메이트 id |
| `content` | string | — | 말풍선 대사 |
| `emotion` | string | — | 표정 이름 |
| `motion` | [MotionRef](#motionref) | — | [MotionRef](#motionref) |
| `expression` | [ExpressionRef](#expressionref) | — | [ExpressionRef](#expressionref) |
| `fallback` | boolean | — | 대체 대사를 썼는지 |
| `audioBase64` | string | — | 대사 음성 mp3(base64). `tts: true` + 설정 음성 켬 + 크레딧 20 이상일 때만, 아니면 null |

### ReactionRequest

19 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `requestId` | string (uuid) | 예 | 프런트 UUID. 응답에 그대로 |
| `intensity` | integer (int32) | — | `AWAY`일 때만 1~3. 없으면 1. AWAY인데 범위 밖이면 400 |
| `tts` | boolean | — | true면 대사 음성(2026-11-25) |

### ReactionResponse

19 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `requestId` | string (uuid) | — | 요청 그대로. 마지막으로 보낸 값이 아니면 버림 |
| `characters` | array<[ReactionCharacter](#reactioncharacter)> | — | [ReactionCharacter](#reactioncharacter) |
| `charged` | integer (int32) | — | 음성을 만들었으면 20, 아니면 0 |
| `credits` | [Credits](#credits) | — | `tts: true`로 보냈을 때만, 아니면 null |

### ReactionView

16 `greeting`, 18 `reaction`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `trigger` | string | — | `GREETING`(16) · `AWAY` · `RETURN` · `IDLE` |
| `intensity` | integer (int32) | — | AWAY면 이 연결에서 몇 번째 자리 비움(1~3), 아니면 null |
| `line` | string | — | 지금은 늘 null. 대사는 19로 |
| `expression` | string | — | **문자열** 표정 이름(반응표). 없으면 null |
| `audio` | — | — | 지금은 늘 null |

### ReadRequest

44 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `ids` | array<integer (int64)> | — | 읽음 처리할 알림 id. 없으면 내 알림 전부 |

### Recent

**OpenAPI 이름 충돌.** 이 정의는 38 `recent[]` 모양이다. 37의 `recent[]`는 [MyMate](#mymate) 참고

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `connectionId` | integer (int64) | — | 연결 id(23으로) |
| `mateId` | integer (int64) | — | 메이트 id (38만) |
| `mateName` | string | — | 메이트 이름 (38만) |
| `endedAt` | string (date-time) | — | 끝난 시각 |
| `presentSeconds` | integer (int32) | — | 함께한 시간 |
| `connectedSeconds` | integer (int32) | — | 연결 시간 |

### RecordsResponse

38 응답. 연결은 시작한 날(오전 5시 기준)에 세고, 끝난 연결만

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `from` | string (date) | — | 기간 첫날 |
| `to` | string (date) | — | 기간 마지막 날 |
| `totalPresentSeconds` | integer (int32) | — | 기간 합 |
| `totalConnectedSeconds` | integer (int32) | — | 기간 합 |
| `connectedDays` | integer (int32) | — | 연결한 날 수 |
| `connectionCount` | integer (int32) | — | 연결 수 |
| `buckets` | array<[Bucket](#bucket)> | — | [Bucket](#bucket) |
| `mates` | array<[MateSummary](#matesummary)> | — | [MateSummary](#matesummary) |
| `recent` | array<[Recent](#recent)> | — | 기간 안 최근 끝난 연결 5개 [Recent](#recent) |

### ReferralEntered

36 · 39 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `inviterNickname` | string | — | 코드 주인 닉네임 |
| `rewardOnFirstConnection` | integer (int32) | — | 첫 연결이 끝나면 받을 양(1,000) |

### ReferralFriend

35 `friends[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `nickname` | string | — | 친구 닉네임. 탈퇴했으면 null |
| `status` | string | — | `JOINED`(코드 입력함) · `QUALIFIED`(첫 연결 완료) |
| `rewarded` | boolean | — | 내가 보상을 받았는지 |
| `joinedAt` | string (date-time) | — | 친구 가입 시각 |

### ReferralRewardView

22 · 23 `referralReward`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `amount` | integer (int32) | — | 이 연결로 받은 초대 보상(1,000). 받지 않았으면 객체가 null |

### ReferralStatus

35 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `code` | string | — | 내 초대 코드 |
| `link` | string | — | 초대 링크 `https://capsule.ai.kr/i/<code>`(서버 설정) |
| `rewardedCount` | integer (int32) | — | 보상받은 초대 수 |
| `maxRewards` | integer (int32) | — | 최대 10 |
| `rewardedCredits` | integer (int32) | — | 초대로 받은 크레딧(초대한 사람 몫 합) |
| `friends` | array<[ReferralFriend](#referralfriend)> | — | [ReferralFriend](#referralfriend), 최근 순 |
| `canEnterCode` | boolean | — | 받은 코드를 아직 입력할 수 있는지(입력 안 함 + 가입 7일 안) |
| `codeInputDeadline` | string (date-time) | — | 입력 마감(가입 + 7일). 입력했거나 지났으면 null |

### Relation

37 `relation`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `stage` | integer (int32) | — | 단계 1~5 |
| `stageName` | string | — | 단계 이름 |
| `nextStageName` | string | — | 다음 단계 이름. 5단계면 null |
| `nextStageSeconds` | integer (int32) | — | 다음 단계까지 남은 인정 시간. 5단계면 null |
| `stageProgress` | integer (int32) | — | 0~100 |

### ReportResponse

22 · 23 응답 (연결 기록)

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `connectionId` | integer (int64) | — | 연결 id |
| `startedAt` | string (date-time) | — | 시작 |
| `endedAt` | string (date-time) | — | 끝 |
| `endType` | string | — | `NORMAL` · `AUTO_CLOSED` · `AUTO_AWAY` · `MINOR_LIMIT` |
| `connectedSeconds` | integer (int32) | — | 연결 시간 |
| `presentSeconds` | integer (int32) | — | 함께한 시간 |
| `awaySeconds` | integer (int32) | — | 자리 비움(서버가 이벤트로 계산) |
| `cameraOnSeconds` | integer (int32) | — | 카메라 켠 시간(연결 기록 '함께한 시간(캠)') |
| `messageCount` | integer (int32) | — | 답장까지 받은 대화 턴 수 |
| `returnCount` | integer (int32) | — | 자리 비운 뒤 돌아온 횟수 |
| `mate` | [MateRef](#materef) | — | [MateRef](#materef) |
| `relation` | [IntimacyView](#intimacyview) | — | [IntimacyView](#intimacyview) |
| `closingLine` | string | — | 완료 대사(새로고침해도 같음) |
| `referralReward` | [ReferralRewardView](#referralrewardview) | — | [ReferralRewardView](#referralrewardview). 없으면 null |
| `betaFeedbackAvailable` | boolean | — | 오늘 베타 평가(42 RATING)를 아직 안 했으면 true |

### ResumeResponse

17 응답. 16과 같은 필드 + 마지막 heartbeat 누적값 (`startedAt` · `firstMeet` · `greeting` · `settings` · `relation` · `credits` 없음)

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `connectionId` | integer (int64) | — | 연결 id |
| `mate` | [Figure](#figure) | — | [Figure](#figure) |
| `avatar` | [Figure](#figure) | — | [Figure](#figure) |
| `me` | [Me](#me) | — | [Me](#me) |
| `connectedSeconds` | integer (int32) | — | 마지막 heartbeat 값(없으면 0) |
| `presentSeconds` | integer (int32) | — | 마지막 heartbeat 값 |
| `cameraOnSeconds` | integer (int32) | — | 마지막 heartbeat 값 |
| `pipSeconds` | integer (int32) | — | 마지막 heartbeat 값 |
| `minorRemainingSeconds` | integer (int32) | — | 청소년 남은 시간 또는 null |
| `serverTime` | string (date-time) | — | 서버 시각 |
| `backgrounds` | array<[BackgroundView](#backgroundview)> | — | [BackgroundView](#backgroundview) |
| `background` | string | — | 끊기기 전 마지막 배경 코드 |

### SettingsInfo

16 `settings` — [UserSettings](#usersettings)와 같은 7개

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `talkFrequency` | string | — | UserSettings 참고 |
| `voiceEnabled` | boolean | — | — |
| `voiceVolume` | integer (int32) | — | — |
| `voiceSpeed` | string | — | — |
| `pipBubble` | boolean | — | — |
| `defaultMode` | string | — | — |
| `pipSize` | string | — | — |

### SignupRequest

4 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `verificationToken` | string | — | 3에서 받은 토큰(10분) |
| `password` | string | — | 8자 이상, 72바이트 이하 |
| `nickname` | string | — | 1~20자 |
| `agreedTermVersionIds` | array<integer (int64)> | — | 필수 약관 버전 id |
| `birthDate` | string | — | `YYYY-MM-DD`. **필수**. 만 14세 미만 `UNDER_14` |
| `deviceHash` | string | — | 프런트가 만든 기기 값 1~64자. **필수** |

### SseEmitter

28 응답 표기. 실제는 `text/event-stream` (이벤트는 4장 참고)

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `timeout` | integer (int64) | — | 의미 없음(서버 내부 객체 표기) |

### StageUp

21 `stageUp`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `stage` | integer (int32) | — | 오를 단계 |
| `stageName` | string | — | 단계 이름 |
| `unlocked` | array<[Unlocked](#unlocked)> | — | [Unlocked](#unlocked). '새 표정이 열렸어요' 알림 |

### StartRequest

16 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `mateId` | integer (int64) | 예 | 연결할 메이트(31의 `id`) |

### StartResponse

16 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `connectionId` | integer (int64) | — | 연결 id |
| `startedAt` | string (date-time) | — | 시작 시각 |
| `mate` | [Figure](#figure) | — | [Figure](#figure) |
| `avatar` | [Figure](#figure) | — | [Figure](#figure) 내 아바타 |
| `me` | [Me](#me) | — | [Me](#me) |
| `settings` | [SettingsInfo](#settingsinfo) | — | [SettingsInfo](#settingsinfo). 연결 화면이 29를 따로 부르지 않게 |
| `serverTime` | string (date-time) | — | 서버 시각(타이머 보정) |
| `firstMeet` | boolean | — | 이 메이트와 처음이면 true |
| `greeting` | [ReactionView](#reactionview) | — | [ReactionView](#reactionview) 인사(`GREETING`). `line` · `audio`는 지금 null |
| `minorRemainingSeconds` | integer (int32) | — | 청소년이면 오늘 남은 시간, 아니면 null |
| `relation` | [Now](#now) | — | [Now](#now) |
| `credits` | [Credits](#credits) | — | [Credits](#credits) |
| `backgrounds` | array<[BackgroundView](#backgroundview)> | — | [BackgroundView](#backgroundview). 배경 없는 메이트면 `[]` |
| `background` | string | — | 지금 배경 코드. 없으면 null |

### TermVersion

1 `terms[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `termVersionId` | integer (int64) | — | 동의할 때 보낼 id |
| `code` | string | — | `SERVICE` · `PRIVACY` |
| `name` | string | — | 표시 이름 |
| `required` | boolean | — | 필수 여부 |
| `content` | string | — | 약관 전문 |

### TermsResponse

1 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `terms` | array<[TermVersion](#termversion)> | — | 최신 필수 약관 2종 |

### Unlock

37 `unlocks[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `id` | integer (int64) | — | 해금 콘텐츠 id |
| `type` | string | — | `EXPRESSION` · `VOICE_LINE` |
| `title` | string | — | 이름 |
| `unlockStage` | integer (int32) | — | 열리는 단계 |
| `unlockStageName` | string | — | 열리는 단계 이름 |
| `expressionName` | string | — | 표정 이름 |
| `assetUrl` | string | — | 음원 등. 없으면 null |
| `unlocked` | boolean | — | 열렸는지 |

### Unlocked

21 `stageUp.unlocked[]`, 22 · 23 `relation.unlocked[]`

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `type` | string | — | `EXPRESSION` · `VOICE_LINE` |
| `title` | string | — | 이름 |
| `unlockStage` | integer (int32) | — | 열린 단계 |
| `expressionName` | string | — | 표정 이름 |
| `assetUrl` | string | — | 없으면 null |

### Unread

44 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `unreadCount` | integer (int32) | — | 남은 안 읽은 수 |

### UpdateMeRequest

10 요청. 보낸 값만 바꿈

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `nickname` | string | — | 1~20자 |
| `avatarId` | integer (int64) | — | 아바타 id. 아바타가 없으면 기본 아바타 |
| `birthDate` | string | — | 저장된 값이 없을 때만 저장(한 번). 만 14세 미만 `UNDER_14` |
| `honorific` | string | — | 1~10자, 빈 문자열이면 지움 |
| `aboutMe` | string | — | 0~50자, 빈 문자열이면 지움 |

### UserSettings

29 · 30 응답. 저장한 적 없는 키는 기본값 (`user/service/SettingsService.java:27-30`)

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `talkFrequency` | string | — | `QUIET` · `SOMETIMES`(기본) · `OFTEN` — 말 걸기 간격 없음 · 3분 · 1분 (api.md 18) |
| `voiceEnabled` | boolean | — | 기본 true. 끄면 음성 · 보이스 차감 없음 |
| `voiceVolume` | integer (int32) | — | 0~100, 기본 70. 서버는 저장만 함(재생은 프런트) |
| `voiceSpeed` | string | — | `SLOW` · `NORMAL`(기본) · `FAST`. **서버 TTS 속도에 반영** (`dialogue/service/VoiceStreams.java:53`) |
| `pipBubble` | boolean | — | 기본 true. 서버는 저장만 함 |
| `defaultMode` | string | — | `BASIC`(기본) · `ADVANCED` |
| `pipSize` | string | — | `S` · `M`(기본) · `L` |

### VerificationResponse

3 응답

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `verificationToken` | string | — | 가입에 넣을 토큰(10분) |

### WaitlistRequest

45 요청

| 필드 | 타입 | OpenAPI 필수 | 의미 · 값 |
|---|---|---|---|
| `email` | string | — | 이메일. 이미 신청했어도 204 |

## 9. 다시 받고 갱신하는 방법

개인 토큰 · 실제 비밀번호는 문서에 적지 않는다. 명세는 로그인 없이 받을 수 있다.

```bash
curl --fail --silent --show-error --location --max-time 40 \
  'https://api.capsule.ai.kr/v3/api-docs' --output /tmp/capsule-openapi-latest.json
python3 -m json.tool /tmp/capsule-openapi-latest.json > /dev/null
shasum -a 256 /tmp/capsule-openapi-latest.json
```

해시가 1장의 값과 다르면 새 날짜의 `BACKEND_OPENAPI_YYYY-MM-DD.json`으로 저장하고, 변경표(`BACKEND_OPENAPI_DIFF_YYYY-MM-DD.md`)와 이 문서의 목록 · 스키마 · 확인일 · 해시를 함께 고친다. enum · 크레딧 · 오류 같은 의미는 OpenAPI에 없으니 백엔드 `docs/specs/api.md`와 코드에서 확인한다.
