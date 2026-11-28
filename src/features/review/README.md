# UI/UX 검토 패널

개발 서버에서 [http://localhost:3000/__review](http://localhost:3000/__review)를 연다. 운영 빌드에는 패널·가상 응답·진입 버튼이 포함되지 않는다. 모드별 진입 경로:

- `VITE_DATA_SOURCE=api`: 오른쪽 아래 **◫ UI 검토 · DEV** 링크(통화 화면에서는 구석의 작은 핸들, 모바일 접속 안내에서는 숨김).
- `VITE_DATA_SOURCE=mock`(기본): 오른쪽 아래 로컬 더미 패널(`LocalControls`)을 펼쳐 **UI 검토 패널 열기**.
- 두 모드 모두 `Ctrl/⌘+Shift+D`(`shortcut.ts` 한 곳에서 처리).

## 사용 방법

1. 왼쪽에서 화면·상태를 고른다. 로그인/가입/약관/비밀번호/카카오, 온보딩/홈/새 사용법, 메이트/연결/연결 기록, 내 기록, 내 메이트, 크레딧/초대, 계정/오류/빈 화면, 공용 컴포넌트를 제공한다. 검색은 제목·ID·설명·경로를 찾고(Esc로 지움), 그룹은 접을 수 있으며 그룹마다 검토 완료/항목 수를 보여 준다. ←/→는 검색으로 좁힌 목록 안에서 이동한다.
2. 너비는 1440·1280·900·모바일(390) 버튼으로 바로 고르고, 960·720·640은 옆 메뉴에서 고른다. 휴대폰 전용(`mobile-notice*`)·좁은 창(`account-narrow`, 640)처럼 `defaultWidth`가 있는 시나리오는 그 너비로 열리고, 다음 시나리오에서는 직전에 고른 너비로 돌아온다. 프레임 내부는 선택한 실제 CSS 너비로 동작하고, 패널에서는 공간에 맞춰 축소해 보여 준다. 원본 크기로 캡처하려면 **미리보기만 새 탭**을 누른다. 프레임 안에서 클릭·입력·스크롤할 수 있다.
3. **현재 문구**에서 표시된 본문·버튼·접근성 이름·placeholder를 한 번에 복사한다. 모달을 열거나 화면을 조작하면 목록도 갱신된다.
4. **전체 문구 검색**에서 문구 또는 파일명을 검색한다. 숨겨진 상태·오류 분기·약관 전문과 동적 문자열을 포함하며 소스 파일·줄 번호를 보여 준다. ‘소스 다시 읽기’로 저장한 코드의 최신 문구를 다시 수집한다. 프리셋 문구의 복제본이 아니라 `src`, `server`, `api`의 현재 소스를 읽는다.
5. **가상 요청**은 미리보기에서 처리한 최근 100건의 경로·메서드·응답 상태를 보여 준다. 실제 서버 요청 이력은 아니다.
6. **검토 완료** 표시로 진행 상황을 남긴다. 상태 초기화는 현재 미리보기를 새로 만들며, 링크 복사는 선택한 화면과 너비를 공유한다. 링크의 미리보기 상태 쿼리(`dialog`, `chatDelay`; `catalog.ts`의 `reviewStateParams`)는 미리보기 프레임까지 전달된다(예: `/__review?case=component-showcase&dialog=danger`).

**상태 문구** 탭은 오류·완료·주의·로딩·빈 상태·안내로 문구를 분류한다. 위에는 현재 미리보기에 실제 표시된 피드백을, 아래에는 소스에 정의된 상태 문구와 파일 위치를 보여 준다. 일반 버튼·본문 전체와 구분해 상태 문구만 검색·필터·복사할 수 있다. 상황 바로가기로 로그인 실패·저장 완료·복구 경고·권한 오류·탈퇴 등의 실제 배치를 확인한다. ‘이 상황 보기’는 해당 소스 조건을 재현하는 프리셋이며, ‘관련 화면’은 연관 흐름을 여는 버튼으로 그 문구를 즉시 재현한다는 의미는 아니다. 소스 분류는 JSX tone·오류 처리·로딩 표현 등을 근거로 한 검토 보조 정보다.

검토 완료 ID만 부모 패널의 `capsule-ui-review:checked:v1` 키에 저장한다. 미리보기 안의 로그인·일정·공부 복구 정보는 별도의 메모리 저장소에만 남고 초기화하면 사라진다.

## 검토 범위

실제 페이지와 공통 컴포넌트를 그대로 렌더링하고 가상 API 응답으로 정상·오류·로딩 상태를 준비한다. `reports`를 지정한 시나리오는 로컬 서버의 기본 기록(steady)을 비우고 지정한 기록만 만든다. 메이트 모델은 통화·메이트 상세·로그인 화면 모두 리뷰 미리보기에서는 정지 그림이다(로그인 메이트는 `html[data-review-still-mates]`일 때 `login-mate-source.ts`가 로컬 Live2D를 쓰지 않음). 예외로 졸음·깨어남 움직임을 보는 `login-doze`·`login-doze-awake`(`liveMate`)는 `local-assets/`에 모델이 있을 때만 라이브 모델을 쓴다. `/__local-assets`(개발용 모델·아바타)는 그 밖에는 요청하지 않으므로 `local-assets/`가 없는 클린 worktree에서도 404가 나지 않는다. 미리보기 안에서는 페이지 내장 DEV 위젯(출석 `▶ DEV`, 연결 기록 DEV 토글)을 숨긴다. 부트스트랩 전에 fetch와 저장소를 분리하므로 실제 계정의 로그인·탈퇴·프로필·일정·공부 데이터는 조회하거나 수정하지 않는다. 카메라·마이크는 실제 장치를 요청하지 않고 권한 거부 상태를 보여 준다. 외부 카카오 이동은 차단하고 준비된 콜백 상태를 이용한다.

정적 문구 목록은 JSX 본문, 사용자에게 보이는 속성, 한글 상태/데이터 문자열, 템플릿 문자열과 약관을 수집한다. 템플릿의 변수는 원문 그대로 표시한다. 서버가 자유롭게 생성하는 대사·사용자 입력의 모든 가능한 조합은 정적 목록으로 열거할 수 없으며, 현재 화면 문구와 가상 데이터 예시로 함께 확인한다. 검토 모드의 데이터·카메라·WebGL 조건을 실제 API/장치 검증으로 간주하지 않는다.

## 구성과 확장

- `catalog.ts`: 화면 경로·설명·초기 조건·자동 조작 순서.
- `fixtures.ts`, `storage.ts`: 가상 API(로컬 더미 서버 `local-demo/transport.ts`를 시나리오별로 채워 재사용, 11-25 계약)와 프레임별 메모리 저장소.
- `ReviewSetup.tsx`: 연결 복구·확인 창/입력 상태 준비, 실제 표시 문구 수집. `optional` 스텝은 지금 화면에 요소가 없으면 바로 건너뛴다(예: 900px 이하에서만 보이는 「채팅 열기」).
- `ReviewStudyGate.tsx`: 진행 중 연결 시나리오에서 리뷰 이미지 무대가 준비될 때까지 기다린다.
- `account-port.ts`: `accountContract`에서만 사용하는 새 가입/프로필의 모의 저장 경계. 확정된 서버 계약이 아니다.
- `mate-port.ts`: `mateContract`에서만 사용하는 상세/초기화 모의 경계. 이미지 모델·무음 WAV는 상태 검토용이며 실제 Live2D 제작물·메이트 음성·서버 삭제를 검증하지 않는다. `mateHistory`는 초기화 전후 보존 범위를 확인하는 명시적 메시지 샘플이며 운영 캐시에는 주입하지 않는다.
- `ReviewWorkbench.tsx`: 화면 목록·크기·문구·요청·검토 진행 도구.
- `ComponentShowcase.tsx`: `component-showcase` 시나리오. 실제 공용 `Dialog`(톤 없음·danger·info·credit·celebrate)와 `NotificationStack`(성공·안내·주의·오류)을 한 화면에 띄운다. 앱을 띄우지 않고 내용만 검토용 예시다.
- `ReviewLauncher.tsx`·`shortcut.ts`: api 모드 진입 링크와 두 모드 공용 단축키.
- `ReviewMessagesPanel.tsx`, `messages.ts`, `capture-messages.ts`: 상태 문구 필터·상황 연결·현재 피드백 수집. 미리보기를 가린 탭에서도 문구를 유지하며, 모달이 열리면 모달 내부를 우선한다.
- `server/review-copy.ts`: Vite 개발 서버 전용 문구 수집. `GET /__review/copy`; 환경파일은 읽지 않는다.
- 디자인 시안 정리(2026-11-28): 운영에 적용된 시안(통화 C1·채팅 패널 P1~P3·모달 B2·토스트 T1)과 탈락안의 `call-ui/`·`chat-panel/`·`dialog-design/` 폴더, `call-ui-*`·`chat-panel-*`·`dialog-design-*` 시나리오 12개를 지웠다. 예전 링크는 `restoredReviewIds`로 이어진다(`call-ui-*`·`chat-panel-p1|p3` → `connection-active`, `chat-panel-p2` → `connection-chat-empty`, `dialog-design-*` → `component-showcase`). 통화 채팅은 `connection-chat-empty`(첫 통화 빈 상태)·`connection-chat-typing`(답장 대기)·`connection-stage-up-now`(친밀도 줄·알림 바로 보기)로 본다. 분기가 없던 `home-return`·`home-live2d-fallback`·`home-lowpower`도 지우고 `home-first`로 이었다.
- 서도현(2번 메이트): `mate-detail-dohyun`·`connection-active-dohyun`·`my-mates-dohyun`. 1분 미만 연결 규칙은 `my-mates-short-connection`.
- 모바일 접속 안내(SCR-40): 시안 M2 「스크롤 소개」가 실제 화면이 됐다(2026-11-27, `src/features/mobile-gate`). `mobile-notice`(초대 링크)·`mobile-notice-plain`·`mobile-notice-inviter` 시나리오가 실제 앱을 띄워 휴대폰 안내를 강제로 보여 주고, 너비는 휴대폰(390)으로 열린다. 기능 카드 아래에는 「PC에서 이렇게 시작해요」 3단계가 있고, 3단계의 「초대 코드는 자동으로 들어가요」는 초대 링크일 때만 보인다(같은 날 추가, 예전 PC 안내 한 줄은 이 섹션으로 대체). 시안 전용 `mobile-gate/`와 M1·M2 시나리오는 지웠으며 예전 링크(`mobile-gate-m1|m2[-invite]`)는 `restoredReviewIds`로 이어진다.

새 상태는 catalog에 추가하고 fixtures의 필요한 분기를 연결한다. 새로운 페이지 파일을 만들면 catalog에도 경로를 추가한다. 문구 검색은 소스를 매번 읽으므로 별도 문구 파일을 동기화할 필요가 없다.

## 확인 결과

2026-11-22 임시 채린 시각 자료: 사용자가 화면 확인을 위해 기존 말포이 제작물을 채린 이름으로 일단 재사용하도록 승인했다. 로그인·홈 배너·카드·상세·기록·PIP 이미지와 모의 연결 이미지를 같은 제작물로 맞췄다. 홈 메이트 목록이 비어도 배너와 사용법 이미지는 보이며, 연결 가능한 가짜 ID/카드는 만들지 않는다. 일반 앱의 실제 API 응답 이름 매핑에도 같은 임시 정책을 적용한다. 서버의 실제 ID/모델·원본 응답/대사/프롬프트는 유지하며 최종 출시 제작물 확정과는 구분한다.

임시 채린 변경은 전체 단위 418개·린트·빌드와 Chromium/WebKit 1280/1440px의 일반 앱/디버그 흐름 34개로 확인했다. 배너 얼굴 크롭과 스크래치 전환, 기존 이름의 연결/재개/보고서 표시를 포함한다. 실제 백엔드 요청 없이 모의 응답과 검토 이미지를 사용했으며, 실제 Live2D 장시간·서버 생성 대사 검수와 구분한다. 원본은 `.temp/temporary-chaerin-browser-results-{chromium,webkit}.json`이다.

2026-11-22 보관 화면 복귀: 최종 문서 M-2의 기록/빈 상태와 S-2의 크레딧은 기존 활성 프리셋으로 통합하고, 이전 친구 상세는 M-1의 내 메이트/기록 없음 프리셋으로 복귀했다. 예전 `draft-records`, `draft-records-empty`, `draft-characters`, `draft-credits` 링크도 현재 화면·주소로 연결한다. 옛 친구 검색·공부 레벨·체험 해금·충전 내역은 되살리지 않는다. 내 메이트에는 검토 API 보고서로 확인한 채린만 보이며 새 친밀도·해금 계약 대기는 유지한다. 유료 충전과 영수증 출력은 문서상 베타 제외이므로 계속 보관한다.

이 복귀 변경은 검토 패널 단위 검사 7개·린트·타입 검사 포함 빌드, Chromium/WebKit의 1280/1440px 브라우저 흐름 26개로 확인했다. 예전 링크·현재 경로·빈 상태·메이트 탐색·크레딧에서 초대로 이동·보관 목록 2개·충전 원본 진입을 확인했으며 실제 백엔드 요청과 JavaScript 예외는 0건이다. 운영 JS에도 검토 패널/프리셋 표식이 없다. 원본은 `.temp/review-restore-results-{chromium,webkit}.json`이며 검토용 모의 API 검사다.

2026-11-22 프런트 단독 P0/P1: `home-tutorial`은 사용자가 추가를 승인한 새 3단계 사용법이다. 홈의 사용법 보기나 `/?tutorial=1`에서도 연다. 설정의 PIP 말풍선은 실제 브라우저 표시 선호를 사용하되 검토 모드에서는 전용 메모리 저장소에만 보존한다. 내 기록의 메이트별 목록과 연도 이동은 기존 `records` 시나리오의 명시적 보고서/카메라 샘플로 검토한다. 이 데이터를 실제 서버 전체 기록으로 해석하지 않는다.

2026-11-05 기준 74개 시나리오 전부 준비 완료, 브라우저 JavaScript 예외 0건, 실제 백엔드 요청 0건. 132개 파일의 문구 1,250개 가운데 상태 문구 189개를 분류했다. 오류·완료·주의·로딩·빈 상태·안내의 실제 표시 문구 수집, 검색·빈 검색·종류 필터·상황 바로가기를 확인했다. 탭 변경으로 프레임을 가려도 현재 피드백이 유지되며, 되돌릴 수 없는 작업 안내는 빈 상태와 구분해 주의로 분류한다. 390px에서 가로 넘침이 없고 검토 완료 저장·상태 초기화·문구 복사도 동작했다. 운영 빌드에는 검토 코드가 없으며 기존 로그인·라우팅도 확인했다. 전체 테스트 226개·빌드·린트가 통과했다. 문구·시나리오 수는 이후 소스 변경에 따라 달라진다.

2026-11-25 정리: ‘보관 화면 · 현재 미노출’(유료 충전·영수증 원본, `ReviewDraftRoutes.tsx`)과 로그인 시안 `login-alt-*`, 렌더되지 않는 메뉴를 전제로 한 `mate-reset`을 지웠다. 예전 링크는 `restoredReviewIds`로 현재 화면에 연결한다.

2026-11-25 API 연동 2단계: 대화 초기화는 내 메이트 ⋯ 메뉴로 옮겨 `mate-reset-confirm`·`mate-reset-error`·`mate-reset-conflict`(47의 409 `CONNECTION_IN_PROGRESS`)로 검토한다. revision이 없어진 47에 맞지 않는 `mate-reset-partial`은 지우고 `mate-reset-error`로 연결했다. 헤더 알림은 `notifications`·`notifications-empty`·`notifications-error`(로컬 QA 키 `capsule-local-notifications`), 연결 화면은 `connection-chat-history`(32 지난 대화·평가)·`connection-reply-report`(41)·`connection-credit-short`(고급 모드 409 `CREDIT_INSUFFICIENT`)로 검토한다.
