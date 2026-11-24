**실계정 API 검증 가이드 · 2026-11-05**

기준: 현재 Front_Web 코드, [배포 OpenAPI](https://backendlab-production-3052.up.railway.app/v3/api-docs), 사용자가 제공한 `API관련/` 상세 계약. 최신 재조회에서 RoomDetail.bannerUrl 추가를 반영했다. 아래는 기존 17개 흐름의 테스트 방법이며, 이후 실제 수행한 **전체 25개 API의 결과는 [실서버 점검표](API_AUDIT_2026-11-05.md)**에 있다. 이 문서는 Git 무시 대상이다.

**준비와 공통 성공 기준**

1. `Front_Web`에서 `npm run dev`를 실행하고 `http://localhost:3000`으로 접속한다. 카카오 콜백은 `http://localhost:3000/oauth/kakao`다.
2. 개발자 도구 → Network → Fetch/XHR, `Preserve log`를 켜고 `/api/backend`로 필터링한다. 요청의 Headers, Payload, Response를 확인한다. 카카오의 사이트 이동도 Preserve log로 남긴다.
3. 회원가입에는 실제 메일을 받을 수 있는 미가입 주소를 사용한다. 같은 계정의 검증은 같은 탭에서 진행한다.
4. **HTTP 성공 + 응답 데이터 일치 + 화면 반영**을 함께 확인한다. 저장 기능은 새로고침/재로그인 후 재조회까지 맞아야 최종 성공이다.

앱의 `/api/backend/...`는 프록시를 통해 백엔드 `/api/...`로 전달된다. 아래 표의 경로는 백엔드 기준이다. Swagger에서 로그인한 쿠키는 Railway 도메인용이며 localhost 앱의 쿠키와 별개이므로, 앱에서도 직접 로그인해야 한다.

설명용 JSON의 이메일·비밀번호·토큰·ID·날짜는 실제 테스트 값으로 바꾼다. 숫자 ID를 예시 값으로 고정하지 않는다. 응답 예시는 핵심 필드 위주이며 실제 응답에는 추가 필드가 있을 수 있다.

**권장 실행 순서**

```text
이메일 신규 가입
  1 약관 → 2 메일 요청 → 3 인증 확인 → 4 가입
  → 8 내 정보 → 9 아바타 → 10 프로필 → 11 홈

저장·인증 유지
  13 일정 저장 → 14 일정 조회 → 새로고침 → 7 갱신 → 8/11/14 재조회
  → 24 로그아웃 → 5 이메일 로그인 → 8/11/14 재조회

공부 세션
  16 시작 → 21 heartbeat → 휴식 중 21 heartbeat
  → 같은 탭 새로고침 → 7 갱신 → 8/11의 진행 세션 → 17 이어하기 → 21 재개
  → 홈 이동 → 24 로그아웃 → 5 재로그인 → 같은 세션 17 이어하기

카카오 별도 검증
  로그아웃 → 카카오 버튼 → 카카오 인가 → callback → 6 코드 교환
  → 8 내 정보 → 신규면 9/10 온보딩, 완료 계정이면 11 홈
  → 로그아웃 후 다시 카카오 로그인 → 같은 userId 확인
```

홈·일정·아바타 등 조회는 로그인 과정에서 병렬로 호출되거나 개발 모드에서 중복 조회될 수 있다. 표의 번호순으로 한 번씩만 나타나야 한다는 뜻은 아니다. 카카오 인가 코드 교환은 동일 인가 코드에 대해 한 번이어야 한다.

**1~5 · 약관, 이메일 가입, 이메일 로그인**

| 번호 | 화면 조작 / 요청 | 정상 응답 | 성공 확인 |
|---|---|---|---|
| 1 | 회원가입 화면·약관 전문 열기. `GET /api/terms` | `200`, `terms[]`에 SERVICE/PRIVACY의 termVersionId·name·required·content | 두 약관 전문이 열리고 필수 동의 가능. 가입 시 사용하는 ID가 이 응답과 같음 |
| 2 | 가입 정보와 약관 입력 후 회원가입 클릭. `POST /api/auth/email/verification` | `202`, `expiresInSeconds` | 인증 화면·서버 유효 시간 반영 **및 실제 이메일 수신**. 202만으로 메일 도착까지 성공했다고 판단하지 않음 |
| 3 | 수신한 6자리 번호 입력. `POST /api/auth/email/verification/confirm` | `200`, 비어 있지 않은 `verificationToken` | 올바른 코드로 가입용 토큰 발급. 0으로 시작하는 코드는 문자열 그대로 전송 |
| 4 | 인증 성공 직후 자동 호출. `POST /api/auth/email/signup` | `200`, `accessToken`, `userId`, `onboardingRequired` | 로그인 상태로 전환, `/me` 조회 후 신규 계정이면 온보딩 이동. 약관 버전 ID·인증 토큰이 앞선 응답과 같음 |
| 5 | 로그아웃 후 동일 이메일·비밀번호로 로그인. `POST /api/auth/email/login` | `200`, `accessToken`, `userId`, `onboardingRequired` | 가입 때와 같은 userId. 온보딩 완료 계정은 홈으로 이동하고 저장 데이터가 유지됨 |

약관 응답의 형태:

```json
{"terms":[{"termVersionId":3,"code":"SERVICE","name":"이용약관","required":true,"content":"약관 전문"},{"termVersionId":4,"code":"PRIVACY","name":"개인정보 처리방침","required":true,"content":"개인정보 처리방침 전문"}]}
```

2번 요청 → 응답:

```json
{"email":"실제로_수신할_주소"}
```

```json
{"expiresInSeconds":300}
```

3번 요청 → 응답:

```json
{"email":"2번과_같은_주소","code":"001234"}
```

```json
{"verificationToken":"<서버가 발급한 가입용 토큰>"}
```

4번 요청 → 응답:

```json
{"verificationToken":"<3번 응답 토큰>","password":"<테스트 비밀번호>","nickname":"실계정테스트","agreedTermVersionIds":[3,4]}
```

```json
{"accessToken":"<마스킹>","userId":101,"onboardingRequired":true}
```

5번 요청 → 응답:

```json
{"email":"가입한_주소","password":"<가입 때의 비밀번호>"}
```

```json
{"accessToken":"<마스킹>","userId":101,"onboardingRequired":false}
```

가입 시 비밀번호는 8자 이상·UTF-8 72바이트 이하, 닉네임은 1~20자를 사용한다. 예시 약관 ID 3/4는 실제 1번 응답 값으로 바꾼다. 현재 화면의 ‘인증하고 가입하기’는 **3번과 4번을 연이어 호출**한다. 3번 200 후 4번이 실패하면 인증 확인 성공·가입 실패로 따로 기록한다.

**8~11 · 내 정보, 아바타, 프로필, 홈**

| 번호 | 화면 조작 / 요청 | 정상 응답 | 성공 확인 |
|---|---|---|---|
| 8 | 로그인·새로고침 과정의 `GET /api/me` | `200`, `userId`, `nickname`, `onboardingRequired`, `profileImage`, 필요 시 `activeSession` | 로그인 응답과 같은 사용자. 가입/온보딩 완료 여부에 맞는 화면으로 분기 |
| 9 | 온보딩·프로필의 `GET /api/avatars` | `200`, `avatars[]`의 id·name·thumbnailUrl·model | 서버 목록의 아바타가 표시·선택 가능. 현재 제공 수는 응답을 기준으로 확인 |
| 10 | 아바타·닉네임 선택 후 저장. `PATCH /api/me` | `200`, 갱신된 MeResponse | 닉네임·이미지가 갱신되고 `onboardingRequired:false`. 새로고침 후 8번에서도 같은 프로필 |
| 11 | 홈 진입. `GET /api/home` | `200`, `todayStudySeconds`, `rooms[]`, 필요 시 `activeSession` | 응답의 실제 룸·캐릭터가 화면과 일치. 진행 중인 세션이 있으면 이어하기 가능 |

8번 신규 사용자 예시:

```json
{"userId":101,"nickname":"실계정테스트","email":"<본인 이메일>","onboardingRequired":true,"activeSession":null,"profileImage":"https://example.com/avatar.png"}
```

9번 예시:

```json
{"avatars":[{"id":5,"name":"기본 아바타","thumbnailUrl":"https://example.com/avatar.png","model":{"modelJsonUrl":"https://example.com/avatar.model3.json","scale":1,"offsetX":0,"offsetY":0}}]}
```

10번 요청 → 응답:

```json
{"nickname":"프로필저장확인","avatarId":5}
```

```json
{"userId":101,"nickname":"프로필저장확인","onboardingRequired":false,"profileImage":"https://example.com/avatar.png","activeSession":null}
```

11번 예시:

```json
{"todayStudySeconds":0,"activeSession":null,"rooms":[{"id":11,"name":"서버 룸 이름","thumbnailUrl":"https://example.com/room.png","characters":[{"id":42,"name":"채린","profileImageUrl":"https://example.com/chaerin.png"}]}]}
```

8번/10번의 이미지 필드는 `profileImage`, 공부 세션 안의 `me` 이미지 필드는 `profileImageUrl`이다. 카카오 계정의 email은 동의·서버 응답에 따라 없을 수 있다. 아바타 검증은 목록/이미지/선택/서버 저장을 기준으로 하며 Live2D 애니메이션 재생은 현재 연동 범위와 별개다.

오늘 시간의 정확한 집계 시점은 명세가 보장하지 않는다. 진행 중 heartbeat를 보냈다는 이유만으로 홈 누적 시간이 즉시 늘어야 한다고 판단하지 않는다. 종료 정산 이후 재조회도 확인한다.

**13~14 · 일정 저장과 재조회**

| 번호 | 화면 조작 / 요청 | 정상 응답 | 성공 확인 |
|---|---|---|---|
| 13 | 일정 추가 후 저장. `POST /api/me/memories` | `201`, `memoryId`, type·title·dueDate·dueTime | 서버 ID로 일정이 추가되고 저장한 내용이 일치 |
| 14 | 일정 화면·로그인/새로고침의 `GET /api/me/memories?status=ALL` | `200`, `memories[]`, `datesWithMemories[]` | 13번에서 받은 같은 memoryId·내용이 재조회됨. 로그아웃/로그인 후에도 유지 |

13번 요청 → 응답 예시. 날짜는 테스트 당일 이후로 바꾼다.

```json
{"type":"EXAM","title":"실계정 API 검증 시험","dueDate":"2026-11-06","dueTime":"14:00"}
```

```json
{"memoryId":700,"type":"EXAM","title":"실계정 API 검증 시험","dueDate":"2026-11-06","dueTime":"14:00","dDay":1}
```

14번 예시:

```json
{"memories":[{"memoryId":700,"type":"EXAM","title":"실계정 API 검증 시험","dueDate":"2026-11-06","dueTime":"14:00","dDay":1}],"datesWithMemories":["2026-11-06"]}
```

시험=EXAM, 목표=GOAL, 약속=PROMISE다. 시간이 없으면 dueTime은 null/생략일 수 있다. 시간의 초 단위 표기 차이는 의미가 같은지 확인한다. 일정 수정·삭제 API는 현재 제공되지 않으므로 테스트로 저장한 일정은 실데이터로 남는다.

**7 · 토큰 갱신과 로그인 유지**

| 조작 | 정상 네트워크 흐름 | 성공 확인 |
|---|---|---|
| 로그인 후 F5 | `POST /api/auth/refresh` 200 → `/me` 200 → 사용자별 조회 | 로그인 화면으로 돌아가지 않고 같은 사용자·프로필·일정 유지 |
| 선택: accessToken 만료 후 앱 내부 메뉴 이동 | 보호 요청 401 → refresh 200 → 원래 보호 요청 200 | 자동으로 한 번 복구하고 사용자가 다시 로그인할 필요가 없음 |

7번 요청은 **JSON 본문 없이**, 브라우저의 refresh_token 쿠키로 전송한다. 응답:

```json
{"accessToken":"<새 액세스 토큰·마스킹>"}
```

개발자 도구 → Application/Storage → Cookies → localhost에서 `refresh_token`을 확인한다. 현재 프록시 기준으로 `HttpOnly`, `Path=/api/backend`, `SameSite=Lax`다. localhost HTTP에서는 Secure가 없고 배포 HTTPS에서는 Secure가 붙는다. 상세 계약상 갱신마다 refresh cookie가 교체되므로 Set-Cookie와 쿠키 갱신도 확인한다.

accessToken은 메모리에만 있으므로 localStorage에 없는 것이 정상이다. HttpOnly 쿠키도 document.cookie로 보이지 않는 것이 정상이다. 보호 요청의 Authorization 헤더와 응답은 Network에서 확인한다.

F5는 쿠키로 로그인 복구하는 경로를 검증한다. **만료 401의 자동 재시도까지 검증한 것과는 구분한다.** 후자는 상세 계약상 약 30분인 실제 토큰 만료 후, 새로고침 없이 앱 내부에서 프로필/홈 등을 다시 조회해 확인한다. 검증 중에는 앱 탭 한 개로 갱신 회전 충돌을 피한다.

**16 · 3분 공부 시작**

룸 선택 → 시작하기. `POST /api/sessions` 요청:

```json
{"roomId":11,"characterId":42,"targetMinutes":3}
```

roomId·characterId는 11번 홈과 12번 룸 상세에서 받은 실제 값을 사용한다. 현재 사용자가 Swagger에서 3분 시작 성공을 확인한 상태다.

정상 응답은 `201`이며 핵심 형태는 다음과 같다.

```json
{"sessionId":501,"startedAt":"2026-11-05T01:00:00Z","targetMinutes":3,"room":{"id":11,"name":"서버 룸 이름","backgroundImageUrl":"https://example.com/room.png"},"character":{"id":42,"name":"채린","profileImageUrl":"https://example.com/chaerin.png"},"avatar":{"id":5,"name":"기본 아바타","profileImageUrl":"https://example.com/avatar.png"},"me":{"nickname":"프로필저장확인","profileImageUrl":"https://example.com/avatar.png"},"serverTime":"2026-11-05T01:00:00Z"}
```

성공 기준: `/study/501`처럼 **응답 sessionId**의 공부 화면으로 이동하고, 3분 목표와 서버 캐릭터·내 프로필이 맞고 타이머가 증가한다. 기존 샘플 ID가 아닌 응답 ID를 사용해야 한다. 현재 MVP는 3분이 지나도 자동 종료하지 않으므로, 타이머가 계속 흐른다고 시작 실패는 아니다.

시작 후 `/events`의 FOCUS와 `/reaction`이 추가 호출될 수 있다. 이들은 이번 17개 외의 별도 API다. `/sessions` 201 이후 인사 API가 실패했다면 ‘세션 생성 성공·반응 실패’로 나눠 기록한다.

**21 · heartbeat**

공부 화면을 전면에 두고 65~75초 정도 유지한다. 약 1분마다 `POST /api/sessions/501/heartbeat`가 호출돼야 한다. 첫 검증은 카메라를 끄면 자리 비움 감지와 구분하기 쉽다. 현재 정책은 카메라 off 시간을 자리 지킴으로 센다.

요청 예시:

```json
{"studySeconds":63,"presentSeconds":63}
```

정상 응답은 **204, 본문 없음**이다. 빈 Response 창이 정상이며 `{success:true}` 같은 JSON을 기대하지 않는다.

성공 기준: 같은 sessionId로 반복되고 값은 **1분 구간 값이 아닌 누적 초**다. 보통 `0 <= presentSeconds <= studySeconds`이고 공부 중에는 누적 공부 시간이 증가한다. 실제 요청 시각에 따라 60/60과 정확히 같을 필요는 없다.

‘쉬는 시간’을 누른 상태도 65~75초 유지해 다시 확인한다. 휴식 중에도 heartbeat는 나가고 studySeconds/presentSeconds는 휴식만큼 늘지 않아야 한다. 페이지가 다시 보일 때나 재시도 버튼으로 추가 heartbeat가 나갈 수 있으므로 정확히 60초마다 한 건만 있어야 하는 것은 아니다.

다른 브라우저에서 복구해 과거 자리 지킴 기준이 없는 경우 현재 코드는 heartbeat 본문을 생략한다. 최신 Swagger상 본문 선택이지만 상세 계약에는 두 값이 필수라고 적혀 있어, 이 경우는 별도 호환성 확인 항목이다. 정상 기본 시나리오는 같은 탭으로 진행한다.

**17 · 같은 세션 이어하기**

1. 16번으로 시작하고 21번 heartbeat가 한 번 이상 성공할 때까지 공부한다. sessionId와 마지막 누적 값을 기록한다.
2. 공부를 종료하는 버튼을 누르지 않고 **같은 탭에서 F5**한다. 10~20초 기다린다.
3. 7번 갱신·8번/11번 조회 후 진행 세션이 같은 sessionId인지 확인한다.
4. ‘이어서 시작할게’를 누른다. `POST /api/sessions/501/resume`, 요청 본문 없음.

정상 응답은 `200`이다.

```json
{"sessionId":501,"targetMinutes":3,"room":{"id":11,"name":"서버 룸 이름"},"character":{"id":42,"name":"채린","profileImageUrl":"https://example.com/chaerin.png"},"avatar":{"id":5,"name":"기본 아바타","profileImageUrl":"https://example.com/avatar.png"},"me":{"nickname":"프로필저장확인","profileImageUrl":"https://example.com/avatar.png"},"studySeconds":65,"breakSeconds":20,"serverTime":"2026-11-05T01:01:25Z"}
```

성공 기준: 같은 sessionId·목표·룸·캐릭터가 복구되고 타이머는 **응답 studySeconds부터** 증가한다. 새 세션 생성 요청이 나가면 안 된다. 끊긴 구간은 서버가 휴식으로 보정하므로 새로고침 직전 화면과 수 초 차이가 있을 수 있다. 이어하기 직후 프런트에서 FOCUS를 추가 전송하지 않으며, 1분 뒤 heartbeat가 다시 성공해야 한다.

탭을 닫거나 세션 저장소를 지우면 현재 서버 응답에 없는 과거 presentSeconds 기준을 잃을 수 있다. 그 상태에서 이어하기 요청이 200이어도 종료 정산은 제한될 수 있어 별도 테스트로 기록한다.

**24 · 로그아웃과 진행 세션 보존**

프로필 메뉴 → 로그아웃. `POST /api/auth/logout`, 요청 본문 없음, refresh_token 쿠키 사용.

Swagger는 **200**, 제공된 상세 자료는 **204**로 적혀 있다. 실제 200 또는 204와 함께 다음을 확인한다.

1. refresh_token 쿠키가 지워지거나 만료된다.
2. 앱의 사용자 표시가 사라지고 보호 화면이 로그인으로 이동한다.
3. F5해도 로그인 상태가 복원되지 않는다. 이때 `/auth/refresh`의 `401 REFRESH_TOKEN_INVALID`는 정상적인 로그아웃 결과다.
4. 진행 중인 세션을 공부 종료 API로 닫지 않은 상태였다면, 같은 계정으로 5번 재로그인 후 8번/11번에 같은 sessionId가 남고 17번으로 이어진다.

공부 화면에서 홈으로 나가 로그아웃할 때는 ‘공부 마무리’와 구분한다. 주소창으로 같은 탭의 `http://localhost:3000/`에 진입하면 홈에서 진행 세션을 확인하고 로그아웃할 수 있다. 이때 22번 `/end`가 전송되지 않았는지 Network를 확인한다.

로그아웃의 서버 계약은 refresh token 폐기다. 전에 복사한 accessToken이 즉시 모든 API에서 거절되는지는 별도 JWT 폐기 정책이므로, 복사해 둔 토큰의 `/me`가 200이라는 사실만으로 로그아웃 실패라고 단정하지 않는다. 핵심은 쿠키 갱신이 더 이상 안 되는 것이다.

**6 · 카카오 로그인 별도 검증**

1. 앱에서 로그아웃한 뒤 `http://localhost:3000/login`의 ‘카카오로 계속하기’를 누른다.
2. 인가 화면으로 이동하기 전에 버튼 주변 약관 안내와 전문 링크를 확인한다.
3. 카카오 로그인·동의 후 `http://localhost:3000/oauth/kakao?code=...&state=...`로 돌아온다.
4. 앱이 state를 대조한 뒤 `POST /api/auth/social/KAKAO`를 한 번 호출한다.

최신 명세 기준 요청:

```json
{"code":"<이번 카카오 인가 코드>","redirectUri":"http://localhost:3000/oauth/kakao"}
```

이 요청에는 agreedTermVersionIds를 보내지 않는다. 이전 제공 자료의 예시와 달라진 현재 배포 명세를 따른다.

정상 응답은 `200`이다.

```json
{"accessToken":"<마스킹>","userId":202,"isNewUser":true,"onboardingRequired":true}
```

성공 기준: 유효한 토큰·사용자 정보와 refresh cookie를 받고, 8번 조회 후 onboardingRequired에 따라 온보딩/홈으로 이동한다. 이미 온보딩을 마친 같은 카카오 계정으로 다시 로그인하면 같은 userId가 유지되고 홈으로 이동해야 한다. isNewUser는 실제 최초 가입 여부에 따라 달라진다.

취소하면 로그인 화면의 취소 안내로 복귀해야 한다. callback URL 새로고침으로 사용한 코드를 반복 제출하지 않고, 재시도는 카카오 버튼에서 새 인가를 받는다. 카카오 사이트에서 400/설정 오류가 나오면 callback 교환 이전 실패, callback 뒤 6번이 4xx면 교환 실패, 6번 200 뒤 `/me` 등이 실패하면 로그인 후 사용자 로드 실패로 구분한다.

**오류를 판단하는 기준**

| 관찰 | 판단 |
|---|---|
| 아직 로그인하지 않은 첫 접속에서 refresh 401 | 유효 쿠키가 없는 정상 상태일 수 있음 |
| 보호 요청 401 → refresh 200 → 원래 요청 200 | 자동 복구 성공 |
| 올바른 계정 로그인 직후 refresh 401 | 쿠키 발급·Path·origin·프록시 전달·백엔드 저장을 조사 |
| 올바른 계정인데 로그인은 200, `/me`는 갱신 후에도 401 | 발급 토큰/Authorization/백엔드 인증 처리 확인 |
| 잘못된 비밀번호의 INVALID_CREDENTIALS | 의도한 실패 처리. 홈으로 이동하지 않아야 함 |
| 잘못된 번호 INVALID_CODE, 만료 CODE_EXPIRED | 의도한 실패 처리. 가입으로 진행하면 안 됨 |
| 빠른 재발송의 429/TOO_MANY_REQUESTS | 상세 계약의 재발송 제한. 약 1분 뒤 재시도 |
| 16번 409 SESSION_ALREADY_IN_PROGRESS + detail.sessionId | 새 생성 실패·기존 세션 있음. 17번 이어하기 흐름 확인 |
| 17번/21번 409 SESSION_ENDED | 이미 종료된 세션. 새 세션/리포트 확인 대상 |
| 2xx인데 JSON 필드가 없거나 화면이 깨짐 | HTTP 성공과 화면 연동 실패를 구분해 기록 |
| 요청 자체가 안 나감 | 폼 검증·버튼 비활성·자바스크립트 오류 등 프런트 진입 조건 확인 |

실패 기록에는 시각, 로그인 방식, 화면 조작, 메서드·URL, HTTP 상태, code/message, 기대 결과와 실제 결과를 남긴다. 이메일은 일부 가리고 비밀번호·Authorization·Cookie·accessToken·verificationToken·카카오 code는 포함하지 않는다. 테스트 완료 여부는 HTTP와 화면/재조회 결과를 함께 적는다.

검증 후 진행 세션을 정리하려면 UI의 공부 마무리를 사용한다. 이는 이번 목록 외의 22번 종료 API이며, 성공 시 리포트로 이동해야 한다. 검증용 일정에는 아직 삭제 API가 없다는 점도 감안한다.
