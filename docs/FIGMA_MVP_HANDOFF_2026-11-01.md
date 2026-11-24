# Figma MVP 작업 기준 · 2026-11-01

현재 프론트 소스 `85debe6`와 첨부 기능명세서·PRD의 11/1 2차 수정 사항을 대조한 Figma 작업 기록이다. 배포 사이트와 이 커밋이 같다고 가정하지 않았다. 제품 코드를 MVP로 변경한 작업은 아니다.

[최신 목차](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1122-7722) · [WF H · 현재 구현과 수정 메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1194-10658) · [WF I · MVP 상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10839) · [37개 기능 대조표](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-11097)

## 읽는 방법

- 회색: 현재 구현. UI는 원래 H의 편집 가능한 로우파이 구조이며 이미지·일부 숫자는 자리 표시자다.
- 주황: 11/7 MVP에 맞춰 변경할 동작. 이미 구현됐다는 뜻이 아니다.
- 파랑: 프론트 작업.
- 보라: 백엔드 연동·논의.
- 노랑: 공통 정책·미정 사항.
- 초록: 완료 확인 조건.

H의 기존 화면 16개와 ID를 유지하고 현재 코드 상태 5개를 추가했다. 화면 제목은 목차, 변경 메모의 제목·변경 블록은 관련 I 상세 기준으로 연결했다. 실제 현재 화면의 주요 버튼에도 상태 간 연결을 추가했다. 새 MVP UI를 구현된 화면인 것처럼 그리지 않았다.

A–G와 10/29 설명은 이력 표시 후 아래로 옮겼다. 생성 에셋 갤러리와 기존 화면 원본, 기존 prototype 목적지 ID는 유지했다. 기존 Pretendard UI를 다른 폰트로 바꾸지 않았다. H와 새 설명은 H의 기존 Noto Sans KR를 따른다.

## 구현 방향

단일 입장(SCR-01) → 말포이 1:1 공부(SCR-02, 정지·휴식·목표 팝업 포함) → 리포트+카드(SCR-03) → 닫기 후 빈 입장이다. 기존 로그인·홈·여러 룸·누적 기록/관계·일정·결제는 서비스 이력으로 보존하되 시연 동선에서 분리한다.

P0 채팅·Live2D 대기/입 모션과 세션/이탈/휴식/리포트/초기화부터 완성한다. P1은 표정 3종·고개 움직임, Live2D 샘플 내 아바타, 세션 호감도, 실제 타임라인, PNG 저장이다. P2는 누르고 말하기·STT/TTS·립싱크다. 몸 자세 변화와 추가 에피소드는 제외한다.

## 현재 화면과 변경 메모

| WF | 현재 화면 | MVP 구분 | 연결 |
|---|---|---|---|
| H01 | 로그인 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1194-10667) |
| H02 | 내 아바타 만들기 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1194-10712) |
| H03 | 홈 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1202-10658) |
| H04 | 스터디룸 상세 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1201-10658) |
| H05 | 카메라·마이크 확인 | P0 변경 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1203-10658) |
| H06 | 목표·대화 옵션 | P0 변경 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1203-10712) |
| H07 | 공부 화면 | P0 변경 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1203-10780) |
| H08 | 휴식+대화 패널 | P0 변경 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1204-10658) |
| H09 | 종료 리포트 | P0 변경 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1204-10749) |
| H10 | 캡슐 카드 | P0/P1 변경 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1204-10807) |
| H11 | 내 기록 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1205-10658) |
| H12 | 친구·관계 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1205-10783) |
| H13 | 선물·보이스 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1206-10658) |
| H14 | 마이페이지·일정 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1206-10752) |
| H15 | 내 크레딧 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1207-10658) |
| H16 | 충전·패스 결제 | 제외 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1207-10758) |
| H17 | 로고 클릭 종료 확인 · 현재 구현 | P0 변경·상태 보완 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1263-11026) |
| H18 | 기존 세션 이어하기 확인 · 현재 구현 | P0 변경·상태 보완 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1263-11125) |
| H19 | 일시정지 · 현재 구현 | P0 변경·상태 보완 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1263-11222) |
| H20 | 공부 중 LLM 채팅 · 현재 구현 | P0 변경·상태 보완 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1263-11314) |
| H21 | 독의 캠 배경 선택 · 현재 구현 | P0 변경·상태 보완 | [화면+메모](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1263-11441) |

## 상세 작업 기준

| 기준 | 내용 | 연결 |
|---|---|---|
| I01 | 세 화면과 범위 · 구현 순서 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10847) |
| I02 | SCR-01 · 입장과 권한 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10872) |
| I03 | SCR-02 · 상태 전이와 타이머 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10897) |
| I04 | 발화 한 건 · 채팅·입 모션·말풍선 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10922) |
| I05 | 10초 이탈 · 시간과 복귀 집계 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10947) |
| I06 | 자유 대화 횟수 · 상태별 답 길이 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10972) |
| I07 | SCR-03 · 지표·요약·카드 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-10997) |
| I08 | 수명·초기화·숨겨진 운영 조작 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-11022) |
| I09 | P1 표정·내 아바타 / P2 음성 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-11047) |
| I10 | 연동 논의 · 검증과 완료 조건 | [상세 기준](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-11072) |
| I11 | 기능명세서 37개 기능의 현재 판정·우선순위·관련 WF | [대조표](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=1264-11097) |

각 상세 기준은 현재 차이, 프론트 작업, 백엔드 연동, 공통 정책 및 완료 조건을 담는다. 전체 주석 원문과 Figma 노드는 [JSON 기록](./FIGMA_MVP_HANDOFF_2026-11-01.json)에 있다. 코드 근거와 상태 함수 재현은 [구현 비교 검토](./MVP_PRD_IMPLEMENTATION_REVIEW_2026-11-01.md)에 있다.

## API 설계와 미정 사항

새 HTTP 메서드·API 주소·필드명·DB 자원을 임의로 확정하지 않았다. `/api/chat`은 이미 현재 코드에 있는 LLM 경로임을 명시했으며 향후 계약 제안이 아니다. 기존 H 메모의 추정 세션/통계 API 주소와 오래된 MVP 집중률 설명을 제거했다.

필요한 세션 문맥·발화 결과·요약 지표를 업무 단위로 적고, 문맥 보관 수명·취소·실패/재시도·중복 차감·비용 상한은 FE/BE 합의 사항으로 표시했다.

- TS말포이 캐릭터 설정·최종 대사·금지 주제 문서 미첨부
- 실제 Live2D/카드 아트 연결·샘플 모델·표정 3종
- 이름 최대 길이·입 모션 시간 기준·타임아웃·운영 키 조합·P2 키/녹음 최소 길이
- 세션 AI 비용 상한·재시도/실패 때 중복 차감 방지 기준
- 실제 LLM·웹캠·Live2D·Chrome PNG 저장·3시간 부하 리허설

## 확인 결과

- 기본 화면 16개 + 추가 상태 5개 = 21개 현재 WF.
- 기능명세서 37개 ID가 모두 상세 기준·대조표에 존재.
- 최신 목차/H/I의 165개 연결에 잘못된 prototype 목적지 없음.
- 상위 영역·H 화면·I 상세 기준의 겹침 없음, 설명 auto-layout 넘침 없음.
- H 편집 가능한 TEXT 1223개, I TEXT 220개. 전체 UI 스크린샷을 이미지로 붙인 결과물이 아니다.
- H07(현재 공부+수정 메모), I05(10초 이탈 기준), H17(로고 종료 확인), H20(공부 중 LLM 채팅) 스크린샷으로 가독성 확인. H20은 좁아진 타일에 대각선·중앙 콘텐츠를 맞춘 뒤 재확인했다.
- 생성 에셋 갤러리 위치·크기 유지.
- 제품 소스 수정 없음. 작성 중이던 `src/assets/README.md` 해시 유지.
- 기존 92개 테스트·lint·build 통과는 앞선 main 병합 검증 결과이며 새 MVP 충족 판정이 아니다. Figma/문서 작업 때문에 제품 검사를 불필요하게 다시 실행하지 않았다.

이 문서 및 JSON은 기존 `docs/*` ignore 정책에 따라 자동 추적되지 않는다. git 추적 정책과 원격 브랜치를 변경하거나 push하지 않았다.

