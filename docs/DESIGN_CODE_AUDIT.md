# 디자인 코드 정리 결과

정리일: 2026-10-28 · 상태: 점검 항목 8개 반영 완료

## 처리 결과

| 점검 항목 | 반영한 내용 | 주요 코드 |
| --- | --- | --- |
| 1. 방문 순서에 따른 탭 크기 변경 | Tabs와 AvatarCustomizer에 size를 추가하고 마이페이지의 전역 덮어쓰기를 제거했습니다. 온보딩은 md, 프로필은 sm을 명시합니다. | [Tabs.tsx](../src/shared/ui/Tabs.tsx), [AvatarCustomizer.tsx](../src/features/profile/components/AvatarCustomizer.tsx) |
| 2. 링크 버튼의 호버 누락 | 버튼·링크가 같은 상태 선택자를 사용합니다. 배경색과 호버색을 같은 CSS 계층에서 관리해 유틸리티의 기본 배경에 호버가 가려지는 문제도 해결했습니다. | [Button.tsx](../src/shared/ui/Button.tsx), [index.css](../src/styles/index.css) |
| 3. 별도 등급 안내창 | UpgradePanel과 공부 중 무료 대화 안내를 공통 Dialog로 연결했습니다. 시트·팝오버 배치를 유지하면서 바깥 클릭·Escape·포커스 복원·배경 스크롤 잠금을 공유합니다. | [Dialog.tsx](../src/shared/ui/Dialog.tsx), [UpgradePanel.tsx](../src/features/session/components/UpgradePanel.tsx), [StudyPage.tsx](../src/pages/StudyPage.tsx) |
| 4. 버튼 크기 재지정 | xs·sm·md·lg 크기와 primary·secondary·soft·ghost 강조 단계를 추가했습니다. 버튼 사용부에서 글자 크기를 덮어쓰던 14곳은 0곳으로 줄었습니다. | [Button.tsx](../src/shared/ui/Button.tsx) |
| 5. 글자 위계 | FormField와 공통 라벨을 적용했습니다. 일정 라벨은 14px, 캐릭터 화면의 같은 위계 제목은 16px로 맞췄습니다. 페이지·섹션·카드·설명·입력값의 글자 토큰을 정의했습니다. | [FormField.tsx](../src/shared/ui/FormField.tsx), [PageHeading.tsx](../src/shared/ui/PageHeading.tsx), [index.css](../src/styles/index.css) |
| 6. 카드 여백과 섹션 간격 | Panel에 density와 bordered 옵션을 추가했습니다. 기록 카드와 일정·프로필·크레딧의 일반 카드가 공통 여백을 사용하며, 홈의 43·23·22px 간격도 공통 섹션·콘텐츠 간격으로 바꿨습니다. | [Panel.tsx](../src/shared/ui/Panel.tsx), [record-summary.css](../src/features/reports/components/record-summary.css) |
| 7. 검색창·휠 입력 중복 | SearchField와 WheelField를 추출했습니다. 검색의 아이콘·지우기·모서리·패딩·포커스, 휠의 라벨·트리거·펼침·Escape·완료·포커스 복원을 각각 한곳에서 관리합니다. | [SearchField.tsx](../src/shared/ui/SearchField.tsx), [WheelField.tsx](../src/shared/ui/WheelField.tsx) |
| 8. 옛 활동 달력 CSS | activity-panel·activity-layout·activity-weekdays·activity-grid·activity-today-dot·activity-legend·activity-detail·activity-note와 관련 반응형 규칙을 제거했습니다. 현재 사용하는 activity-summary와 공통 링·탭 규칙은 유지했습니다. | [interactions.css](../src/styles/interactions.css) |

## 공통 버튼 규칙

| size | 최소 높이 | 글자 크기 | 용도 |
| --- | ---: | ---: | --- |
| xs | 32px | 12px | 휠의 완료 버튼, 조밀한 보조 조작 |
| sm | 40px | 13px | 일정 추가, 이미지 저장·공유 같은 도구 버튼 |
| md | 44px | 14px | 헤더의 충전하기, 상품 카드의 결제하기, 등급 올리기 |
| lg | 48px | 15px | 폼 저장·로그인·공부 시작·선물 보내기·카드 받기 등 주요 실행 |

Button과 ButtonLink는 같은 규칙을 사용합니다. 크기를 바꿀 때 size를 지정하고, 글자 크기·줄 높이·패딩을 페이지에서 각각 재지정하지 않습니다. 긴 문구가 좁은 화면에서 줄바꿈되면 높이는 내용에 맞게 늘어납니다.

primary는 기존 보라 그라데이션, secondary는 주변 바탕과 구분되는 옅은 배경, soft는 기존에 요청된 연한 보라 배경, ghost는 배경 없는 보조 버튼입니다. 비활성 버튼에는 호버 배경 변화가 적용되지 않습니다. 카카오 버튼의 브랜드 색상과 홈 히어로의 강조 표현은 전용 스타일을 유지합니다.

외곽선 제거 후 바탕과 섞이던 보조 버튼은 button-subtle 표현을 공유합니다. 기본 배경은 흰색 약 5%, 호버는 약 9%이며, @theme의 color-button-subtle·color-button-subtle-hover에서 관리합니다. 목표 시간·날짜의 미선택 빠른 버튼, 미리 듣기·반응 닫기·등급 올리기, 일괄 선택·공부 조작부에 적용합니다. 선택 상태의 보라색 배경과 강조선은 유지합니다. 내 기록·마이페이지 달력의 좌우 화살표와 닫기(X) 버튼은 기본 배경 없이 호버·포커스 효과만 사용합니다.

## 글자와 여백 규칙

[index.css](../src/styles/index.css)의 @theme에서 다음 기준을 관리합니다.

| 역할 | 토큰 | 기준 |
| --- | --- | ---: |
| 폼 라벨 | text-label | 14px / 줄 높이 20px |
| 보조 설명 | text-caption | 12px / 줄 높이 18px |
| 입력값 | text-control | 15px / 줄 높이 20px |
| 카드 제목 | text-card-title | 16px / 줄 높이 24px |
| 조밀한 카드 제목 | text-card-title-compact | 14px / 줄 높이 20px |
| 섹션 제목 | text-section-title | 18px / 줄 높이 28px |
| 페이지 제목 | text-page-title | 30px / 줄 높이 40px |
| 모달 제목 | text-dialog-title | 20px / 줄 높이 28px |

Panel의 기본 여백은 모바일 20px, sm 이상 24px입니다. compact는 20px, roomy는 모바일 24px·sm 이상 32px입니다. 일정 목록은 roomy, 달력과 기록의 일반 카드는 기본 밀도를 사용합니다. Panel은 기본적으로 외곽선이 없습니다.

공통 섹션 간격은 40px, 콘텐츠 간격은 24px, 조밀한 콘텐츠 간격은 16px입니다. 가격·공부 시간·차트 눈금·영수증·포스터와 히어로·채팅 조작부는 역할에 필요한 별도 글자 크기를 유지합니다. StatCard의 조밀한 숫자는 size=compact로 지정합니다.

## 컴포넌트 사용과 동작

- SearchField는 룸 검색과 캐릭터 검색에서 외곽선 없이 모서리와 패딩을 공유합니다. 필터링 로직은 각 페이지가 관리합니다.
- WheelField는 입력 틀을 담당하고, DateTimeWheelField·WheelSelectField는 값과 열 구성을 담당합니다. 종류의 낮은 휠과 날짜·시간의 여러 열 구성을 유지합니다.
- 휠 조작은 즉시 입력값에 반영되며, 선택창은 한 번에 하나만 펼쳐집니다. 완료·Escape는 선택창만 닫고, 일정은 저장하기를 누를 때 저장합니다.
- Dialog의 modal·sheet·popover는 배치 방식입니다. 모두 네이티브 모달로 동작하므로 배경은 조작되지 않고 스크롤이 잠깁니다. 시트·팝오버는 부모 패널을 기준으로 배치하며 화면 크기가 바뀌면 다시 맞춥니다.
- 모달은 창 안에서 시작한 드래그가 밖에서 끝나도 닫히지 않습니다. 바깥에서 시작해 바깥에서 끝난 클릭·탭, Escape, 닫기 버튼으로 닫습니다.
- 컴포넌트 안의 선택·저장·결제·업그레이드 동작은 기존 도메인 로직을 사용합니다. 기존에 요청된 외곽선 제거와 연한 결제 버튼도 유지했습니다.

## 외곽선 규칙

- 카드·배너·입력창·버튼·선택 컨트롤·아바타의 기본 외곽선과 링, 안쪽 선 형태의 하이라이트를 제거했습니다.
- 일정 추가·수정의 종류·이름·날짜·시간, 로그인·회원가입의 이메일·비밀번호·비밀번호 확인, 내 아바타 만들기의 이름 입력은 예외로 1px 외곽선을 사용합니다. 각 폼에서 --form-input-border를 지정하며, 포커스·펼침 강조는 기존 규칙을 따릅니다.
- 헤더·푸터·표의 행·목록·영수증 내부의 구분선은 유지합니다.
- 호버·클릭·선택·펼침·키보드 포커스에서 나타나는 테두리와 강조선은 유지합니다. 상품 카드의 호버 광택과 공부 타일의 반응 강조도 유지합니다.
- 상태 변경 때 크기가 바뀌지 않도록 필요한 컨트롤에는 투명 테두리 공간을 남깁니다. 체크박스와 라디오의 미선택 상태는 배경색으로 구분합니다.
- 아이콘·차트·진행률 원의 선은 정보 표시이므로 유지합니다.

## 검증

- npm run lint 통과
- npm run build 통과
- npm test: 기존 테스트 47개 통과
- 코드 재조사: 공통 버튼 사용부의 글자 크기 재지정 0곳
- 브라우저: 320·390·768·1440px에서 주요 페이지의 가로 넘침, 카드 여백, 제목·일괄 선택의 한 줄 정렬 확인
- 온보딩→마이페이지→온보딩 이동 전후의 탭 글자·패딩 유지 확인
- 버튼·링크의 primary·secondary 호버 배경 변화 확인
- 검색과 지우기, 날짜·시간·종류 즉시 반영과 일정 저장, 결제·보너스·영수증 재출력 확인
- 공부 중 무료 대화 안내와 쉬는 시간의 시트·팝오버에서 바깥 클릭·Escape·키보드 포커스·스크롤 잠금·등급 차액 적용 확인
- 외곽선 정리 후: 13개 주요 화면을 320·390·1440px에서 재확인했습니다. 기본 외곽선 제거와 가로 넘침을 확인하고, 호버·선택·펼침·키보드 포커스·결제·공부 화면의 동작 검증 34개도 통과했습니다. 기존 상태별 CSS 54개 규칙과 구분선 선언 11개는 변경하지 않았습니다.
- 버튼 배경 보완 후: lint·build를 통과했습니다. 로그인·보조 실행·빠른 선택·달력 이동·일괄 선택·미리 듣기·모달 닫기·공부 조작 버튼의 배경과 호버를 확인했습니다. 상품·날짜·목표 시간 선택 강조와 320px 배치도 확인했습니다.
- 입력 외곽선 예외 적용 후: lint·build와 브라우저 검증 21개를 통과했습니다. 로그인·회원가입·아바타 이름·일정 추가 및 수정의 1px 테두리, 포커스·펼침 강조, 320px 배치와 폼별 적용 범위를 확인했습니다.
