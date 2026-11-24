# CAPSULE 백엔드 API 정리

> 현재 26개 API의 연결 상태와 실제 응답 결과는 [최신 전체 재점검](API_FULL_AUDIT_2026-11-05.md)을 따른다. [이전 25개 점검](API_AUDIT_2026-11-05.md)과 구분한다. `API관련/`의 추가 계약과 구현 흐름은 [API 연동 기록](API_INTEGRATION_2026-11-05.md)을 참고한다. 아래 스키마는 최신 공개 OpenAPI의 표기·누락을 기록한다.

확인일: **2026-11-05 (Asia/Seoul)**. 제공받은 Swagger의 공개 OpenAPI를 내려받아 정리했다. 현재 프런트 구조는 [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)를 참고한다.

## 1. 출처와 확인 범위

| 항목 | 값 |
|---|---|
| Swagger UI | [백엔드 Swagger](https://backendlab-production-3052.up.railway.app/swagger-ui/index.html#/) |
| OpenAPI 원본 | [GET /v3/api-docs](https://backendlab-production-3052.up.railway.app/v3/api-docs) |
| Swagger 설정 | [GET /v3/api-docs/swagger-config](https://backendlab-production-3052.up.railway.app/v3/api-docs/swagger-config), `url: /v3/api-docs` 확인 |
| 배포 origin | `https://backendlab-production-3052.up.railway.app` |
| OpenAPI 버전 | `3.1.0` |
| 명세 제목·버전 | `캡슐 API` · `dev` |
| servers | `[{ "url": "/" }]` — 현재 배포 origin 기준 상대 주소 |
| 규모 | **23개 경로 · 26개 API 작업 · 50개 스키마** |
| 보관 원본 | [BACKEND_OPENAPI_2026-11-05.json](BACKEND_OPENAPI_2026-11-05.json) |
| 원본 SHA-256 | `482039b8a103f028d21d5343e8554c38596133d09182e02193f68a2032df39d5` |

원본 `info.description`은 백엔드의 `docs/specs/api.md`를 명세 원본으로 지칭하지만, 그 파일은 현재 작업 폴더에 없어 확인하지 않았다. 이 문서는 **배포된 OpenAPI 스냅샷에서 확인한 계약**을 기록한다. 번호 15는 원본에 없으며 1~14·16~27 총 26개 작업이다.

앞선 재조회에서 당시 직전 스냅샷 대비 `RoomDetail.bannerUrl`(선택 string) 추가 한 곳을 확인했다. 작업 수·경로·나머지 스키마는 동일하다. DTO → 룸 adapter → 상세 화면으로 연결해 실제 이미지 수신도 확인했다. 앞선 17개 재점검 때의 `KakaoRequest.agreedTermVersionIds` 제거도 유지된다. 카카오는 `code`, `redirectUri`만 보내며 이메일 가입의 약관 버전 목록은 유지한다.

회원탈퇴 추가 전 실계정 점검에서는 같은 origin의 `/api/backend` 프록시와 실제 백엔드로 당시 25개 API 모두를 요청했다. 20개는 정상 응답을 확인했고, 나머지 5개는 잘못된 입력의 오류 응답만 확인했다. 이메일 로그인·토큰 갱신·홈·일정 저장/재조회·3분 세션 생성·상태/반응/대화·heartbeat·이어하기·종료/리포트·로그아웃을 실계정으로 검증했다. 비밀번호 재설정 메일 요청은 202를 받았으며 사용자가 실제 수신도 확인했다. 신규 가입·유효 카카오 코드·실제 비밀번호 변경은 미검증이다. TTS·Live2D 재생도 검증하지 않았다. 아래 JSON 예시의 ID·토큰은 여전히 설명용이다.

| API | Swagger 성공 상태 | 이번 실제 성공 상태 |
|---|---|---|
| `POST /api/sessions/{sessionId}/events` | 200 | **201** |
| `POST /api/auth/logout` | 200 | **204, 본문 없음** |

이 차이는 백엔드 명세와 실제 동작의 차다. OpenAPI 원본은 서버가 제공한 그대로 보관한다. 프런트 공통 client는 모든 2xx와 빈 본문을 처리하므로 두 응답을 정상 수신했다.

최신 후속 조회에서 **27번 `DELETE /api/me` 회원탈퇴**가 추가됐다. 개인정보를 비우고 일정·대화 기억을 삭제하며 모든 기기를 로그아웃한다. 진행 중 세션이 있으면 409라고 설명되어 있다. 전역 bearer 보안을 상속하며, 요청 본문·별도 요청/응답 DTO는 없고 성공 응답은 200으로만 표기됐다. 기존 25개 operation과 50개 스키마는 앞선 bannerUrl 스냅샷과 동일하다. [이번 변경 비교](SWAGGER_DIFF_2026-11-05.md)를 참고한다. 헤더 내 프로필 메뉴의 탈퇴 버튼·확인 창과 호출을 연결했고 모의 응답으로 409·500·빈 본문 200 및 성공 후 계정 정리를 확인했다. 실제 탈퇴 요청은 실행하지 않았다.

## 2. 공통 계약과 주의점

### 인증

보안 스키마는 `bearer: { type: http, scheme: bearer, bearerFormat: JWT }`이며 전역에 `security: [{ bearer: [] }]`가 선언되어 있다.

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**모든 operation에 개별 `security` 재정의가 없다.** 따라서 Swagger 표현상 약관·로그인·가입·토큰 갱신에도 전역 bearer가 적용된다. 실제 약관 조회는 토큰 없이 성공했다. 가입 전 API까지 로그인 토큰을 요구한다고 구현하면 안 되며, 공개 허용 경로는 백엔드 보안 설정과 별도 대조해야 한다. 다른 인증 API가 토큰 없이 동작하는지는 이번에 실행하지 않았다.

- 로그인·가입·카카오는 `accessToken`을 응답한다. 카카오만 소셜 로그인 API에 있다.
- 갱신·로그아웃은 `refresh_token` cookie parameter를 가진다. OpenAPI상 parameter는 선택이지만, 유효한 쿠키 없이 갱신에 성공한다는 의미는 아니다.
- 쿠키 발급 `Set-Cookie`, 만료·회전, HttpOnly·Secure·SameSite, CORS 허용 origin은 명세에 없다. 별도 origin에서 갱신 쿠키를 주고받는 프런트는 `credentials: 'include'` 및 서버의 credentials/CORS 설정을 함께 확인해야 한다. 이는 연동 시 확인 사항이다.
- 로그아웃 설명은 **진행 세션 유지**, 비밀번호 재설정 설명은 **모든 기기 로그아웃**을 명시한다.

### 데이터와 응답

- JSON 요청 본문은 `application/json`이다. 응답 본문이 있는 operation의 OpenAPI content key는 모두 `*/*`다. 실제 약관 응답의 Content-Type은 JSON이었다. 모든 operation의 실제 응답 헤더가 검증된 것은 아니다.
- 공통 `{ data: ... }` 래퍼는 없다. 각 응답 스키마의 객체가 루트다. `204` 응답과 본문 미기재 응답에는 무조건 `.json()`을 호출하지 않는다.
- `sessionId`, `eventId`, `roomId`, `characterId`, `avatarId`, `memoryId`, `userId`, 약관 버전 ID는 `integer(int64)`다. 현재 프런트의 문자열 콘텐츠 ID와 동일하게 취급하지 않는다.
- `requestId`는 `string(uuid)`, 시각은 `string(date-time)`, 날짜는 지정된 곳에서 `string(date)`다. 날짜·시간대 처리와 숫자 ID의 JavaScript 안전 정수 범위 정책은 추가 확인이 필요하다.
- `targetMinutes`는 분, `studySeconds` 등은 초 단위 이름을 사용한다. 스키마의 최소값·기본값·정산식은 별도 표기가 없는 한 미정이다.
- `required`가 없는 필드를 임의로 필수 처리하지 않는다. **요청 본문 자체의 필수 여부와 그 안의 필드 필수 여부는 다르다.** `requestBody.required`가 생략된 heartbeat는 본문 선택, 나머지 본문 보유 operation은 본문 필수다.
- 전체 50개 스키마 중 응답에 사용되는 객체에는 `required` 배열이 없다. 실제 서버가 모든 필드를 항상 제공하거나 `null`을 절대 보내지 않는다고 보장할 수 없다. nullable도 명시되지 않았다.
- 명세에는 성공 상태만 있다. 오류 HTTP 상태·오류 본문·업무 오류 코드·rate limit·멱등성 보장·재시도 규칙은 기록되어 있지 않다.

## 3. 전체 엔드포인트

요청 열의 `스키마 (본문 필수)`는 JSON 객체 전송이 필요하다는 뜻이다. 내부 필드의 필수 여부는 [스키마 사전](#8-전체-스키마-사전)을 따른다. `없음`은 요청 본문이 정의되어 있지 않다는 뜻이다. 인증 요구는 위의 전역 보안 정의와 실제 공개 경로의 차이를 함께 확인한다.

### 3.1. 인증

| 번호 | 메서드·경로 | 설명 | 요청 본문 | 성공 응답 |
|---|---|---|---|---|
| 1 | `GET /api/terms` | 회원가입 화면에 띄울 필수 약관 2종 최신 버전 | 없음 | `200` → [TermsResponse](#termsresponse) |
| 2 | `POST /api/auth/email/verification` | 가입할 이메일로 6자리 인증번호 발송 (5분 유효) | [EmailRequest](#emailrequest) (본문 필수) | `202` → [ExpiresResponse](#expiresresponse) |
| 3 | `POST /api/auth/email/verification/confirm` | 인증번호 확인 → 가입용 토큰 발급 | [ConfirmRequest](#confirmrequest) (본문 필수) | `200` → [VerificationResponse](#verificationresponse) |
| 4 | `POST /api/auth/email/signup` | 이메일 · 비밀번호 · 닉네임 · 약관 동의로 가입, 바로 로그인 토큰 발급 | [SignupRequest](#signuprequest) (본문 필수) | `200` → [LoginResponse](#loginresponse) |
| 5 | `POST /api/auth/email/login` | 이메일 · 비밀번호 로그인 | [LoginRequest](#loginrequest) (본문 필수) | `200` → [LoginResponse](#loginresponse) |
| 6 | `POST /api/auth/social/KAKAO` | 카카오 인가 코드로 로그인, 처음이면 가입까지 (소셜은 카카오만) | [KakaoRequest](#kakaorequest) (본문 필수) | `200` → [KakaoResponse](#kakaoresponse) |
| 7 | `POST /api/auth/refresh` | 액세스 토큰 만료 시 재발급. 리프레시 토큰 쿠키로 | 없음 | `200` → [AccessTokenResponse](#accesstokenresponse) |
| 24 | `POST /api/auth/logout` | 리프레시 토큰 폐기. 진행 중 세션은 유지 (재로그인 시 이어하기) | 없음 | `200` · 본문 미기재 |
| 25 | `POST /api/auth/password/reset-request` | 이메일로 비밀번호 재설정 링크 발송. 가입 여부와 상관없이 같은 응답 | [EmailRequest](#emailrequest) (본문 필수) | `202` · 본문 미기재 |
| 26 | `POST /api/auth/password/reset` | 메일 링크의 토큰과 새 비밀번호로 변경. 바꾸면 모든 기기에서 로그아웃 | [PasswordResetRequest](#passwordresetrequest) (본문 필수) | `204` · 본문 미기재 |

### 3.2. 온보딩 · 홈

| 번호 | 메서드·경로 | 설명 | 요청 본문 | 성공 응답 |
|---|---|---|---|---|
| 8 | `GET /api/me` | 내 정보 + 온보딩 필요 여부 + 진행 중 세션(H18 판단) | 없음 | `200` → [MeResponse](#meresponse) |
| 9 | `GET /api/avatars` | 완성형 Live2D 아바타 목록 (현재 1개) | 없음 | `200` → [AvatarsResponse](#avatarsresponse) |
| 10 | `PATCH /api/me` | 닉네임 · 아바타 저장 (온보딩 완료) | [UpdateMeRequest](#updatemerequest) (본문 필수) | `200` → [MeResponse](#meresponse) |
| 11 | `GET /api/home` | 오늘 공부 시간 · 이어하기 · 들어갈 수 있는 룸 1개 | 없음 | `200` → [HomeResponse](#homeresponse) |
| 12 | `GET /api/rooms/{roomId}` | 룸 정보 + 캐릭터 1명(성격 태그 배열) + 나와의 관계(함께 n분 · Lv) | 없음 | `200` → [RoomDetail](#roomdetail) |
| 13 | `POST /api/me/memories` | 시험 · 약속 · 목표 일정 저장 | [CreateMemoryRequest](#creatememoryrequest) (본문 필수) | `201` → [MemoryResponse](#memoryresponse) |
| 14 | `GET /api/me/memories` | 내 일정(시험 · 약속 · 목표) 조회. 달력 점 · 날짜 클릭 · 예정/전체/지난 탭 | 없음 | `200` → [MemoryList](#memorylist) |
| 27 | `DELETE /api/me` | 회원탈퇴: 개인정보 비움·일정/대화 기억 삭제·모든 기기 로그아웃. 진행 세션이 있으면 409 | 없음 | `200` · 본문 미기재 |

### 3.3. 공부 세션

| 번호 | 메서드·경로 | 설명 | 요청 본문 | 성공 응답 |
|---|---|---|---|---|
| 16 | `POST /api/sessions` | 룸 · 캐릭터 1명 · 목표 시간으로 세션 생성 + 캐릭터 · 내 프로필 이미지 | [StartRequest](#startrequest) (본문 필수) | `201` → [StartResponse](#startresponse) |
| 17 | `POST /api/sessions/{sessionId}/resume` | 비정상 종료된 세션 이어하기. 끊긴 구간은 자동 휴식 처리 | 없음 | `200` → [ResumeResponse](#resumeresponse) |
| 18 | `POST /api/sessions/{sessionId}/events` | 상태가 바뀌거나 동작(졸음 · 하품 · 손 흔들기 · 고개 돌림)이 감지될 때마다 1건씩 전송 → 저장 + 호감도 반영 → eventId + 캐릭터별 '알아채는' 동작 · 호감도 | [EventRequest](#eventrequest) (본문 필수) | `200` → [EventResponse](#eventresponse) |
| 21 | `POST /api/sessions/{sessionId}/heartbeat` | 1분마다 생존 신호. 비정상 종료 판단 기준 | [HeartbeatRequest](#heartbeatrequest) (본문 선택) | `204` · 본문 미기재 |

### 3.4. 대화

| 번호 | 메서드·경로 | 설명 | 요청 본문 | 성공 응답 |
|---|---|---|---|---|
| 19 | `POST /api/sessions/{sessionId}/events/{eventId}/reaction` | eventId로 캐릭터 대사(LLM) + 감정 + 감정에 맞는 모션 · 표정 받기 | [ReactionRequest](#reactionrequest) (본문 필수) | `200` → [ReactionResponse](#reactionresponse) |
| 20 | `POST /api/sessions/{sessionId}/messages` | 대화 → 캐릭터별 답장 + 감정 모션 · 표정 + 바뀐 호감도 (TTS 선택) | [MessageRequest](#messagerequest) (본문 필수) | `200` → [MessageResponse](#messageresponse) |

### 3.5. 리포트

| 번호 | 메서드·경로 | 설명 | 요청 본문 | 성공 응답 |
|---|---|---|---|---|
| 22 | `POST /api/sessions/{sessionId}/end` | 공부 종료 + 정산 + 관계 갱신 → 공부 시간 · 자리 지킴률 · 달성률 · 호감도 변화 | [EndRequest](#endrequest) (본문 필수) | `200` → [ReportResponse](#reportresponse) |
| 23 | `GET /api/sessions/{sessionId}/report` | 리포트 · 카드 다시 불러오기 (공부 종료와 같은 응답) | 없음 | `200` → [ReportResponse](#reportresponse) |


### 경로·쿼리·쿠키 parameter

| 적용 operation | 위치·이름 | 타입 | 필수 | 기본값·제약 |
|---|---|---|---|---|
| `POST /api/auth/refresh` | cookie · `refresh_token` | string | 아니요 | — |
| `GET /api/rooms/{roomId}` | path · `roomId` | integer (int64) | 예 | — |
| `GET /api/me/memories` | query · `from` | string (date) | 아니요 | — |
| `GET /api/me/memories` | query · `to` | string (date) | 아니요 | — |
| `GET /api/me/memories` | query · `date` | string (date) | 아니요 | — |
| `GET /api/me/memories` | query · `status` | string | 아니요 | 기본값 `UPCOMING`; enum: `UPCOMING`, `ALL`, `PAST` |
| `GET /api/me/memories` | query · `type` | string | 아니요 | enum: `EXAM`, `GOAL`, `PROMISE` |
| `POST /api/sessions/{sessionId}/resume` | path · `sessionId` | integer (int64) | 예 | — |
| `POST /api/sessions/{sessionId}/events` | path · `sessionId` | integer (int64) | 예 | — |
| `POST /api/sessions/{sessionId}/events/{eventId}/reaction` | path · `sessionId` | integer (int64) | 예 | — |
| `POST /api/sessions/{sessionId}/events/{eventId}/reaction` | path · `eventId` | integer (int64) | 예 | — |
| `POST /api/sessions/{sessionId}/messages` | path · `sessionId` | integer (int64) | 예 | — |
| `POST /api/sessions/{sessionId}/heartbeat` | path · `sessionId` | integer (int64) | 예 | — |
| `POST /api/sessions/{sessionId}/end` | path · `sessionId` | integer (int64) | 예 | — |
| `GET /api/sessions/{sessionId}/report` | path · `sessionId` | integer (int64) | 예 | — |
| `POST /api/auth/logout` | cookie · `refresh_token` | string | 아니요 | — |

위 parameter의 기본값·enum은 원본 표기 그대로다. `from`·`to`·`date`를 함께 넣었을 때 우선순위, 범위의 양 끝 포함 여부, 날짜 필터 기준 시간대·페이지네이션은 명시되지 않았다.

## 4. 인증·온보딩·일정 흐름

### 이메일 가입과 로그인

```text
GET /api/terms → 동의할 termVersionId 수집
POST /api/auth/email/verification { email } → expiresInSeconds
POST /api/auth/email/verification/confirm { email, code } → verificationToken
POST /api/auth/email/signup { verificationToken, password, nickname, agreedTermVersionIds }
  → accessToken, userId, onboardingRequired
GET /api/me → 사용자·온보딩 여부·activeSession
GET /api/avatars → 선택 가능한 완성형 Live2D 아바타
PATCH /api/me { nickname, avatarId } → 프로필 저장·온보딩 완료
```

인증번호는 operation 설명상 **6자리·5분 유효**다. `ExpiresResponse.expiresInSeconds` 응답도 제공한다. `code`는 선행 0을 잃지 않도록 문자열로 다룬다. 재발송 제한·시도 횟수·verificationToken 유효 시간은 명세에 없다.

일반 로그인은 `POST /api/auth/email/login { email, password }`다. 비밀번호 재설정은 `reset-request { email }`로 **202**를 받고, 메일 링크의 `token`과 `newPassword`로 `reset`을 호출해 **204**를 받는다. 메일 요청은 가입 여부와 무관하게 같은 응답이라고 설명되어 있다. 새 비밀번호 길이·복잡도와 재설정 토큰 만료는 명세에 없다.

카카오 로그인은 정확히 대문자 경로 `POST /api/auth/social/KAKAO`다. `code`, `redirectUri`를 보내며 `isNewUser`, `onboardingRequired`를 반환한다. callback 라우트, PKCE/state 정책, 약관 동의 기록 방식은 명세에 없다.

### 홈·일정

`GET /api/home`은 `todayStudySeconds`, `activeSession`, `rooms`를 반환한다. 설명상 현재 입장 가능한 룸은 1개다. `GET /api/rooms/{roomId}`는 캐릭터·성격 태그·관계 요약을 제공하고, `GET /api/me`의 `activeSession`으로 재진입 판단을 할 수 있다. 진행 세션이 없을 때의 `null`/생략 규칙은 미기재다.

일정 저장은 `POST /api/me/memories`의 `{ type, title, dueDate, dueTime }`이며 조회는 같은 경로의 GET이다. 조회 status는 `UPCOMING`(기본)·`ALL`·`PAST`, 조회 type과 응답 type은 `EXAM`·`GOAL`·`PROMISE`다. **생성 요청의 `type`에는 enum이 없고 `dueDate`에도 format이 없다.** 조회·응답 규격과 맞춰 쓰려면 서버 검증을 확인해야 한다. 수정·삭제 API는 이 스냅샷에 없다.

## 5. 공부 세션·대화·정산 흐름

```text
POST /api/sessions { roomId, characterId, targetMinutes }
  → sessionId, startedAt, serverTime, room, character, avatar, me

공부 중:
  1분마다 heartbeat [studySeconds, presentSeconds 본문은 선택]
  상태 변화·동작 → POST events { type, occurredAt }
    → eventId, characters[].motion/expression/affinity
    → 필요 시 POST events/{eventId}/reaction { requestId, intensity, tts }
      → characters[].content/emotion/motion/expression/fallback/audioBase64
  사용자 대화 → POST messages { requestId, characterId, content, inputType, tts }
    → content, emotion, motion, expression, affinity, fallback, audioBase64

비정상 종료 후 재진입:
  GET /api/me 또는 /api/home → activeSession
  POST /api/sessions/{sessionId}/resume
    → studySeconds, breakSeconds, serverTime, 장면·인물·아바타 정보

종료:
  POST /api/sessions/{sessionId}/end { studySeconds, presentSeconds }
    → ReportResponse
  GET /api/sessions/{sessionId}/report → 같은 ReportResponse로 다시 조회
```

### 이벤트 저장과 반응을 구분한다

`events`는 상태 기록과 호감도 반영, 캐릭터가 알아채는 모션·표정을 반환한다. `reaction`은 그 `eventId`에 대한 LLM 대사와 감정·모션·표정을 반환한다고 명세에 적혀 있다. 현재 프런트는 상태 기록 후 받은 eventId로 반응을 요청하며 일반 사용자 메시지와 구분한다.

`EventRequest.type`은 **enum 없는 string**이다. operation 설명에는 상태 변화와 졸음·하품·손 흔들기·고개 돌림이 나오지만, 실제 코드 목록은 없다. `away`, `drowsy`, `headTurn`, `phone`, `wave`, 휴식 진입/종료 코드 등을 서버 enum으로 임의 확정하지 않는다. `occurredAt` 기준 시간, 이벤트 순서·중복·지연 전송, 기본 상태와 쿨다운 정책도 확인해야 한다.

`MessageRequest.content`의 스키마 길이는 **0~300자**, `inputType`은 `TEXT`·`QUICK`이다. 0은 스키마의 `minLength`이며 공백·빈 문자열이 업무적으로 허용된다는 의미로 확대하지 않는다. `ReactionRequest.intensity`는 범위가 없다. `tts` 기본값, 오디오 형식·샘플레이트·크기 제한, `fallback`의 발생·재시도 의미, emotion·motion의 가능한 값도 미기재다. SSE·WebSocket 스트림은 정의되어 있지 않다.

`MessageRequest`와 `ReactionRequest`는 `requestId`를 필수로 요구하고 응답에 되돌려 준다. 요청 식별·응답 대조에 쓸 수 있지만, **같은 ID로 다시 보내면 중복 처리되지 않는다는 서버 보장은 명세에 없다.** 자동 재시도 전 보장 범위·TTL·동일 ID 다른 내용의 처리를 확인한다.

### 시간과 복구

heartbeat 설명은 **1분마다 생존 신호**, resume 설명은 **끊긴 구간을 자동 휴식 처리**다. heartbeat 만료 시간·백그라운드 탭 지연·복구 허용 기간·서버 정산 보정 규칙은 없다. 휴식 시작·종료를 위한 독립 엔드포인트도 없으므로 이벤트 코드와 타이머 계약으로 어떻게 전달하는지 확인해야 한다.

생성·복구 응답의 `serverTime`은 서버 시각 대조에 사용할 수 있다. `targetMinutes`의 기본값·허용 범위와 목표 초과 공부, `studySeconds`·`presentSeconds`의 반올림·누적 기준·카메라 미측정 처리는 명세에서 확정할 수 없다. heartbeat 본문은 선택이지만 end 본문은 필수이고, 두 객체 내부 필드는 `required`로 지정되어 있지 않다.

### 리포트와 관계

`ReportResponse`에는 `studySeconds`, `presentSeconds`, `awaySeconds`, `returnCount`, `endType`, `character`, `relation`, `closingLine`이 있다. 종료 API 설명에 나오는 자리 지킴률·달성률·호감도 변화가 모두 별도 필드로 존재하는 것은 아니다. 예를 들어 `focusPercent`, `achievementRate`, `targetMinutes`, `targetSeconds`, `affinityDelta`는 리포트 스키마에 없다.

화면의 **자리 지킴률**은 이전 카메라 측정 기준인 `focusedMs / observedMs`를 사용한다. 카메라 꺼짐·휴식·숨긴 탭·감지 중단 시간은 분모에서 제외하고, 유효 측정이 없으면 `—`로 표시한다. 측정 누적값은 계정·세션별 `capsule-session` 복구 메타데이터에 저장해 이어하기와 종료 리포트에서 복원한다. 측정 기록이 없는 과거/다른 기기의 리포트도 `—`로 표시하며 서버의 `presentSeconds`로 자리 지킴률을 추정하지 않는다. `presentSeconds`·`awaySeconds`는 기존 서버 상태 전송·종료 정산·자리 지킴/비움 통계에 사용한다. `studySeconds = presentSeconds + awaySeconds`도 스키마가 보장하는 식은 아니다.

관계 관련 응답에는 `level`, `points`, `stage`, `stageName` 등이 있다. 공부 레벨·호감도·관계 단계를 한 지표로 합치지 않는다. `points`의 0~100 범위, `level`의 Lv.1~5 상한, 정산의 `pointsBefore/After` 의미와 현재 호감도와의 관계는 스키마에 설명·범위가 없으므로 백엔드 확인 사항이다. deprecated 필드는 아래 스키마 사전에 표시했다.

## 6. 현재 프런트와의 연동 대응표

| 영역 | 현재 코드·동작 | 확인 범위·남은 항목 |
|---|---|---|
| 인증 | ApiClient의 메모리 토큰·단일 refresh, LoginPage·KakaoCallbackPage | 이메일 로그인·갱신·쿠키·로그아웃 실제 성공. 신규 가입·실제 카카오 인가 미검증 |
| 약관 | `/terms`의 실제 버전 ID·전문과 필수 동의 | 공개 200과 약관 필드 확인. 이메일 가입에 버전 목록 전송 |
| 아바타·프로필 | 완성형 `/avatars`와 `PATCH /me` | 실제 목록 수신·기존 닉네임을 유지한 PATCH 200. 모델 재생은 별도 |
| 홈·룸 | 서버 숫자 ID·소개·이미지·관계·오늘 시간 | 실제 200. 새 `bannerUrl`을 상세 화면에 연결, 이미지 로드 확인 |
| 시작 | `/sessions`의 sessionId·targetMinutes·serverTime | 실제 3분 생성 201. 기존 진행 세션이 있으면 테스트 생성 생략 |
| 장면 | 현재 일러스트 표시 | 모델 URL·motion·expression DTO 수신과 Live2D/TTS 재생 완료를 구분 |
| 상태·반응 | FOCUS/AWAY/RETURN/BREAK 큐 → eventId → reaction | FOCUS 실제 201·반응 200. 순간 동작 새 정책은 반영 확인 대기 |
| 일반 채팅 | 세션 `/messages`, 최대 300자·UUID·TEXT/QUICK | 실제 200·응답 requestId/characterId/대사 확인 |
| 시간·복구 | 누적 초 heartbeat·서버 resume·계정별 동일 탭 보조값 | heartbeat 204·resume 200. 다른 기기 복구에는 서버 presentSeconds 누락 제약 |
| 리포트 | 서버 end/report의 시간·정산·완료 대사 | 종료/재조회 200 및 시간 일치. 서버 targetMinutes 누락 제약 |
| 일정 | 한국어 종류 ↔ enum, 생성 ID·서버 조회 | 실제 저장 201·재조회 200. 수정·삭제 API 미제공 |
| 캡슐 카드 | 같은 서버 report를 Canvas PNG·화면에 사용 | 공개 카드 공유/이미지 생성 API는 미제공 |
| 랜딩 | Supabase·Mixpanel의 별도 흐름 | 이번 Front_Web API 점검 범위 밖 |

`GET /api/me`의 이미지 키는 `profileImage`, 세션 `Me`와 캐릭터는 `profileImageUrl`, 아바타 목록은 `thumbnailUrl`이다. 룸 목록 이미지는 `thumbnailUrl`, 상세 가로 이미지는 새 `bannerUrl`로 구분한다. 공통 ApiClient와 Vite/Worker의 서버 프록시를 통해 연동하며, 자세한 API별 결과는 [전체 점검표](API_AUDIT_2026-11-05.md)에 있다.

## 7. 연동 전에 확정할 항목과 없는 API

| 항목 | OpenAPI만으로 확정되지 않는 부분 |
|---|---|
| 공개 API·인증 | 전역 bearer와 실제 공개 경로 차이, 쿠키·CORS·토큰 수명/폐기 |
| 입력 검증·오류 | 필수 필드 누락 표기, 비밀번호·닉네임·일정 검증, 오류 상태·업무 코드·응답 DTO |
| 세션 정책 | 목표 기본값/범위, 중복 시작·종료, 휴식 이벤트, 비정상 종료 판정·재개 가능 시간 |
| 감지·반응 | 이벤트 type 목록·발화 조건·intensity·쿨다운·호감도 중복 반영 |
| 요청 복원 | requestId 멱등성 보장, 순서·취소·타임아웃·재시도·재진입 시 채팅 이력 |
| 지표·관계 | 유효 관측/미측정 처리, 자리 지킴률·목표 달성률, level/points/stage 의미·범위 |
| 미디어 | Live2D 파일 접근·배율/offset 단위, 음성 포맷·TTS 실패·fallback·감정 값 |

이 스냅샷에는 일정 **수정·삭제**, 누적 공부 기록/통계 목록, 룸 북마크 저장, 캐릭터 관계/해금 전용 조회, 선물·보이스 상점, 크레딧·결제·환불, 대화 이력 조회, 공개 카드 공유, 랜딩 사전예약 API가 없다. API가 이 Swagger에 없다는 뜻이며 백엔드 전체에 존재하지 않는다고 단정하는 것은 아니다.

## 8. 전체 스키마 사전

아래 표는 원본의 **50개 스키마·모든 프로퍼티**를 기록한다. “미지정”은 해당 필드가 원본 `required` 배열에 없다는 뜻이다. 요청/응답 사용처와 무관하게 원본 표기를 따르며, 값의 생략·null·기본값 동작을 추정하지 않는다. 설명이 없는 필드의 의미도 이름만으로 확정하지 않는다.

### StartRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `roomId` | integer (int64) | 필수 | — |
| `characterId` | integer (int64) | 필수 | — |
| `targetMinutes` | integer (int32) | 미지정 | — |

### Figure

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `id` | integer (int64) | 미지정 | — |
| `name` | string | 미지정 | — |
| `profileImageUrl` | string | 미지정 | — |
| `modelJsonUrl` | string | 미지정 | — |
| `scale` | number (double) | 미지정 | — |
| `offsetX` | integer (int32) | 미지정 | — |
| `offsetY` | integer (int32) | 미지정 | — |

### Me

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `nickname` | string | 미지정 | — |
| `profileImageUrl` | string | 미지정 | — |

### RoomView

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `id` | integer (int64) | 미지정 | — |
| `name` | string | 미지정 | — |
| `backgroundImageUrl` | string | 미지정 | — |

### StartResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `sessionId` | integer (int64) | 미지정 | — |
| `startedAt` | string (date-time) | 미지정 | — |
| `targetMinutes` | integer (int32) | 미지정 | — |
| `room` | [RoomView](#roomview) | 미지정 | — |
| `character` | [Figure](#figure) | 미지정 | — |
| `avatar` | [Figure](#figure) | 미지정 | — |
| `me` | [Me](#me) | 미지정 | — |
| `serverTime` | string (date-time) | 미지정 | — |

### ResumeResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `sessionId` | integer (int64) | 미지정 | — |
| `targetMinutes` | integer (int32) | 미지정 | — |
| `room` | [RoomView](#roomview) | 미지정 | — |
| `character` | [Figure](#figure) | 미지정 | — |
| `avatar` | [Figure](#figure) | 미지정 | — |
| `me` | [Me](#me) | 미지정 | — |
| `studySeconds` | integer (int32) | 미지정 | — |
| `breakSeconds` | integer (int32) | 미지정 | — |
| `serverTime` | string (date-time) | 미지정 | — |

### MessageRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `requestId` | string (uuid) | 필수 | — |
| `characterId` | integer (int64) | 필수 | — |
| `content` | string | 필수 | `minLength=0`; `maxLength=300` |
| `inputType` | string | 필수 | enum: `TEXT`, `QUICK` |
| `tts` | boolean | 미지정 | — |

### AffinityChange

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `delta` | integer (int32) | 미지정 | — |
| `points` | integer (int32) | 미지정 | — |
| `level` | integer (int32) | 미지정 | — |
| `levelUp` | boolean | 미지정 | **deprecated** |
| `stage` | integer (int32) | 미지정 | — |
| `stageName` | string | 미지정 | — |

### ExpressionRef

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `name` | string | 미지정 | — |
| `file` | string | 미지정 | — |

### MessageResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `requestId` | string (uuid) | 미지정 | — |
| `characterId` | integer (int64) | 미지정 | — |
| `content` | string | 미지정 | — |
| `emotion` | string | 미지정 | — |
| `motion` | [MotionRef](#motionref) | 미지정 | — |
| `expression` | [ExpressionRef](#expressionref) | 미지정 | — |
| `affinity` | [AffinityChange](#affinitychange) | 미지정 | — |
| `fallback` | boolean | 미지정 | — |
| `audioBase64` | string | 미지정 | — |

### MotionRef

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `group` | string | 미지정 | — |
| `file` | string | 미지정 | — |

### HeartbeatRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `studySeconds` | integer (int32) | 미지정 | — |
| `presentSeconds` | integer (int32) | 미지정 | — |

### EventRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `type` | string | 미지정 | — |
| `occurredAt` | string (date-time) | 미지정 | — |

### EventCharacter

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `characterId` | integer (int64) | 미지정 | — |
| `motion` | [MotionRef](#motionref) | 미지정 | — |
| `expression` | [ExpressionRef](#expressionref) | 미지정 | — |
| `affinity` | [AffinityChange](#affinitychange) | 미지정 | — |

### EventResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `eventId` | integer (int64) | 미지정 | — |
| `characters` | array&lt;[EventCharacter](#eventcharacter)&gt; | 미지정 | — |

### ReactionRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `requestId` | string (uuid) | 필수 | — |
| `intensity` | integer (int32) | 미지정 | — |
| `tts` | boolean | 미지정 | — |

### ReactionCharacter

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `characterId` | integer (int64) | 미지정 | — |
| `content` | string | 미지정 | — |
| `emotion` | string | 미지정 | — |
| `motion` | [MotionRef](#motionref) | 미지정 | — |
| `expression` | [ExpressionRef](#expressionref) | 미지정 | — |
| `fallback` | boolean | 미지정 | — |
| `audioBase64` | string | 미지정 | — |

### ReactionResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `requestId` | string (uuid) | 미지정 | — |
| `characters` | array&lt;[ReactionCharacter](#reactioncharacter)&gt; | 미지정 | — |

### EndRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `studySeconds` | integer (int32) | 미지정 | — |
| `presentSeconds` | integer (int32) | 미지정 | — |

### CharacterRef

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `id` | integer (int64) | 미지정 | — |
| `name` | string | 미지정 | — |

### ReportResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `sessionId` | integer (int64) | 미지정 | — |
| `roomName` | string | 미지정 | — |
| `startedAt` | string (date-time) | 미지정 | — |
| `endedAt` | string (date-time) | 미지정 | — |
| `endType` | string | 미지정 | — |
| `studySeconds` | integer (int32) | 미지정 | — |
| `presentSeconds` | integer (int32) | 미지정 | — |
| `awaySeconds` | integer (int32) | 미지정 | — |
| `returnCount` | integer (int32) | 미지정 | — |
| `character` | [CharacterRef](#characterref) | 미지정 | — |
| `relation` | [StudySettlement](#studysettlement) | 미지정 | — |
| `closingLine` | string | 미지정 | — |

### StudySettlement

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `levelBefore` | integer (int32) | 미지정 | — |
| `levelAfter` | integer (int32) | 미지정 | — |
| `levelName` | string | 미지정 | **deprecated** |
| `pointsBefore` | integer (int32) | 미지정 | — |
| `pointsAfter` | integer (int32) | 미지정 | — |
| `nextLevelPoints` | integer (int32) | 미지정 | **deprecated** |
| `levelUp` | boolean | 미지정 | — |
| `stage` | integer (int32) | 미지정 | — |
| `stageName` | string | 미지정 | — |
| `nextLevelSeconds` | integer (int32) | 미지정 | — |

### CreateMemoryRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `type` | string | 미지정 | — |
| `title` | string | 미지정 | — |
| `dueDate` | string | 미지정 | — |
| `dueTime` | string | 미지정 | — |

### MemoryResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `memoryId` | integer (int64) | 미지정 | — |
| `type` | string | 미지정 | enum: `EXAM`, `GOAL`, `PROMISE` |
| `title` | string | 미지정 | — |
| `dueDate` | string (date) | 미지정 | — |
| `dueTime` | string | 미지정 | — |
| `dDay` | integer (int32) | 미지정 | — |

### KakaoRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `code` | string | 미지정 | — |
| `redirectUri` | string | 미지정 | — |

### KakaoResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `accessToken` | string | 미지정 | — |
| `userId` | integer (int64) | 미지정 | — |
| `isNewUser` | boolean | 미지정 | — |
| `onboardingRequired` | boolean | 미지정 | — |

### AccessTokenResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `accessToken` | string | 미지정 | — |

### PasswordResetRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `token` | string | 미지정 | — |
| `newPassword` | string | 미지정 | — |

### EmailRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `email` | string | 미지정 | — |

### ExpiresResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `expiresInSeconds` | integer (int32) | 미지정 | — |

### ConfirmRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `email` | string | 미지정 | — |
| `code` | string | 미지정 | — |

### VerificationResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `verificationToken` | string | 미지정 | — |

### SignupRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `verificationToken` | string | 미지정 | — |
| `password` | string | 미지정 | — |
| `nickname` | string | 미지정 | — |
| `agreedTermVersionIds` | array&lt;integer (int64)&gt; | 미지정 | — |

### LoginResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `accessToken` | string | 미지정 | — |
| `userId` | integer (int64) | 미지정 | — |
| `onboardingRequired` | boolean | 미지정 | — |

### LoginRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `email` | string | 미지정 | — |
| `password` | string | 미지정 | — |

### UpdateMeRequest

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `nickname` | string | 미지정 | — |
| `avatarId` | integer (int64) | 미지정 | — |

### ActiveSessionSummary

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `sessionId` | integer (int64) | 미지정 | — |
| `roomId` | integer (int64) | 미지정 | — |
| `roomName` | string | 미지정 | — |
| `characterName` | string | 미지정 | — |
| `startedAt` | string (date-time) | 미지정 | — |

### MeResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `userId` | integer (int64) | 미지정 | — |
| `nickname` | string | 미지정 | — |
| `email` | string | 미지정 | — |
| `onboardingRequired` | boolean | 미지정 | — |
| `activeSession` | [ActiveSessionSummary](#activesessionsummary) | 미지정 | — |
| `profileImage` | string | 미지정 | — |

### TermVersion

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `termVersionId` | integer (int64) | 미지정 | — |
| `code` | string | 미지정 | — |
| `name` | string | 미지정 | — |
| `required` | boolean | 미지정 | — |
| `content` | string | 미지정 | — |

### TermsResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `terms` | array&lt;[TermVersion](#termversion)&gt; | 미지정 | — |

### RelationBrief

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `level` | integer (int32) | 미지정 | — |
| `levelName` | string | 미지정 | **deprecated** |
| `totalStudySeconds` | integer (int32) | 미지정 | — |
| `points` | integer (int32) | 미지정 | — |
| `stage` | integer (int32) | 미지정 | — |
| `stageName` | string | 미지정 | — |

### RoomCharacter

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `id` | integer (int64) | 미지정 | — |
| `name` | string | 미지정 | — |
| `profileImageUrl` | string | 미지정 | — |
| `personality` | array&lt;string&gt; | 미지정 | — |
| `relation` | [RelationBrief](#relationbrief) | 미지정 | — |

### RoomDetail

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `id` | integer (int64) | 미지정 | — |
| `name` | string | 미지정 | — |
| `description` | string | 미지정 | — |
| `thumbnailUrl` | string | 미지정 | — |
| `bannerUrl` | string | 미지정 | 상세 배너. 2026-11-05 재조회에서 추가 확인 |
| `characters` | array&lt;[RoomCharacter](#roomcharacter)&gt; | 미지정 | — |
| `activeSessionId` | integer (int64) | 미지정 | — |

### MemoryList

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `memories` | array&lt;[MemoryResponse](#memoryresponse)&gt; | 미지정 | — |
| `datesWithMemories` | array&lt;string (date)&gt; | 미지정 | — |

### CharacterBrief

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `id` | integer (int64) | 미지정 | — |
| `name` | string | 미지정 | — |
| `profileImageUrl` | string | 미지정 | — |

### HomeResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `todayStudySeconds` | integer (int32) | 미지정 | — |
| `activeSession` | [ActiveSessionSummary](#activesessionsummary) | 미지정 | — |
| `rooms` | array&lt;[HomeRoom](#homeroom)&gt; | 미지정 | — |

### HomeRoom

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `id` | integer (int64) | 미지정 | — |
| `name` | string | 미지정 | — |
| `thumbnailUrl` | string | 미지정 | — |
| `characters` | array&lt;[CharacterBrief](#characterbrief)&gt; | 미지정 | — |

### AvatarItem

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `id` | integer (int64) | 미지정 | — |
| `name` | string | 미지정 | — |
| `thumbnailUrl` | string | 미지정 | — |
| `model` | [ModelInfo](#modelinfo) | 미지정 | — |

### AvatarsResponse

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `avatars` | array&lt;[AvatarItem](#avataritem)&gt; | 미지정 | — |

### ModelInfo

| 필드 | 타입 | required | 원본 제약·표시 |
|---|---|---|---|
| `modelJsonUrl` | string | 미지정 | — |
| `scale` | number (double) | 미지정 | — |
| `offsetX` | integer (int32) | 미지정 | — |
| `offsetY` | integer (int32) | 미지정 | — |


## 9. 읽기 전용 조회 예시와 갱신 방법

다음 명령은 명세·약관 조회 예시다. 개인 토큰·실제 비밀번호를 문서에 기록하지 않는다.

```bash
curl --fail --silent --show-error \
  'https://backendlab-production-3052.up.railway.app/api/terms'
```

프런트에서 이 문서를 갱신할 때는 `Front_Web/` 기준으로 아래와 같이 **임시 파일에 먼저** 새 스냅샷을 받는다.

```bash
curl --fail --silent --show-error --location --max-time 40 \
  'https://backendlab-production-3052.up.railway.app/v3/api-docs' \
  --output /tmp/capsule-openapi-latest.json
python3 -m json.tool /tmp/capsule-openapi-latest.json > /dev/null
shasum -a 256 /tmp/capsule-openapi-latest.json
```

검토 후 새 날짜의 `BACKEND_OPENAPI_YYYY-MM-DD.json`으로 저장하고, API 목록·스키마·차이·확인일·해시와 문서 링크를 함께 갱신한다. 사용자 요청에 따라 API 관련 문서와 스냅샷은 모두 로컬에 보관하며 `.gitignore`에 허용 예외를 추가하지 않는다. 이전에 추적하던 문서도 로컬 파일을 유지하면서 Git 추적을 해제했다.

```bash
git check-ignore --no-index \
  docs/PROJECT_OVERVIEW.md docs/BACKEND_API.md docs/BACKEND_OPENAPI_2026-11-05.json
git status --short --untracked-files=all
git diff --check
```

첫 명령은 세 파일을 모두 출력하고 **종료 코드 0**이 정상이다. `git ls-files -- docs/PROJECT_OVERVIEW.md docs/BACKEND_API.md docs/BACKEND_OPENAPI_2026-11-05.json`의 출력은 비어 있어야 한다. 추적 해제한 삭제 표시는 다음 커밋에 반영되지만 로컬 파일은 유지한다.
