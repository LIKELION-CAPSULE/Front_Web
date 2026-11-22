# MVP 제한 해제와 더미 데이터 교체 안내

기준일: **2026-11-22 (Asia/Seoul)**. MVP의 메뉴·주소·블러·친구·목표 시간 제한을 해제했다. 내 기록, 친구, 크레딧, 충전, 모든 로컬 룸, 친구 선택과 그룹 공부, 대화 등급 선택·변경, 해당 공부의 리포트·캡슐 카드를 사용할 수 있다. 목표는 기본 50분, 5~180분의 5분 단위이며 선택값을 시작 요청·타이머·리포트에 반영한다. 과거 3분 세션은 계속 읽을 수 있다.

2026-11-09에 [현재 공개 OpenAPI](https://backendlab-production-3052.up.railway.app/v3/api-docs)를 읽어 24개 경로·27개 작업을 확인했다. 11월 5일 스냅샷 이후 메시지 스트림 경로가 추가됐고, 기존 DTO 스키마 변경은 없었다. 크레딧·상품·결제·선물·누적 기록 목록·해금 콘텐츠 API는 없고, `StartRequest`는 단일 `characterId`만 받으며 대화 등급 필드가 없다. 아래 항목은 임의의 서버 경로를 호출하지 않고 기존 로컬 콘텐츠와 상태 처리로 보완한다. 실제 계정으로 결제하거나 공부 데이터를 생성하는 검증은 수행하지 않았다.

## 바로 찾는 방법

```bash
rg -n 'DUMMY_API' src
rg -n 'DummyNotice|dataSource' src
```

`DUMMY_API:<이름>`은 교체할 데이터 또는 처리 경계다. `DummyNotice`는 사용자에게 보여 주는 체험 안내이고, `StudyRecord.dataSource === 'dummy'`는 샘플/로컬 공부 기록을 구별한다. `serverRoom`, `serverCharacter`, `activeSession.serverSession`은 서버 연결 여부를 구별한다. 이 폴더의 문서는 Git 추적 대상이며, `docs/*`의 기존 로컬 전용 API 문서 정책과 별도로 남긴다.

## 더미 항목과 교체 위치

| 검색 표식 | 현재 더미 값·동작 | 주요 파일·교체 지점 | 실제 연동 시 필요한 계약 |
|---|---|---|---|
| `DUMMY_API:catalog` | 기존 9개 룸·19명 친구의 이름·소개·이미지. 서버에 있는 룸/친구는 실제 ID와 관계 정보를 유지하고, 누락된 로컬 콘텐츠만 추가한다. 기존 로컬 룸 주소도 서버 룸에 연결한다 | [catalog.ts](catalog.ts)의 `mergeRoomCatalog`, [room-service.ts](../rooms/services/room-service.ts), [rooms.ts](../rooms/data/rooms.ts) | 전체 룸·친구의 실제 ID와 메타데이터. 이미 제공되는 콘텐츠는 이름/`artworkId`로 중복 없이 우선 반영 |
| `DUMMY_API:wallet` | 계정당 첫 사용 시 **5,000 체험 크레딧**, 지급 내역 1건, 패스 없음. 사용·충전·등급 변경으로 로컬 잔액과 내역 갱신 | [state.ts](state.ts)의 `createDummyState`, [reducer.ts](../demo/reducer.ts)의 `transaction`, `tierCost` | 잔액·원장·패스 조회/정산 API와 서버의 중복 처리 방지 키 |
| `DUMMY_API:payments` | 크레딧 상품 4종과 패스 2종. 선택한 카드/카카오페이/토스페이는 화면상의 값이며 결제사 호출 없음. 영수증도 체험용 | [catalog.ts](../demo/catalog.ts)의 `chargeProducts`, [ChargePage.tsx](../../pages/ChargePage.tsx), reducer의 `PURCHASE` | 상품/가격 조회, 결제 생성·승인·취소, 지급 완료 확인과 실제 영수증 |
| `DUMMY_API:tier` | 베이직/스탠다드/프리미엄/스페셜 **0/200/500/1,000**. 시작 시 체험 차감, 올릴 때 차액 차감. 유효한 패스는 스탠다드 무료·프리미엄 하루 1회 무료(한국 기준 오전 5시 갱신). 실제 AI 모델·보이스·모션은 등급별로 바뀌지 않음 | [catalog.ts](../demo/catalog.ts)의 `tiers`, [DemoProvider.tsx](../demo/DemoProvider.tsx)의 `startSession`, [UpgradePanel.tsx](../session/components/UpgradePanel.tsx), reducer의 `START`/`UPGRADE` | 시작/등급 변경의 tier·가격·패스 적용과 실제 모델·음성 라우팅 계약. 실제 시작 실패 시 로컬 차감도 없음 |
| `DUMMY_API:session` | 서버에 없는 룸/친구 또는 2명 이상 선택은 전체 세션을 로컬 시뮬레이션. `session-<시각>` ID. 선택 친구·시간·등급을 보존하고 휴식·재개·종료·리포트·카드까지 동작 | [DemoProvider.tsx](../demo/DemoProvider.tsx)의 `startSession`, `resumeSession`, `finishSession`, [state.ts](state.ts)의 `finishDummySession` | 그룹 세션 시작/재개/종료와 참가자별 정산. 서버에 있는 룸+단일 서버 친구는 기존 실제 API 사용 |
| `DUMMY_API:chat` / `DUMMY_API:reactions` | 로컬 세션의 채팅은 졸림·시험·어려움 등 키워드에 따른 고정 답변. 자리 비움/복귀/휴식/동작은 샘플 대사. 로컬에서도 실제 타이머·카메라 관측과 `PresenceClock`을 사용하며 이벤트·heartbeat·대화·종료 요청을 서버에 보내지 않음 | [DemoProvider.tsx](../demo/DemoProvider.tsx)의 `sendMessage`, reducer의 `MESSAGE`, [use-session-sync.ts](../backend/use-session-sync.ts), [StudyPage.tsx](../../pages/StudyPage.tsx)의 `onDummyReaction` | 모든 선택 친구의 실제 메시지·반응 API와 그룹 응답 계약 |
| `DUMMY_API:history` | 최근 30일 샘플 공부 기록(`sample-v3-*`)을 처음에 생성. 이 브라우저에서 완료한 실제 서버 리포트와 로컬 공부도 함께 저장·표시. 실제 서버 리포트 수치를 샘플로 덮어쓰지 않음 | [state.ts](state.ts)의 `createDummyState`, `alignDummyState`, [sample-records.ts](../demo/sample-records.ts), [RecordsPage.tsx](../../pages/RecordsPage.tsx) | 누적/기간별 기록 목록·통계·페이지네이션. 도입 시 샘플 기록 제거와 실제 서버 기록의 ID 기반 병합 필요 |
| `DUMMY_API:affection` | **서버에 없는 친구만 50점**. 임의 상호작용 가산 없음. 서버 친구는 응답의 관계·호감도 사용 | [state.ts](state.ts)의 `alignDummyState`, [CharacterCard.tsx](../characters/components/CharacterCard.tsx), 친구/공부/리포트 화면 | 누락된 친구의 실제 관계 초기값·변경 결과 |
| `DUMMY_API:levels` / `DUMMY_API:unlocks` | 로컬 친구 공부 레벨은 600분 단위 Lv.1~5, 그룹 시간은 인원별 배분. 해금 콘텐츠 6종은 기존 샘플 목록과 첫 공부 완료 조건을 사용하며, 스토리·배경·이벤트 등 미정 조건은 별도 표시. 서버 친구의 카드·관계 화면은 실제 레벨 사용 | [selectors.ts](../demo/selectors.ts), [unlocks.ts](../characters/unlocks.ts) | 레벨 기준·진행률·콘텐츠 목록·해금 조건/시각. 미정 콘텐츠는 MVP 메뉴 잠금과 다른 기존 성장 조건 |
| `DUMMY_API:model` | 서버 응답에 `modelJsonUrl`이 없으면 기존 이미지로 표시. 서버 세션의 시간·대화·정산은 계속 실제 API 사용. URL이 제공됐는데 로드가 실패한 경우는 기존 재시도 오류 유지 | [DemoProvider.tsx](../demo/DemoProvider.tsx)의 `installSession`, [CharacterTile.tsx](../session/components/CharacterTile.tsx) | 친구별 유효한 모델 URL·배치 정보 |

선물·보이스 보내기 화면과 경로는 제거했다. 기존 저장 데이터와 테스트 호환을 위해 선물 카탈로그·`GIFT` 처리·저장 필드는 유지한다.

## 저장과 복구

- 키: `capsule-dummy:v1:<userId>`. 서버 `/me`에서 확인한 계정 ID별로 저장한다. 기존 `capsule-wireframe-demo:v1`의 가짜 로그인·프로필은 불러오지 않는다.
- 저장 필드: 크레딧·내역·패스·선물·로컬 호감도, 샘플 및 이 기기의 리포트, 진행 세션·메시지·카메라 배경·대화 사용량. 프로필·인증 토큰·서버 일정은 이 저장 객체에 포함하지 않는다.
- 로컬 진행 세션은 1초 간격으로 저장하고 복구 시 일시정지한다. 앱을 닫은 시간은 공부에 더하지 않는다. 실제 세션은 서버 `/resume`을 사용하며 등급·차감액·목표·관측 정보만 계정별 `capsule-session:<userId>:<sessionId>`에서 보완한다.
- 로그아웃 후 같은 계정 로그인 시 체험 내역은 유지하고, 다른 계정에서는 분리한다. 회원탈퇴 성공 시 해당 계정의 더미 키도 삭제한다. 저장소를 사용할 수 없으면 메모리에서 체험하며 새로고침 후의 보존은 보장되지 않는다.
- 브라우저/기기 간 동기화와 동시 여러 탭의 원장 정합성은 제공하지 않는다. 실제 금전 가치가 있는 지갑으로 사용하면 안 된다.

## 실제 API를 유지한 범위

이메일/카카오 인증·토큰 갱신·프로필·아바타·홈·룸 상세·일정 조회/생성, 서버 친구 1명과의 공부 시작/재개/이벤트/반응/메시지/heartbeat/정산/리포트는 기존 연결을 유지한다. 실제 API의 401·500·네트워크 오류를 더미 성공으로 바꾸지 않는다. 일정 수정/삭제, 기기 간 과거 채팅 조회 등은 이번에 새 서버 API가 생긴 것으로 가정하지 않는다.

## 교체 순서

1. 실제 API 응답/요청 타입과 adapter를 추가한다. 공개 명세에 없는 엔드포인트 이름을 미리 고정하지 않는다.
2. 위 표의 데이터/동작 경계를 교체하고 실제 ID를 매핑한다. 서버 항목과 로컬 항목이 중복되지 않도록 `mergeRoomCatalog`와 `alignDummyState`를 함께 확인한다.
3. 누적 기록은 `dataSource: 'dummy'` 샘플만 제거하고 실제 서버 리포트를 보존한다. 체험 원장·패스·상품 구매를 실제 결제 원장으로 이관하지 않는다.
4. 연결된 기능의 `DummyNotice`와 검색 표식을 제거하고 저장 키 버전을 올려 필요한 필드만 마이그레이션한다.
5. 아래 검증과 서버 성공/실패·중복 요청·계정 전환·복구 흐름을 확인한다.

## 검증

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run tokens:check`, `git diff --check`.
- [dummy-features.test.ts](../../../tests/dummy-features.test.ts): 전체 카탈로그 병합·서버 ID 유지, 실제 관계 보존, 계정별 저장·탈퇴 삭제, 손상/거부 저장소, 그룹 공부의 목표/등급/시간 복구·정산.
- 2026-11-09 검증 기록: 프로덕션 빌드와 모의 백엔드의 브라우저 시나리오 7개로 전체 메뉴·9개 룸·모바일 직접 경로, 선물/충전과 새로고침, 계정 분리, 3명 그룹 채팅/등급 변경/리포트 복구·다희 카드 PNG 다운로드, 실제 API 경로의 선택 목표 전달·차감액 복구, 시작 실패 시 차감 없음 확인. 카메라 하드웨어·실제 결제사·실제 AI 품질·장시간 세션을 검증한 것은 아니다.
