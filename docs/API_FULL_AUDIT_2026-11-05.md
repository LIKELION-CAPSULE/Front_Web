# Swagger 기준 전체 프런트 API 재점검 · 2026-11-05

현재 브랜치 `30-add-api-연결`, 회원탈퇴 커밋 `4295855` 이후의 점검이다. 요청 수정 커밋은 `c64ff33`이며 해당 원격 브랜치에 푸시했다. 이전 25개 API 점검과 이번 결과를 합산해서 실서버 검증 완료 수를 부풀리지 않는다.

**26개 API 모두 호출·화면 연결이 있고, 50개 DTO의 필드·타입·필수 여부·enum이 최신 Swagger와 일치한다. 이번 실서버 요청 63건 중 예상과 다른 실패는 없었고, 18개 API에서 실제 성공 응답을 확인했다. 나머지 8개는 현재 실행에서 오류 응답만 확인했으며, 성공 화면은 모의 응답으로 확인했다.** 실계정의 신규 가입·카카오 인가·비밀번호 변경·회원탈퇴가 검증 완료됐다는 의미는 아니다.

## 명세와 확인 경로

- [최신 Swagger](https://backendlab-production-3052.up.railway.app/swagger-ui/index.html#/)의 [OpenAPI](https://backendlab-production-3052.up.railway.app/v3/api-docs)를 새로 내려받았다. 현재 로컬 스냅샷과 바이트 단위로 같고, SHA-256은 `482039b8a103f028d21d5343e8554c38596133d09182e02193f68a2032df39d5`다. 23개 경로·26개 작업·50개 스키마이며 번호 15는 없다.
- 정적 대조는 TypeScript AST에서 실제 `api.request`/`this.request`의 메서드·조건부 경로·템플릿 경로를 수집했다. 모든 DTO의 필드·참조·배열·enum·선택 여부도 OpenAPI와 대조했다. 문자열 검색만으로 연결 완료를 판단하지 않았다.
- 실제 호출: `http://127.0.0.1:3000/api/backend/*` → 앱의 Vite 프록시 → Railway. 실제 ApiClient, DTO validator와 화면 adapter를 사용했다. 토큰·쿠키는 메모리에만 두고 계정 인증정보·대화 원문을 결과에 남기지 않았다.
- 실제 브라우저: localhost에서 이메일 로그인 → 홈 → 룸 상세 → 프로필·일정 → 기존 리포트 → 로그아웃. JavaScript 예외 0건, 서버 배너 이미지 로드 2167×726을 확인했다.
- 운영 Vercel도 읽기 위주로 확인했다. `GET /api/backend/terms`는 JSON 200, 무쿠키 `POST /api/backend/auth/refresh`는 JSON 401이었다. 프록시 경로의 404는 재현되지 않았다.
- [실서버 응답 근거](API_FULL_AUDIT_LIVE_2026-11-05.json), [브라우저 근거](API_FULL_AUDIT_BROWSER_2026-11-05.json), [API별 통합 결과](API_FULL_AUDIT_2026-11-05.json)를 로컬에 보관한다.

## API별 결과

모든 행은 프런트 연결이 있다. `실제`는 이번 실행의 2xx와 응답 소비 검증이며, `모의`는 실제 계정/외부 인증 없이 브라우저의 성공·오류 분기를 확인한 것이다. 오류 응답은 2xx 성공으로 집계하지 않았다.

| 번호 | API | 연결·화면 | 이번 성공 검증 |
|---|---|---|---|
| 1 | `GET /api/terms` | DemoProvider → 약관 전문·가입 동의 | 실제 200 + 브라우저 전문 표시 |
| 2 | `POST /api/auth/email/verification` | LoginPage·EmailVerificationForm → 요청/재발송·서버 만료 시간 | 모의 202. 실제는 잘못된 입력 오류만 |
| 3 | `POST /api/auth/email/verification/confirm` | EmailVerificationForm → 가입용 토큰 | 모의 200. `001234` 선행 0 유지 |
| 4 | `POST /api/auth/email/signup` | LoginPage → 인증 토큰·최신 약관 버전·신규 온보딩 | 모의 200 → /me → 온보딩 |
| 5 | `POST /api/auth/email/login` | LoginPage → 서버 계정으로 인증 | 실제 200 + 홈 표시 |
| 6 | `POST /api/auth/social/KAKAO` | KakaoCallbackPage → state 확인·code/redirectUri 1회 교환 | 인가 페이지·백엔드 모두 모의. 중복 교환 0건 |
| 7 | `POST /api/auth/refresh` | ApiClient → 메모리 토큰 갱신·원래 요청 재시도 | 실제 200 → 같은 /me, 로그아웃 후 401 |
| 8 | `GET /api/me` | DemoProvider → 사용자·온보딩·진행 세션 | 실제 200 + 프로필 표시 |
| 9 | `GET /api/avatars` | DemoProvider → ServerAvatarPicker | 실제 200. 선택·온보딩 저장은 모의 |
| 10 | `PATCH /api/me` | ProfileEditor·OnboardingPage → 닉네임·avatarId | 실제 200(기존 닉네임 유지). 새 값 저장은 모의 |
| 11 | `GET /api/home` | DemoProvider → 오늘 공부 시간·룸·이어하기 | 실제 200 + 홈 표시 |
| 12 | `GET /api/rooms/{roomId}` | DemoProvider → 상세·배너·캐릭터·관계 | 실제 200 + 배너 로드 |
| 13 | `POST /api/me/memories` | MemoryEditor·카드 → 생성 ID·일정 목록 반영 | 모의 201 + 재조회. 실제 일정 추가는 이번에 생략 |
| 14 | `GET /api/me/memories` | DemoProvider → 달력·예정/전체/지난 일정 | 실제 200(status=ALL). 화면 필터는 받은 목록에서 계산 |
| 16 | `POST /api/sessions` | PreparePage → 서버 roomId/characterId·3분 목표 | 실제 201. 테스트 세션 1건 생성 |
| 17 | `POST /api/sessions/{sessionId}/resume` | StudyPage → 서버 누적 공부 시간으로 재개 | 실제 200. 브라우저 새로고침·재개는 모의 |
| 18 | `POST /api/sessions/{sessionId}/events` | useSessionSync → 상태 큐·순간 동작·호감도·표정 | 실제 201. FOCUS/AWAY/RETURN/BREAK/DROWSY/YAWN/WAVE/HEAD_TURN 모두 확인 |
| 19 | `POST /api/sessions/{sessionId}/events/{eventId}/reaction` | useSessionSync → 대사·표정 | 실제 200. 8종 반응의 requestId·캐릭터·비어 있지 않은 대사 확인 |
| 20 | `POST /api/sessions/{sessionId}/messages` | SessionChatPanel → TEXT/QUICK·UUID·서버 답장·호감도 | 실제 200, 두 inputType 모두 확인. 브라우저 QUICK도 모의 검증 |
| 21 | `POST /api/sessions/{sessionId}/heartbeat` | useSessionSync → 누적 공부/자리 지킴 시간 | 실제 204·빈 본문. 가상 시계로 1분 주기·휴식 중 공부 시간 고정·중복 방지 확인 |
| 22 | `POST /api/sessions/{sessionId}/end` | StudyPage → 이벤트 저장 완료 후 정산 | 실제 200. 이번에 만든 테스트 세션 종료 |
| 23 | `GET /api/sessions/{sessionId}/report` | ReportPage·CapsuleCardPage → 서버 기록·완료 대사 | 실제 200. 종료 응답의 공부 시간과 일치. 브라우저 표시도 확인 |
| 24 | `POST /api/auth/logout` | HeaderAccount → 쿠키 폐기 후 계정 상태 정리 | 실제 204 → refresh 401, 브라우저 로그인 화면 복귀 |
| 25 | `POST /api/auth/password/reset-request` | PasswordRecoveryForm → 메일 접수 안내 | 모의 202. 이번에는 실제 메일을 다시 보내지 않음 |
| 26 | `POST /api/auth/password/reset` | PasswordResetPage → token/newPassword·로그인 복귀 | 모의 204. URL 토큰 제거·완료 안내 확인 |
| 27 | `DELETE /api/me` | HeaderAccount → 확인 창 → 탈퇴·계정 캐시 정리 | 모의 200/409/500. 취소 미호출·중복/닫기 방지·다음 계정 분리 확인 |

13번 일정 저장과 25번 재설정 메일은 [이전 실계정 점검](API_AUDIT_2026-11-05.md)에서 각각 201·202와 메일 실제 도착까지 확인했다. 이 과거 성공을 이번 실행의 18개에 더하지 않았다. 실제 탈퇴·비밀번호 변경·새 일정 생성은 이번에 하지 않았다. 테스트 세션의 기록·서버 정산은 실제 계정 데이터에 반영된다.

## 수정한 불일치

`DemoProvider.createMemory`가 미입력 시간을 `dueTime: null`, 날짜 없는 목표를 `dueDate: ''`로 전송했다. OpenAPI는 두 필드를 선택 문자열로 정의하므로, 미입력 필드는 생략하고 입력한 문자열만 보내도록 수정했다. `satisfies CreateMemoryRequest`로 잘못된 요청 타입도 컴파일에서 검출한다. 모의 서버에서 요청 본문을 검사하고 저장 후 재조회·계정 분리를 확인했다.

## 확인된 경계·남은 구현

| 항목 | 현재 판단 |
|---|---|
| 실제 인증이 필요한 5개 API | 2·3·4번 신규 가입, 6번 카카오, 26번 실제 비밀번호 변경은 유효 메일 코드·인가 코드·재설정 토큰이 필요하다. 모의 화면 통과를 실계정 성공으로 간주하지 않는다 |
| 회원탈퇴 | 프런트 연결·409·오류·성공 정리는 확인했다. 실제 계정 삭제와 모든 기기 로그아웃은 실행하지 않았다 |
| Live2D·서버 motion·TTS | 서버 캐릭터의 modelJsonUrl/배치와 expression.file을 받는 런타임 연결은 있다. `motion.group/file` 재생과 audioBase64 재생은 미연결이며 요청은 tts=false다. 이번 실제 반응/메시지의 motion·audio는 null도 반환했다. Live2D의 실제 WebGL/표정 재생·카메라 하드웨어 감지는 이번에 검증하지 않았다 |
| 다른 기기 이어하기 | ResumeResponse에 presentSeconds가 없다. 이 기기의 계정별 localStorage 복구 기준이 없으면 이전 공부를 보수적으로 처리하고, 종료 시 안내·확인을 거친다. heartbeat는 누적 본문을 생략한다. 완전한 기기 간 복구에는 서버 필드가 필요하다 |
| 다른 기기 목표 달성률 | ReportResponse에 목표 시간이 없어 계정별 기기 저장값이 없는 경우 달성률을 임의로 만들지 않는다 |
| 일정 수정·삭제·대화 이력 | Swagger에 해당 API가 없다. 생성/목록 조회·현재 방문 대화만 연결되어 있으며 로컬 수정 성공이나 과거 대화 복구를 꾸미지 않는다 |
| 새 호감도 정책 | 서버 호감도·단계를 반영하며 프런트에서 자체 적립하지 않는다. 8종 이벤트의 수신은 확인했으나 연속 출석·하루 감점 상한·사전 대사 순환의 전체 정책 검증은 아니다 |

## Swagger와 실서버의 문서 차이

- 이벤트 저장은 Swagger 200, 실제 201이고 로그아웃은 Swagger 200, 실제 204다. 공통 client가 모든 2xx·빈 본문을 처리하므로 앱 동작에는 문제가 없었다.
- 실제로 null을 반환하지만 Swagger에 nullable이 없는 필드: `MeResponse.activeSession`, `HomeResponse.activeSession`, `MemoryList.memories[].dueTime`, `RoomDetail.activeSessionId`, `ReportResponse.relation.nextLevelPoints`, 반응·메시지의 `motion`/`audioBase64`. 현재 소비 경로는 이를 처리하지만 백엔드 명세 보완이 필요하다. 공개 스냅샷을 임의로 바꾸지 않았다.

## 코드 검사

단위 테스트 219개, TypeScript 포함 프로덕션 빌드, ESLint, `git diff --check` 통과. 브라우저 모의 흐름: 가입/재전송·온보딩·카카오 왕복·재설정·일정 저장·공부/휴식/재개·대화·리포트·탈퇴 409/500/200. 별도의 실제 브라우저 읽기 흐름과 구분해 기록했다.

API 문서·원본·결과 JSON은 기존 사용자 정책에 따라 Git에서 제외한다. 실행 환경파일과 인증정보는 수정하거나 기록하지 않았다.
