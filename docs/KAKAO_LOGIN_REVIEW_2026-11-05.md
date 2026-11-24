# 카카오 로그인·비밀번호 재설정 후속 반영 · 2026-11-05

작업 폴더 `카카오로그인관련/`의 「프론트 작업」을 현재 코드와 대조하고, 기존 API 연동에서 다른 부분을 수정했다. Downloads의 같은 폴더와 작업 폴더의 문서는 내용이 같았다.

원문: `프론트 작업 40dc5e0bf17e800f872df8b194a2498a.md`.

원문 SHA-256: `97c71ed5c6241570cad244492e1c49630f3c6492a630d9fde1d640a6f51a74ec`.

## 1. 등록 주소와 로컬 설정

제공된 자료에 적힌 등록 URI는 다음과 같다. 카카오 콘솔을 직접 조회한 결과는 아니다.

| 환경 | 자료에 명시된 URI |
|---|---|
| 배포 | `https://capsule-front-web.boo4246.workers.dev/oauth/kakao` |
| 로컬 | `http://localhost:3000/oauth/kakao` |

사용자가 **개발 포트와 환경변수를 3000으로 맞추기**를 선택했다. 이에 따라 다음을 적용했다.

- [vite.config.ts](../vite.config.ts)의 개발·미리보기 포트는 3000이다. `strictPort: true`로 다른 포트에 자동 연결되어 callback origin이 달라지는 것을 막는다.
- `.env.local`의 `VITE_KAKAO_REDIRECT_URI`를 `http://localhost:3000/oauth/kakao`로 바꿨다. 나머지 환경변수 값은 유지했다.
- [.env.example](../.env.example)에 같은 로컬 URI를 적었다. 실제 REST API 키 값·Client Secret·JWT·DB 비밀은 문서에 복사하지 않았다.
- 로컬 접속 주소는 **localhost:3000**을 사용한다. `127.0.0.1:3000`은 다른 origin이므로 현재 설정으로 카카오 로그인을 시작하지 않는다.
- 배포 빌드에는 배포 URI를 별도로 설정한다. 로컬 `.env.local` 값을 배포 설정으로 그대로 사용하지 않는다.

앞서 안내한 5173은 등록 주소를 확인하기 전의 예시였다. 후속 자료와 사용자 선택에 따른 현재 실행 기준은 3000이다.

## 2. 카카오 진입·약관 안내

자료에 명시된 제품 결정에 따라 **카카오로 계속하기 버튼을 누르면 바로 인가 화면으로 이동**한다. 이전에 추가했던 별도 체크박스 동의 창을 제거하고, 버튼 아래에 다음 안내와 두 약관 전문 링크를 넣었다.

> 카카오로 계속하면 이용약관과 개인정보 처리방침에 동의하는 것으로 봅니다.

전문은 현재 `/terms`에서 받은 내용을 공통 약관 창으로 표시한다. 약관 응답을 확인하지 못하면 오류를 안내하고 카카오 진입을 진행하지 않는다. 17개 API 재점검 때 최신 Swagger에서 `KakaoRequest.agreedTermVersionIds` 제거를 확인해 카카오 교환 본문과 임시 저장값에서 약관 버전 목록을 제거했다. 이메일 가입은 `/terms`의 실제 버전 ID를 계속 전송한다. 이 항목은 제공된 화면 결정과 최신 배포 명세의 반영 기록이다.

## 3. callback 처리

[KakaoCallbackPage.tsx](../src/pages/KakaoCallbackPage.tsx)의 경로는 `/oauth/kakao`다.

```text
카카오로 계속하기
  → 카카오 인가 URL (REST API 키·redirect_uri·response_type=code·state)
  → /oauth/kakao?code=...&state=...
  → 저장한 state 대조
  → POST /api/auth/social/KAKAO 1회
  → accessToken을 메모리에 반영 + /me 조회
  → onboardingRequired이면 온보딩, 아니면 홈
```

브라우저는 현재 프록시 경로 `/api/backend/auth/social/KAKAO`를 통해 백엔드의 `/api/auth/social/KAKAO`를 호출한다. 최신 배포 Swagger에 맞춘 요청 본문은 `{ code, redirectUri }`다. 요청 중복 방지 ref를 유지해 StrictMode에서 인가 코드를 두 번 교환하지 않는다.

| 상황 | 현재 화면 처리 |
|---|---|
| code 없음·저장한 state와 불일치 | 교환 API를 호출하지 않고 로그인 화면에 재시도 안내 |
| 카카오 error 응답·취소 | 로그인 화면으로 복귀하고 취소 안내 |
| TERMS_REQUIRED | 로그인 화면으로 복귀하고 약관 확인 후 재시도 안내 |
| SOCIAL_AUTH_FAILED | 로그인 화면으로 복귀하고 만료/사용된 요청 안내 |
| 그 밖의 오류 | 로그인 화면에서 일반 실패 안내 |

오류 메시지 원문·인가 코드·토큰을 로그인 안내 URL에 넣지 않는다. [auth-notices.ts](../src/features/auth/auth-notices.ts)의 고정 notice 코드만 사용한다.

## 4. 비밀번호 재설정

### 메일 요청

`/login?mode=forgot-password`에서 `/auth/password/reset-request`를 호출한다. 202에는 다음 안내를 표시한다.

> 가입된 이메일이면 재설정 메일이 가요. 30분 안에 링크를 눌러 주세요.

가입 여부를 단정하지 않으며, 카카오로 가입했다면 카카오로 로그인하도록 안내한다. 잘못된 이메일·속도 제한 오류를 성공으로 처리하지 않는다.

### 메일 링크·토큰 처리

- 메일의 정식 경로인 **`/password/reset?token=...`**를 [PasswordResetPage.tsx](../src/pages/PasswordResetPage.tsx)로 연결했다.
- 기존 `/reset-password?token=...`, `/login?mode=forgot-password&token=...` 진입도 처리한다.
- [index.html](../index.html)의 초기 스크립트가 첫 렌더링·폰트 로딩 전에 토큰을 URL에서 제거하고, 재설정 화면에 일시적인 메모리 값으로 전달한다. localStorage·sessionStorage·history state에 재설정 토큰을 저장하지 않는다.
- 화면은 인계된 값을 자신의 메모리 상태로 유지하고 초기 전달 값은 지운다. StrictMode 초기화가 반복되어도 토큰이 사라지지 않으며, INVALID_PASSWORD 뒤 재시도에도 같은 토큰을 보낸다.
- 다른 query와 hash는 유지한다. 지워진 주소를 새로고침하면 원래 토큰을 복원하지 않고 새 링크를 요청하도록 안내한다.
- SPA 안에서 query가 있는 재설정 경로로 이동할 때도 화면 진입 직후 URL을 정리한다.

문서 메타와 Vite 개발/미리보기 응답에 `no-referrer`를 적용했다. 배포 정적 응답은 [public/_headers](../public/_headers)를 빌드 결과에 포함한다. `_headers`는 Cloudflare 정적 응답에 적용하는 설정이며, Worker가 생성하는 응답에는 별도 적용이 필요하다. [Cloudflare 공식 문서](https://developers.cloudflare.com/workers/static-assets/headers/)

### 저장 결과

| 응답 | 처리 |
|---|---|
| 204 | 로컬 인증 상태를 비우고 로그인 화면으로 이동. 변경 완료 안내 표시 |
| INVALID_PASSWORD | 입력 화면·메모리 토큰을 유지해 수정 후 재시도 |
| RESET_TOKEN_INVALID | 만료/사용된 링크 안내, 재전송 화면으로 이동하는 링크 제공 |

새 비밀번호는 8자 이상 및 기존 백엔드 자료의 bcrypt 한계인 72바이트 이하를 검사한다. 비밀번호 확인 값은 서버에 보내지 않는다.

## 5. 검증 범위

- 모바일 390px에서 카카오 버튼의 직접 이동, 약관 전문 링크, 인가 URL의 localhost:3000 callback과 state를 확인했다.
- API 모의 응답으로 코드 교환 1회, 정상 로그인, TERMS_REQUIRED·SOCIAL_AUTH_FAILED·취소 후 로그인 복귀를 확인했다.
- 재설정 URL의 토큰 제거, INVALID_PASSWORD 재시도의 토큰 보존, 204 후 로그인 이동, RESET_TOKEN_INVALID 후 새 링크 요청을 확인했다.
- 최초 검증에서 URL 정리 전 폰트 요청의 Referer에 토큰이 남는 경우를 발견해 정리 시점을 HTML 초기 실행으로 앞당겼다. 수정 뒤 같은 검증에서 토큰이 포함된 Referer 요청은 없었다.
- localhost:3000의 `/password/reset` 응답은 200과 `Referrer-Policy: no-referrer`를 반환했다. 브라우저 검증 중 페이지 JavaScript 오류는 없었다.
- 전체 단위 테스트 188개, 린트·타입·빌드·토큰 검사, `git diff --check`가 통과했다. 빌드된 HTML에서도 초기 토큰 제거가 스타일시트 앞에 있고, `_headers`가 빌드 결과에 포함됨을 확인했다.

실제 카카오 사용자 계정의 인가·백엔드 토큰 교환, 실제 재설정 메일 수신, Cloudflare 배포 응답은 이번 모의 응답 검증에 포함하지 않았다. 자료에 명시된 카카오 콘솔 등록과 백엔드의 REST API 키/Client Secret 일치는 운영 환경에서 확인해야 한다.

이 문서는 사용자 요청에 따라 Git에서 제외하고 로컬에 보관한다. `.env.local`과 실제 비밀 값도 Git에 포함하지 않는다.
