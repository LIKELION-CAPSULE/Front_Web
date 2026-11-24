# 11/1 MVP 기능명세서·PRD와 현재 프론트 비교

검토일: 2026-11-01. 검토 대상은 **원격 main을 현재 로컬 브랜치에 병합한 뒤의 코드 `85debe6`**이다. 배포 사이트가 이 커밋과 같다고 가정하지 않았다.

## 결론

현재 프론트는 여러 룸·친구, 기록·관계, 크레딧·패스를 포함한 서비스 프로토타입이다. 첨부 문서는 **11/7 시연용 1룸·(TS)말포이 1명·세션 1회·화면 3개**를 요구한다. 화면을 간소화하는 작업과 함께 **세션 상태 전이, 대화 출력, 이탈 집계, 데이터 삭제**를 변경해야 한다.

재사용할 수 있는 기반은 목표 시간 선택, 실제 카메라 권한·연결, 기기 내 MediaPipe 얼굴 감지, 경과/목표 타이머, 채팅 패널, LLM 요청 연결, 리포트 UI와 PNG 저장이다. 이 기반이 있다는 사실과 새 MVP의 동작을 충족한다는 판단은 구분했다.

이번 작업은 비교 검토와 main 병합이다. 새 MVP 기능을 구현하거나 기존 서비스 화면을 삭제하지 않았다.

## 검토 기준

- 첫 번째 첨부 텍스트: 2026-11-01 기능명세서, 기능 ID 37개와 우선순위.
- 두 번째 첨부 텍스트: 2026-11-01 MVP PRD.
- 두 문서의 **11/1 2차 수정**을 우선했다. 반응은 표정 3종·고개 움직임이며 몸 자세 변경과 추가 에피소드는 제외한다. 자유 대화는 누적 공부 10분당 1회다.
- 호감도는 PRD의 열린 질문이 남아 있지만 기능명세서 AFF-01·상세 4의 구체적인 **공부 시간(분, 버림) × 1, 세션 한정**을 비교 기준으로 삼았다.
- 말포이 캐릭터 설정 문서는 첨부되지 않았다. 최종 대사와 금지 주제 목록의 문구 일치 여부는 검증할 수 없다.
- 아래 코드 링크는 검토 커밋의 근거다. 아직 정하지 않은 API나 엔드포인트를 제안하지 않았다.

## main 병합 결과

| 항목 | 결과 |
|---|---|
| 유지한 로컬 브랜치 | `3-fix-각-화면-요소-수정` |
| 병합 전 | `5199e8f` |
| 가져온 원격 main / 병합 후 | `85debe6252a68e524e796a02270598d80348cf5f` |
| 방식 | `git fetch origin main` 후 `git merge --ff-only origin/main` |
| 충돌 | 없음. 기존 로컬 커밋이 main에 모두 포함되어 fast-forward 가능 |
| 들어온 변경 | 48개 파일. LLM 테스트 연결, 캠 가상 배경, 로고 클릭 종료 확인, 이어하기 확인 등 |
| 작업 중이던 파일 | `src/assets/README.md`의 수정 내용은 병합 전후 SHA-256이 같음을 확인 |
| 원격 반영 | push하지 않음. 로컬 HEAD와 이번에 fetch한 `origin/main` 사이 커밋 차이는 0 |

로컬 브랜치가 기존 원격 기능 브랜치보다 25개 커밋 앞선 표시는 main의 커밋을 가져온 결과다. 별도의 merge 커밋은 만들지 않았다.

## 우선 바뀌어야 하는 동작

### 1. 목표 도달·휴식·재개가 새 명세와 다르다 — P0

명세는 공부 중 원하는 시점에 휴식에 들어가고, 공부 타이머를 멈춘 채 제한 없이 쉰 뒤 **같은 세션**에서 다시 공부하도록 요구한다. 목표에 닿으면 별도의 달성 팝업을 한 번 띄우며 계속하기를 선택하면 목표를 넘겨 누적해야 한다.

현재 `TICK`은 목표 도달 즉시 `phase: 'break'`로 바꾸고, 휴식은 600초에 멈춘다. 독에는 일반 사용자가 임의로 휴식에 들어가는 버튼이 없다. 휴식의 「목표 정하고 공부 이어가기」는 현재 세션을 종료·기록한 뒤 준비 화면으로 이동한다. `FINISH`와 집중 집계도 공부 시간을 목표까지만 인정한다.

- 근거: [reducer.ts:181](../src/features/demo/reducer.ts#L181), [reducer.ts:229](../src/features/demo/reducer.ts#L229), [StudyDock.tsx:46](../src/features/session/components/StudyDock.tsx#L46), [StudyPage.tsx:177](../src/pages/StudyPage.tsx#L177), [StudyPage.tsx:403](../src/pages/StudyPage.tsx#L403).
- 영향: BRK-01, TMR-03, 100% 초과 달성률, 목표 초과 공부 시간, 이후 자유 대화 적립이 함께 달라진다.

### 2. 일시정지가 대화와 반응을 막지 않는다 — P0

타이머 정지·재개와 얼굴 측정 중단은 구현되어 있다. 그러나 채팅 입력 비활성 조건은 베이직 대화 한도이며 일시정지 상태가 아니다. `send`와 `MESSAGE`에도 일시정지 차단이 없고, 진행 중인 LLM 응답도 취소하거나 보류하지 않는다.

- 근거: [StudyPage.tsx:143](../src/pages/StudyPage.tsx#L143), [SessionChatPanel.tsx:54](../src/features/session/components/SessionChatPanel.tsx#L54), [SessionChatPanel.tsx:155](../src/features/session/components/SessionChatPanel.tsx#L155), [reducer.ts:285](../src/features/demo/reducer.ts#L285), [MediaProvider.tsx:32](../src/features/media/MediaProvider.tsx#L32).
- 필요한 변경: 화면 입력과 처리 함수 양쪽에서 상태별 허용 동작을 맞추고, 응답 도착 시 현재 상태를 확인해야 한다.

### 3. LLM 연결은 있으나 말포이의 발화 연출·기록은 별도 구현이 필요하다 — P0

main에 하드코딩/LLM 테스트 토글과 실제 외부 OpenAI 요청 코드가 들어왔다. 따라서 AI 연결이 전혀 없다는 평가는 맞지 않는다. 기본값은 하드코딩 모드이며 실제 API 성공 여부는 이번 검토에서 호출하지 않았다.

현재 캐릭터는 이미지·SVG 표시다. Live2D 대기/입 모션이 없고, 공부 중 LLM 답장은 채팅 패널에만 쌓인다. 공부 화면의 `speech`는 채팅을 열었을 때 꺼지며, 닫았을 때도 LLM의 마지막 답을 연결하지 않는다. 입장 인사·이탈·복귀·목표 달성·버튼 반응을 공통 발화로 기록하는 처리도 없다. 채팅 패널의 인사 문장은 화면에서 직접 렌더링하며 메시지 상태에 저장하지 않는다. 미읽음 표시도 없다.

- 근거: [llm-chat.ts:6](../src/features/session/llm-chat.ts#L6), [openai-chat.ts:71](../server/openai-chat.ts#L71), [StudyPage.tsx:44](../src/pages/StudyPage.tsx#L44), [StudyPage.tsx:341](../src/pages/StudyPage.tsx#L341), [SessionChatPanel.tsx:129](../src/features/session/components/SessionChatPanel.tsx#L129), [CharacterFigure.tsx:20](../src/features/session/components/CharacterFigure.tsx#L20).
- 필요한 변경: 발화 한 건을 말풍선·채팅·입 모션이 같이 소비하도록 묶고, P1에서 표정·고개 움직임, P2에서 음성·립싱크를 추가할 수 있어야 한다.

### 4. 대화 횟수·답 길이·기억 정책이 다르다 — P0

- 현재 베이직은 공부 중/휴식 중 구분 없이 사용자 영업일 기준 3회다. 다른 등급은 대화 횟수 제한이 없다. 명세는 **공부 중 무제한**, **휴식 중 적립한 횟수만 긴 답변**, 소진 후에도 짧은 대화는 가능하도록 요구한다.
- 누적 공부 10분당 1회 적립, 휴식 메시지당 1회 차감, 다음 휴식으로 이월하는 값과 UI가 없다.
- 서버 프롬프트는 공부/휴식 모두 1~2문장·80자 안팎을 요구한다. 휴식 자유 대화의 2~4문장 조건이 없다.
- 프로필 이름과 최근 대화 이력을 전달하는 기반은 있지만, 서버는 최근 12개 메시지만 사용하며 이전 대화 요약은 없다. 세션 전체의 사실을 유지한다고 보장할 수 없다.

근거: [StudyPage.tsx:143](../src/pages/StudyPage.tsx#L143), [reducer.ts:285](../src/features/demo/reducer.ts#L285), [SessionChatPanel.tsx:116](../src/features/session/components/SessionChatPanel.tsx#L116), [openai-chat.ts:19](../server/openai-chat.ts#L19), [openai-chat.ts:54](../server/openai-chat.ts#L54).

### 5. 10초 이탈 판정과 리포트의 집중 시간 정의가 다르다 — P0

MediaPipe 얼굴 감지와 브라우저 내부 처리는 재사용할 수 있다. 다만 `FaceFocusTracker`는 매 샘플의 얼굴 유무를 즉시 적분하고 미감지→감지 전환을 복귀로 센다. **연속 10초**를 확인하는 이탈 상태와, 이탈 확정 시 최초 미감지 시점부터 시간을 소급하는 처리가 없다. 감지 결과를 캐릭터 발화로 연결하지도 않는다.

현재 집중·미감지 시간은 유효한 카메라 관측 구간만 집계한다. 카메라 없이 50분 공부하면 공부는 50분이지만 집중·미감지는 0이 될 수 있다. 이는 명세의 `집중 시간 = 총 공부 시간 − 확정된 이탈 시간`과 다르다. 관측 사이 큰 공백은 기존 집계에서 제외되므로 이 부분도 이벤트 구간 정의와 함께 정해야 한다.

- 근거: [face-focus-tracker.ts:22](../src/features/media/face-focus-tracker.ts#L22), [use-face-focus.ts:35](../src/features/media/use-face-focus.ts#L35), [MediaProvider.tsx:36](../src/features/media/MediaProvider.tsx#L36), [reducer.ts:236](../src/features/demo/reducer.ts#L236).
- 이미 맞는 부분: 카메라 off·일시정지·휴식에는 얼굴 측정이 중단되고, 원본 영상은 이 코드 경로에서 외부 API로 전송하지 않는다.

### 6. 종료 확인과 다음 체험자 초기화가 불완전하다 — P0

main에 추가된 종료 확인은 **상단 로고 클릭**에만 연결되어 있다. 독의 「공부 끝내기」와 휴식의 종료 버튼은 `finish()`를 바로 실행한다. 명세는 일반 종료 버튼에서 확인한 뒤 결과로 이동해야 한다.

종료 후에는 기록을 `records`에 추가하고 이름·메시지를 유지하며, 전체 상태를 localStorage에 저장한다. 리포트의 「홈으로」는 페이지 이동만 한다. 다음 체험자를 위해 리포트 닫기 때 이름·대화·기록을 비우는 기능이 없다. 기존 메뉴의 RESET은 샘플 프로필·샘플 기록을 포함한 초기 데모 상태를 만들며 전용 시연 초기화와 다르다.

또한 LLM 요청에는 취소 신호가 없고 `CHARACTER_REPLY`는 활성 세션과 요청의 세션이 같은지 확인하지 않는다. 따라서 초기화 후 늦은 응답이 이전 세션 메시지로 다시 추가되는 경우를 계산 함수 호출로 확인했다.

- 근거: [StudyPage.tsx:214](../src/pages/StudyPage.tsx#L214), [StudyPage.tsx:247](../src/pages/StudyPage.tsx#L247), [StudyPage.tsx:454](../src/pages/StudyPage.tsx#L454), [reducer.ts:255](../src/features/demo/reducer.ts#L255), [reducer.ts:326](../src/features/demo/reducer.ts#L326), [DemoProvider.tsx:10](../src/features/demo/DemoProvider.tsx#L10), [ReportPage.tsx:64](../src/pages/ReportPage.tsx#L64).
- 필요한 변경: 리포트까지 필요한 결과만 유지하고 닫기/강제 초기화 시 삭제한다. 요청 취소와 세션 식별자 검증도 함께 처리해야 한다.

### 7. 리포트·카드의 데이터와 문구가 다르다 — P0 / P1

리포트 UI, 공부·집중·미감지 시간·복귀 횟수, 목표 표시, 세로형 카드와 PNG 저장은 있다. 다만 다음 요구는 추가/변경이 필요하다.

- 새 기록에는 실제 공부·이탈·휴식 이벤트 타임라인이 없다. 기존 `FocusTimeline`은 고정 비율 샘플이고, 카메라 집계 필드가 있는 새 기록에는 표시하지 않는다.
- 관계는 여러 세션의 공부 시간을 인원수로 배분한 누적 레벨이다. 세션 한정 `+공부 분` 호감도가 아니다.
- 리포트 한마디는 친구별 고정 문구이며 AI 세션 요약이 아니다. 카드도 다른 고정 문장을 사용하므로 한마디를 공유하지 않는다.
- 카드에는 공부·집중 시간과 복귀 횟수, 날짜·이미지·로고가 있으나 선택적 사용자 이름, 달성률, 세션 호감도가 빠져 있다. 말포이 카드 이미지도 연결되어 있지 않다.
- 리포트와 카드가 별도 페이지이며 카드에는 공유 링크와 다음 공부 약속이 남아 있다. 새 MVP에서는 리포트 한 화면 안에서 카드 확인/저장 후 종료하도록 흐름을 줄여야 한다.

근거: [ReportPage.tsx:42](../src/pages/ReportPage.tsx#L42), [ReportPage.tsx:54](../src/pages/ReportPage.tsx#L54), [FocusTimeline.tsx:1](../src/features/reports/components/FocusTimeline.tsx#L1), [selectors.ts:14](../src/features/demo/selectors.ts#L14), [completion-artwork.ts:5](../src/features/reports/completion-artwork.ts#L5), [card-copy.ts:4](../src/features/reports/card-copy.ts#L4), [CapsuleCardPage.tsx:110](../src/pages/CapsuleCardPage.tsx#L110), [export-card.ts:98](../src/features/reports/export-card.ts#L98).

### 8. 시연 운영 단축키가 없다 — P0

현재 C/V/Escape는 화면 조작용이고, 데모 조작은 화면에 보이는 메뉴다. 「휴식 화면 보기」는 목표 10초 전으로 이동하는 대신 목표를 채운 휴식 상태로 즉시 바꾼다. 숨겨진 목표 직전 점프·즉시 종료·전체 초기화 단축키는 없다.

근거: [StudyPage.tsx:53](../src/pages/StudyPage.tsx#L53), [StudyDemoControls.tsx:23](../src/features/session/components/StudyDemoControls.tsx#L23), [reducer.ts:216](../src/features/demo/reducer.ts#L216), [HeaderAccount.tsx:80](../src/app/components/HeaderAccount.tsx#L80).

## 기능명세서 37개 ID별 비교

판정은 코드 구현 기준이다. **일치**는 해당 기능의 기본 동작이 있다는 뜻이며 실제 시연 환경에서의 통합 검증 완료를 뜻하지 않는다. **부분**은 재사용 기반과 미충족 조건이 함께 있는 경우, **상이**는 기존 정책이 새 명세와 다른 경우, **미구현**은 필요한 처리 경로가 없는 경우다.

### 입장 전

| ID / 우선순위 | 판정 | 현재 구현과 차이 | 근거 |
|---|---|---|---|
| ENT-01 / P0 | 부분 | 룸 배너·표지 UI는 있다. 말포이 전용 표지와 단일 입장 화면은 없다. | [룸 데이터](../src/features/rooms/data/rooms.ts#L4), [라우트](../src/app/App.tsx#L27) |
| ENT-02 / P0 | 부분 | 기본 50분·5~180분·5분 단위는 일치한다. 현재는 슬라이더이며 외부 입력값은 자동 보정한다. 잘못된 값 안내와 입장 비활성 흐름은 없다. 입력 방식은 디자이너 재량이므로 슬라이더 자체를 불일치로 판정하지 않았다. | [목표 선택](../src/features/session/components/StudyGoalPicker.tsx#L24), [보정](../src/features/session/study-goal.ts#L1) |
| ENT-03 / P0 | 상이 | 입장 때 선택적으로 받는 이름이 아니라 지속 프로필 이름을 사용한다. 준비 화면에는 시험 일정 유도도 남아 있다. | [이름 전달](../src/pages/StudyPage.tsx#L160), [시험 입력 유도](../src/pages/PreparePage.tsx#L126) |
| ENT-04 / P0 | 부분 | 실제 권한 요청과 카메라 없이 진행하는 경로는 있다. 입장 버튼에서 요청하는 단일 흐름이 아니며 음성 미구현 상태에서도 마이크를 요청한다. | [준비 단계](../src/pages/PreparePage.tsx#L108), [기기 요청](../src/features/media/device-controller.ts#L80) |

### 스터디룸

| ID / 우선순위 | 판정 | 현재 구현과 차이 | 근거 |
|---|---|---|---|
| ROOM-01 / P0 | 부분 | 1:1 룸·확대·작은 내 화면의 배치 기반이 있다. 여러 친구 그리드/확대 모드 중심이며 말포이 고정·실제 캠 기본 표시가 아니다. | [공부 배치](../src/pages/StudyPage.tsx#L302), [내 화면 기본값](../src/pages/StudyPage.tsx#L42) |
| ROOM-02 / P0 | 미구현 | 이미지·SVG 캐릭터다. Live2D 대기/말하기 모션, 문장 길이에 비례한 입 뻐끔 처리가 없다. | [캐릭터 표시](../src/features/session/components/CharacterFigure.tsx#L20) |
| ROOM-03 / P0 | 미구현 | 채팅 패널을 열면 나오는 일반 인사는 있다. 입장 직후 이름을 반영해 자동 발화하는 이벤트가 없다. | [패널 인사](../src/features/session/components/SessionChatPanel.tsx#L129) |
| ROOM-04 / P1 | 미구현 | AI 표정 태그, 표정 3종·고개 움직임 제어가 없다. 수동 반응 단계·이미지 교체는 별개 기능이다. | [응답 형식](../server/openai-chat.ts#L95), [수동 반응](../src/pages/StudyPage.tsx#L262) |
| TMR-01 / P0 | 일치(기본) | 공부 타이머는 0부터 경과/목표를 표시하고 일시정지한다. 목표 이후 누적·휴식 정책의 차이는 TMR-03/BRK-01에 해당한다. | [시작 값](../src/features/demo/reducer.ts#L151), [표시](../src/features/session/components/SessionTimer.tsx#L4) |
| TMR-02 / P0 | 부분 | 타이머와 얼굴 측정은 멈춘다. 채팅 입력·메시지 처리·진행 중 답장은 정지 상태로 차단하지 않는다. | [정지](../src/features/demo/reducer.ts#L205), [입력 조건](../src/features/session/components/SessionChatPanel.tsx#L155) |
| TMR-03 / P0 | 상이 | 목표 도달 시 한 번 뜨는 계속/종료 팝업이 없다. 자동으로 10분 휴식에 들어가며 목표 초과 누적이 제한된다. | [목표 전환](../src/features/demo/reducer.ts#L181), [종료 집계](../src/features/demo/reducer.ts#L229) |
| TMR-04 / P0 | 부분 | 종료와 리포트 이동은 있다. 상단 로고에만 확인창이 있고 독·휴식 종료는 즉시 처리한다. 종료 전 캐릭터 대사도 없다. | [독 종료](../src/pages/StudyPage.tsx#L214), [확인창](../src/pages/StudyPage.tsx#L454) |
| CAM-01 / P0 | 부분 | 실제 카메라 on/off·꺼졌을 때 감지 중단은 있다. 꺼진 자리에는 빈 화면+이름 대신 꾸미기 SVG 아바타를 표시한다. | [카메라 토글](../src/pages/StudyPage.tsx#L187), [내 화면](../src/features/session/components/StudySelfView.tsx#L12) |
| AVA-01 / P1 | 미구현 | 캠/정적 SVG 아바타 전환과 가상 배경은 있다. 얼굴 움직임을 따라 하는 Live2D 샘플 아바타가 아니다. 얼굴 작업자도 현재 얼굴 수·박스만 전달한다. | [내 화면](../src/features/session/components/StudySelfView.tsx#L12), [감지 결과](../src/features/media/vision.worker.ts#L42) |
| CHAT-01 / P0 | 부분 | 우측 패널·사용자/답장 이력은 있다. 자동 발화·버튼 반응 전체 로그와 닫힌 패널의 새 메시지 표시는 없다. | [패널](../src/features/session/components/SessionChatPanel.tsx#L98), [발화 조건](../src/pages/StudyPage.tsx#L341) |
| CHAT-02 / P0 | 부분 | 텍스트 전송·하드코딩/LLM 답장·패널 타이핑은 있다. 입 모션+말풍선 동시 출력, 공부 중 무제한, 휴식 2~4문장은 충족하지 않는다. | [전송](../src/pages/StudyPage.tsx#L143), [답 길이](../server/openai-chat.ts#L64) |
| VOICE-01 / P2 | 미구현 | 마이크 연결·음량계는 있다. 음성 버튼은 고정 샘플 문장을 보내며 누르고 녹음/STT/TTS/립싱크는 없다. | [샘플 음성 버튼](../src/features/session/components/ChatComposer.tsx#L59) |
| VOICE-02 / P2 | 미구현 | 실제 음성 인식과 짧은 녹음/빈 인식 결과의 전용 실패 대사 처리가 없다. | [샘플 음성 버튼](../src/features/session/components/ChatComposer.tsx#L59) |
| VOICE-03 / P2 | 미구현 | 음성 재생·누르고 말하기가 없어 말 끊기/재생 중단도 없다. | [입력](../src/features/session/components/ChatComposer.tsx#L58) |
| BUB-01 / P0 | 부분 | 텍스트 말풍선 UI는 있다. AI 답과 동기화, 이미지 말풍선, 2줄 제한, 입 모션 종료 3초 후 숨김이 없다. | [말풍선](../src/features/session/components/CharacterTile.tsx#L65), [말풍선 선택](../src/pages/StudyPage.tsx#L341) |
| PRO-01 / P0 | 미구현 | 입장·10초 이탈/복귀·목표 달성의 자동 발화와 발화 중 대기열, 버튼 반응 대사 2종 교대가 없다. 수동 데모 대사는 자동 이벤트와 연결되어 있지 않다. | [데모 반응](../src/pages/StudyPage.tsx#L262), [얼굴 집계](../src/features/media/use-face-focus.ts#L47) |
| MEM-01 / P0 | 부분 | 이름과 최근 이력은 LLM에 보낸다. 최근 12개 제한에 대한 요약이 없고 이름·대화는 세션 종료 후에도 localStorage에 남는다. | [이력 전달](../src/pages/StudyPage.tsx#L152), [이력 제한](../server/openai-chat.ts#L19), [저장](../src/features/demo/DemoProvider.tsx#L10) |
| SAFE-01 / P0 | 미구현 | 현재 시스템 프롬프트에 말포이 전용 금지 주제·캐릭터식 거절 정책이 없다. 제공자의 기본 동작만으로 명세 충족을 인정하지 않았다. 별도 설정 문서 미첨부로 구체 목록 대조는 불가하다. | [프롬프트](../server/openai-chat.ts#L54) |
| AWAY-01 / P0 | 상이 | 얼굴 유무 즉시 집계와 짧은 미감지→감지 복귀 카운트다. 10초 확정·소급 이탈 시간·자동 대사·발화 대기열이 없다. | [감지 집계](../src/features/media/face-focus-tracker.ts#L22) |
| BRK-01 / P0 | 상이 | 목표 후 자동 10분 휴식이다. 원할 때 진입·무제한 휴식·같은 세션 다시 공부하기가 없다. | [자동 휴식](../src/features/demo/reducer.ts#L181), [휴식 버튼](../src/pages/StudyPage.tsx#L403) |
| BRK-02 / P0 | 미구현 | 누적 10분당 적립·메시지당 차감·이월·남은 횟수·소진 후 짧은 답이 없다. 현재 일일 베이직 3회와 다른 정책이다. | [대화 사용량](../src/features/demo/reducer.ts#L285), [사용량 타입](../src/features/demo/types.ts#L103) |
| AFF-01 / P1 | 상이 | 여러 세션의 참여 비율 기반 누적 관계 레벨이다. 이번 세션 공부 분만큼 +1인 호감도가 아니다. | [관계 계산](../src/features/demo/selectors.ts#L14) |
| LAT-01 / P0 | 부분 | 요청 중 「입력 중…」과 오류 문구는 있다. 5초 안내·생각 모션·자동 타임아웃·캐릭터 실패 대사·채팅 기록은 없다. | [대기/오류](../src/features/session/components/SessionChatPanel.tsx#L145), [요청](../src/features/session/llm-chat.ts#L6) |

### 리포트

| ID / 우선순위 | 판정 | 현재 구현과 차이 | 근거 |
|---|---|---|---|
| RPT-01 / P0 | 부분 | 공부·집중·미감지·복귀·목표 UI는 있다. 집중/이탈 정의, 목표 초과 시간·달성률, 세션 호감도가 다르다. | [리포트](../src/pages/ReportPage.tsx#L53), [집계](../src/features/demo/reducer.ts#L229) |
| RPT-02 / P1 | 부분 | 고정 비율 샘플 타임라인만 있으며 새 카메라 기록에는 숨긴다. 실제 공부/확정 이탈/휴식 구간 이벤트를 저장하지 않는다. | [표시 조건](../src/pages/ReportPage.tsx#L60), [샘플 비율](../src/features/reports/components/FocusTimeline.tsx#L1) |
| RPT-03 / P0 | 미구현 | 친구별 고정 한마디다. 지표·세션 대화로 만드는 AI 요약, 지연/실패 시 달성 여부별 대체 문장, 카드와 같은 요약 사용이 없다. | [고정 문구](../src/features/reports/completion-artwork.ts#L5), [카드 문구](../src/features/reports/card-copy.ts#L4) |
| RPT-04 / P0 | 부분 | 세로 카드·날짜·이미지·로고·공부/집중 시간은 있다. 말포이 아트·선택적 사용자 이름·달성률·세션 호감도·공유 요약문이 필요하다. 별도 페이지도 리포트 흐름에 합쳐야 한다. | [카드 화면](../src/pages/CapsuleCardPage.tsx#L110), [PNG 그리기](../src/features/reports/export-card.ts#L98) |
| RPT-05 / P1 | 일치(기본) | Canvas를 PNG Blob으로 만들고 다운로드한다. 말포이 카드 데이터·아트 교체와 실제 Chrome 저장 시연은 별도 검증이 필요하다. | [PNG 생성/다운로드](../src/features/reports/export-card.ts#L110) |
| RPT-06 / P0 | 상이 | 홈 이동만 하고 기록·이름·대화를 유지한다. 빈 상태의 단일 입장 화면 복귀와 데이터 삭제가 없다. | [홈으로](../src/pages/ReportPage.tsx#L64), [상태 저장](../src/features/demo/DemoProvider.tsx#L10) |

### 운영

| ID / 우선순위 | 판정 | 현재 구현과 차이 | 근거 |
|---|---|---|---|
| OPS-01 / P0 | 상이 | 보이는 「휴식 화면 보기」가 목표를 채운 휴식 상태로 직행한다. 숨겨진 목표 10초 전 점프와 정상 목표 팝업 경로가 없다. | [메뉴](../src/features/session/components/StudyDemoControls.tsx#L37), [점프 처리](../src/features/demo/reducer.ts#L216) |
| OPS-02 / P0 | 미구현 | 즉시 종료하는 함수는 있지만 시연용 숨겨진 키 조합이 없다. | [키 처리](../src/pages/StudyPage.tsx#L53), [종료 함수](../src/pages/StudyPage.tsx#L177) |
| OPS-03 / P0 | 미구현 | 일반 메뉴의 초기화는 있다. 모든 화면에서 동작하며 요청·재생까지 멈추는 숨겨진 세션 초기화 단축키는 없다. | [초기화 메뉴](../src/app/components/HeaderAccount.tsx#L80), [LLM 처리](../src/pages/StudyPage.tsx#L152) |

## 새 MVP 범위에서 분리할 기존 화면·기능

| 기존 구현 | 11/1 문서 기준 |
|---|---|
| 로그인·회원가입·온보딩·홈·룸 목록/상세 | 단일 입장 화면으로 접근. 현재 [RequireDemo](../src/app/layouts/RequireDemo.tsx#L4)는 로그인 플래그가 없으면 로그인 페이지로 보낸다. |
| 여러 룸·친구·1:3 그리드·확대/상대 선택 | 말포이 1:1 고정. 배치 공통 컴포넌트는 재사용 가능하다. |
| 프로필·내 아바타 꾸미기 | 선택적 세션 이름과 실제 캠이 기본. Live2D 샘플 내 아바타는 P1이다. |
| 시험/목표/약속·마이페이지 일정 | 입장에서는 이름만 받으며 시험 정보는 받지 않는다. |
| 크레딧·패스·대화 등급·업그레이드·선물/보이스 구매 | 시연 동선에서는 제외. 공부 대화와 휴식 자유 대화 정책으로 대체한다. |
| 반응 3단계 데모·「아니야」 | 10초 얼굴 미감지/복귀 이벤트로 대체한다. P1 표정 3종과는 다른 개념이다. |
| 누적 기록·관계/해금·이어하기 | 세션 한정 지표와 호감도. 리포트 닫기 뒤 다음 체험자에게 남기지 않는다. |
| 카드 공유 링크·스토리 공유·다음 약속 | 리포트의 카드 확인·PNG 저장으로 줄인다. |
| 가상 배경 | main에서 추가된 실제 기능이지만 이번 MVP 필수 요구는 아니다. Live2D 아바타의 대체 구현으로 계산하지 않는다. |

기존 서비스 구현을 유지하면서 시연용 진입 동선과 세션 상태를 분리하면 범위를 관리하기 쉽다. 이번 검토에서는 기능을 제거하거나 동선을 바꾸지 않았다.

## 비기능 요구사항

| 요구 | 현재 확인 결과 |
|---|---|
| 로컬 노트북 실행·외부 LLM 연결 | Vite 개발/미리보기 서버에 채팅 처리기가 있다. 실제 모델 추론은 브라우저 내 로컬 LLM이 아니라 외부 OpenAI 호출이다. API 키는 서버 측 환경값을 사용한다. [vite.config.ts](../vite.config.ts#L8), [openai-chat.ts](../server/openai-chat.ts#L78). |
| 인터넷 단절 시 캐릭터 대사로 대체 | 수동 하드코딩 모드는 있다. LLM 오류를 자동으로 캐릭터 실패 대사/요약 대체 문장에 연결하지는 않는다. |
| 5초 응답 지연 안내·세션당 비용 상한 | 현재 요청에 5초 안내 타이머·취소/타임아웃이 없고 세션별 토큰/비용 예산도 없다. |
| 캠 영상 저장·외부 전송 금지 | 얼굴 감지는 브라우저 Worker에서 처리하며 이 경로에 영상 업로드는 없다. 로컬 PNG 카드는 사용자 캠이 아닌 캐릭터 이미지를 그린다. |
| 이름·대화·기록의 세션 한정 사용 | localStorage 지속 저장과 리포트 닫기 후 미삭제로 불일치한다. 서버 자체의 외부 서비스 보관 정책은 이번 코드 검토로 검증하지 않았다. |
| 입장 화면의 영상 비저장 안내 | 현재 별도 준비 화면의 물음표 안내 중심이다. 새 단일 입장 화면의 표시 요구를 반영해야 한다. |
| Live2D 1~2개+웹캠+얼굴 감지 성능·최대 3시간 | Live2D가 없어 해당 조합을 검증할 수 없다. 첨부 PRD의 58.5fps를 이 코드의 측정치로 재사용하지 않았다. |

## 확인한 재현 결과

프로젝트 소스는 바꾸지 않고 `/private/tmp/capsule-mvp-review-20261101/behavior-probe.ts`에서 현재 reducer와 얼굴 집계 함수를 불러 검증했다. 아래 값은 실제 사용자 세션·카메라·외부 LLM을 사용하지 않은 결정적 함수 호출 결과다.

| 확인 | 현재 결과 | 명세와의 차이 |
|---|---|---|
| 50분 목표에서 타이머 도달 | `phase='break'`, 공부 3,000초 | 목표 달성 팝업 대신 자동 휴식 |
| 이후 11분 경과 | 휴식 600초, 정지 상태 | 무제한 휴식과 다름 |
| 일시정지 후 메시지 전송 | 사용자+샘플 답장 2건 추가, 타이머는 정지 유지 | 정지 중 대화 입력/처리 금지와 다름 |
| 목표 50분, 타이머 tick 없이 75분에 종료 | 기록 공부 3,000초 | 목표 초과 시간 누적·150% 달성률 불가 |
| 종료 후 상태 | 기록 1건·메시지 2건·프로필 이름 유지 | 리포트 이후 정리 경로가 별도로 필요 |
| RESET 뒤 이전 세션의 늦은 LLM 답장 액션 | 활성 세션이 없어도 이전 세션 메시지 1건 추가 | 초기화 후 이전 데이터가 재유입되지 않도록 차단 필요 |
| 얼굴이 0.6초 안 보이다 복귀 | 미감지 600ms·복귀 1회 | 연속 10초 미만은 확정 이탈/복귀로 세지 않아야 함 |
| 목표 값 47 / 0 / 999 | 45 / 5 / 180으로 보정 | 잘못된 입력에 안내·입장 비활성하는 정책과 다름. 현재 슬라이더는 UI에서 이런 값을 만들지 않음 |

## 구현 우선순위 제안

기능명세의 우선순위를 그대로 적용한 작업 순서다. 새 기능 구현은 이번 작업 범위에 포함하지 않았다.

1. **P0 세션 골격**: 말포이 단일 입장·선택적 이름·권한 거절 허용, 공부/정지/휴식/목표 팝업/리포트의 전이와 데이터 생명주기를 먼저 정한다.
2. **P0 채팅+Live2D 입 모션**: 현재 LLM 연결에 말포이 설정·상태별 답 길이·공통 발화 기록·말풍선·입 모션을 연결한다. 지연 안내·실패 대체·요청 취소도 포함한다.
3. **P0 이탈·휴식 대화**: 10초 확정/소급 이탈·복귀, 누적 10분당 자유 대화 적립·소진 후 짧은 답·잔여 횟수 이월을 구현한다.
4. **P0 마무리·운영**: 종료 확인, 같은 요약문을 쓰는 리포트/카드, 확정 지표, 다음 체험자 초기화와 세 가지 운영 단축키를 연결한다.
5. **P1**: 표정 3종·고개 움직임, Live2D 샘플 내 아바타, 세션 호감도, 실제 이벤트 타임라인, 말포이 카드 PNG 저장 시연을 보완한다. PNG 저장 기초 코드는 이미 있다.
6. **P2**: P0·P1 안정화 후 누르고 말하기·음성 인식 실패·TTS·립싱크·말 끊기를 붙인다. 마이크 권한과 음성 관련 UI도 이 단계에 맞춘다.

말포이의 최종 대사·금지 주제·표정 확정, 실제 사용할 Live2D/카드 아트, 키 조합과 일부 기준 시간·API 서비스·비용 상한은 첨부 문서에서 별도 자료 또는 미정으로 남아 있다. 검토 과정에서 임의로 확정하지 않았다.

## 검증 범위와 한계

- `npm test`: **92개 통과, 실패 0**.
- `npm run lint`: 통과.
- `npm run build`: TypeScript와 Vite 빌드 통과.
- main이 HEAD의 조상이며 `HEAD...origin/main` 커밋 차이가 `0 / 0`임을 확인했다.
- 작성 중이던 `src/assets/README.md`는 병합 전후 내용 해시가 같다.
- 기존 테스트 통과는 새 MVP 명세 충족을 의미하지 않는다. 기존 테스트는 자동 휴식과 목표 상한 등 현재 정책도 검증한다. 위 재현은 그 정책 차이를 확인한 것이다.
- 실제 외부 LLM 호출, 실제 웹캠/권한 팝업, Live2D 실행, Chrome의 카드 다운로드, 최대 3시간 세션·프레임 성능은 이번 검토에서 통합 실측하지 않았다.
- 검토 문서는 기존 `.gitignore`의 `docs/*` 규칙에 따라 추적되지 않는다. 추적 정책과 원격 브랜치는 변경하지 않았다.

## Figma 반영

같은 페이지 「생성 에셋 관리 + 새로운 와이어프레임」에 현재 구현과 변경 요구를 구분해 반영했다. [최신 목차](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1122-7722), [WF H · 현재 구현 21개 상태와 화면별 수정 메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1194-10658), [WF I · MVP 구현·연동 기준과 37기능 대조표](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10839)를 함께 본다.

주황은 MVP 변경, 파랑은 프론트 작업, 보라는 백엔드 연동, 노랑은 공통 정책, 초록은 완료 조건이다. 과거 A–G는 이력으로 표시했고 생성 에셋 갤러리는 유지했다. API 경로를 임의로 정하지 않았다. 상세 기록과 노드 목록은 [Figma 작업 기록](./FIGMA_MVP_HANDOFF_2026-11-01.md)에 있다.
