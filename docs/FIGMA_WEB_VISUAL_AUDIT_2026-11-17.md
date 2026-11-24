# Front_Web → Figma 화면별 시각 대조 · 2026-11-17

상태: **진행 중 — Figma 연결 복구 필요. 전체 동일 검증 완료 아님.**

대상: [생성 에셋 관리 + 새로운 와이어프레임 / WF J 섹션](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2479-10678)

실제 웹 기준 이미지 49개를 확보했다. 정상 크기의 Figma 이미지 37개를 화면별로 대조했고, 27개에서 수정할 차이를 발견했다. 10개는 주요 배치가 일치했다. 나머지는 로그인 3개 재캡처와 결제·모바일 9개 비교가 필요하다.

## 검토 조건

- 데스크톱 1440×1000, 모바일 390×844. 긴 페이지는 전체 높이, 모달은 뷰포트 크기로 비교.
- 실제 `Front_Web` 페이지와 공통 컴포넌트를 `__review` 가상 데이터로 렌더링하고 폰트 로딩 후 캡처.
- 타이머·날짜·타이핑·애니메이션 시점 차이는 정적 배치 차이와 구분.
- 실제 계정/API/카메라/마이크/WebGL 모델의 동작 검증은 포함하지 않음.
- “주요 배치 일치”는 문구·이미지·버튼 배치의 시각 대조 결과이며 픽셀 단위 동일 판정은 아님.
- Pretendard·Hahmlet·League Gothic을 유지. 폰트 속성 검증과 화면별 시각 검증은 별도로 판단.

## 적용한 수정과 재검증

Figma 연결이 끊기기 전에 화면 행 15개의 클리핑과 폭을 수정했고, 로그인 계열 6개 모자이크 그리드에 -10도 회전을 복원했다. **수정 후 화면 캡처 재검증은 아직 못 했다.** 아래 비교 이미지는 해당 수정 전 기준이다.

## 우선 수정 항목

1. 계정·튜토리얼·일정 추가 모달을 실제 웹의 최상단 순서로 배치하고 배경 어둡게 처리와 흐림을 복원.
2. 리포트·내 기록의 원형 지표 위치와 부분 진행량을 복원.
3. 캡슐 카드의 CSS 마스크 로고, 이미지 크롭, 날짜·시간 입력 내용을 복원.
4. 룸 제목과 친구 소개의 줄바꿈·말줄임, 장식 회전, 반투명 테두리를 조정.
5. 로그인 3개와 결제·모바일 9개를 포함해 수정된 모든 화면을 다시 캡처하고 대조.

공통 모달 배경은 `rgba(15,14,23,0.72)`. 기본 흐림은 8px, 공부 준비는 12px, 모바일 대화창은 3px이다. 계정 창은 데스크톱에서 `x=240, y=170, 960×660`, 공부 준비 창은 `x=360, y=48, 720×904`이다. 실제 DOM에서 이 값을 다시 수집했다.

## 화면별 결과

| ID | 화면 | 상태 | 확인 내용 |
|---|---|---|---|
| entry-1 | [로그인 시작](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2486-10913) | 차이 확인 | 로그인 배경 모자이크 회전은 수정 적용됨. 수정 후 재캡처 필요. 폼 테두리가 실제 웹보다 밝게 표시되어 투명도 확인 필요. |
| entry-2 | [이메일 로그인](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2496-14194) | 재캡처 필요 | 기존 Figma 캡처가 1×1로 반환됨. 상위 행 클리핑 수정 후 재캡처 필요. |
| entry-3 | [회원가입](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2496-14433) | 재캡처 필요 | 기존 Figma 캡처가 1×1로 반환됨. 상위 행 클리핑 수정 후 재캡처 필요. |
| entry-4 | [이메일 인증](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2496-14705) | 재캡처 필요 | 기존 Figma 캡처가 1×1로 반환됨. 상위 행 클리핑 수정 후 재캡처 필요. |
| entry-5 | [비밀번호 찾기](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-10938) | 차이 확인 | 로그인 배경 모자이크 회전은 수정 적용됨. 수정 후 재캡처 필요. 폼 테두리 투명도 확인 필요. |
| entry-6 | [새 비밀번호](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-11164) | 주요 배치 일치 | 주요 배치·문구·버튼·배경 일치. |
| home-1 | [아바타 선택](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-11190) | 차이 확인 | 실제 웹에 보이지 않는 아바타 궤도 테두리가 Figma에 표시됨. |
| home-2 | [홈 · 첫 방문](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2486-11166) | 차이 확인 | 룸 카드 북마크 배경의 색·투명도 차이. |
| home-3 | [홈 · 재방문](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-11257) | 차이 확인 | 룸 카드 북마크 배경의 색·투명도 차이. |
| home-4 | [사용법 · 친구와 룸](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-11834) | 차이 확인 | 모달 배경 어둡게 처리 및 8px 흐림 누락. 하단 룸 카드가 모달 앞에 그려지는 겹침 순서 오류. |
| home-5 | [사용법 · 공부하기](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-13893) | 차이 확인 | 모달 배경 어둡게 처리 및 8px 흐림 누락. 하단 룸 카드와 모달의 겹침 순서 수정 필요. |
| home-6 | [사용법 · 기록과 카드](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-14279) | 차이 확인 | 모달 배경 어둡게 처리 및 8px 흐림 누락. 하단 룸 카드와 모달의 겹침 순서 수정 필요. |
| prepare-1 | [스터디룸 상세](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-14667) | 차이 확인 | 룸 제목의 줄바꿈이 실제 웹과 다름. 하단 장식 테이프의 회전 누락. |
| prepare-2 | [공부 준비 · 목표와 대화](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-15086) | 차이 확인 | 준비 모달 배경 어둡게 처리 및 12px 흐림 누락. |
| prepare-3 | [공부 준비 · 일정 추가](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-15656) | 차이 확인 | 일정 추가 창이 준비 화면에 가려지고 위치가 다름. 준비 모달 → 배경 처리 → 계정 모달 순서로 복원 필요. |
| study-1 | [공부 중 · 친구 확대](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2505-16456) | 주요 배치 일치 | 주요 배치·이미지·컨트롤 일치. 타이머는 캡처 시점에 따라 다름. |
| study-2 | [공부 중 · 호그와트 책상](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2509-12126) | 주요 배치 일치 | 주요 배치·이미지·컨트롤 일치. 타이머는 캡처 시점에 따라 다름. |
| study-3 | [공부 중 · 분할 보기](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2509-12266) | 주요 배치 일치 | 분할 배치·이미지·컨트롤 일치. 타이머는 캡처 시점에 따라 다름. |
| study-4 | [공부 중 · 내 화면 확대](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2509-12404) | 주요 배치 일치 | 내 화면·작은 친구 화면·컨트롤 배치 일치. 타이머는 캡처 시점에 따라 다름. |
| study-5 | [공부 중 · 대화창](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2509-12543) | 주요 배치 일치 | 대화창·공부 화면·컨트롤 배치 일치. 타이머는 캡처 시점에 따라 다름. |
| study-6 | [쉬는 시간](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2509-12751) | 주요 배치 일치 | 휴식 화면·대화창·컨트롤 배치 일치. 타이머는 캡처 시점에 따라 다름. |
| study-7 | [공부 이어하기](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2509-12905) | 주요 배치 일치 | 주요 배치·문구·버튼·배경 일치. |
| study-8 | [공부 종료 확인](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2509-12921) | 차이 확인 | 종료 확인 모달 배경 어둡게 처리 및 8px 흐림 누락. |
| report-1 | [공부 완료 리포트](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2509-13079) | 차이 확인 | 자리 지킴률 원형 지표의 위치·진행량 표시 오류. 유리 패널 테두리가 실제 웹보다 밝음. 친구 대사의 줄바꿈 차이. |
| report-2 | [호그와트 완료 리포트](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2525-12173) | 차이 확인 | 자리 지킴률 원형 지표의 위치·진행량 표시 오류. 유리 패널 테두리 투명도 및 대사 줄바꿈 차이. |
| report-3 | [레벨 상승 리포트](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2525-12328) | 차이 확인 | 자리 지킴률 원형 지표의 위치·진행량 표시 오류. 유리 패널 테두리 투명도 및 대사 줄바꿈 차이. |
| report-4 | [캡슐 카드 · 보라](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2525-12483) | 차이 확인 | CSS 마스크 로고가 흰 사각형으로 표시됨. 완료 이미지의 object-position(50% 10%)이 보존되지 않아 크롭이 다름. 날짜·시간 입력의 표시 값과 아이콘 누락. |
| report-5 | [캡슐 카드 · 검정](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2525-12560) | 차이 확인 | CSS 마스크 로고가 흰 사각형으로 표시됨. 완료 이미지 크롭 차이. 날짜·시간 입력의 표시 값과 아이콘 누락. |
| account-1 | [계정 설정 · 프로필](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2525-12627) | 차이 확인 | 계정 모달이 홈 화면 뒤에 가려지는 겹침 순서 오류. 모달을 최상단으로 옮기고 배경 어둡게 처리 및 8px 흐림 복원 필요. |
| account-2 | [계정 설정 · 일정](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2525-13410) | 차이 확인 | 계정 모달이 홈 화면 뒤에 가려지는 겹침 순서 오류. 배경 어둡게 처리·흐림 및 일정 폼 재확인 필요. |
| account-3 | [계정 설정 · 일정 추가](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2525-14249) | 차이 확인 | 계정 모달이 홈 화면 뒤에 가려지는 겹침 순서 오류. 배경 어둡게 처리·흐림 및 날짜·시간 입력 표시 재확인 필요. |
| account-4 | [계정 설정 · 보안](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2531-13642) | 차이 확인 | 계정 모달이 홈 화면 뒤에 가려지는 겹침 순서 오류. 배경 어둡게 처리 및 8px 흐림 복원 필요. |
| post-1 | [내 기록 · 주간](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2531-14180) | 차이 확인 | 자리 지킴률 SVG 원이 숫자보다 아래로 내려가고 부분 진행량이 전체 원으로 표시됨. |
| post-2 | [내 기록 · 월간](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2531-14920) | 차이 확인 | 자리 지킴률 SVG 원의 위치·부분 진행량 표시 오류. |
| post-3 | [내 기록 · 스터디룸별](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2531-15730) | 차이 확인 | 자리 지킴률 SVG 원의 위치·부분 진행량 표시 오류. |
| post-4 | [친구 · 관계와 해금 콘텐츠](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2531-16413) | 차이 확인 | 친구 소개 문장의 말줄임이 풀려 두 줄로 표시됨. 소개 문장 아래 카드 높이·버튼 세로 위치 차이. |
| post-5 | [선물 · 보이스 · 보관함](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2533-15409) | 주요 배치 일치 | 주요 배치·문구·이미지·버튼 일치. |
| post-6 | [보이스 글 미리보기](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2533-15784) | 차이 확인 | 보이스 미리보기 모달 배경 어둡게 처리 및 8px 흐림 누락. |
| pay-1 | [내 크레딧 · 이용 내역](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2533-16119) | 주요 배치 일치 | 주요 배치·문구·이용 내역 표·버튼 일치. |
| pay-2 | [패스 상품](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2533-16443) | 차이 확인 | 친구 패스 카드의 대각선 홀로그램 빛 표현이 실제 웹과 다름. |
| pay-3 | [크레딧 상품](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2533-16637) | Figma 비교 대기 | 웹 기준 이미지 확보. Figma 비교 이미지 미수집. |
| pay-4 | [체험 결제 정보](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2533-16796) | Figma 비교 대기 | 웹 기준 이미지·모달 치수·배경 처리 값 확보. Figma 비교 이미지 미수집. |
| pay-5 | [체험 충전 완료 · 영수증](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2536-16064) | Figma 비교 대기 | 웹 기준 이미지·모달 치수·배경 처리 값 확보. Figma 비교 이미지 미수집. |
| mobile-1 | [모바일 · 로그인](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2536-16316) | Figma 비교 대기 | 웹 기준 이미지 확보. 배경 회전 수정 후 Figma 재검증 필요. |
| mobile-2 | [모바일 · 홈](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2536-16567) | Figma 비교 대기 | 웹 기준 이미지 확보. Figma 비교 이미지 미수집. |
| mobile-3 | [모바일 · 공부 준비](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2536-17149) | Figma 비교 대기 | 웹 기준 이미지·모달 치수·배경 처리 값 확보. Figma 비교 이미지 미수집. |
| mobile-4 | [모바일 · 공부와 대화](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2536-17735) | Figma 비교 대기 | 이전 작업에서 모달 위치·배경 처리 수정됨. 이번 전체 대조의 최종 이미지 재검증 필요. |
| mobile-5 | [모바일 · 완료 리포트](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2536-17942) | Figma 비교 대기 | 웹 기준 이미지 확보. Figma 비교 이미지 미수집. |
| mobile-6 | [모바일 · 충전](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=2536-18095) | Figma 비교 대기 | 웹 기준 이미지 확보. Figma 비교 이미지 미수집. |

## 검토 자료

- [기계 판독용 49개 화면 목록](FIGMA_WEB_VISUAL_AUDIT_2026-11-17.json)
- [이미지 비교 열기](/tmp/capsule-figma-audit-20261117/index.html)
- 원본 웹·Figma·나란히 비교 이미지 및 DOM 기준값: `/tmp/capsule-figma-audit-20261117`

임시 이미지 경로는 현재 작업 컴퓨터에만 존재한다. Figma 연결 복구 후 기존 파일과 섹션에서 수정을 이어가고, 재검증 결과로 이 문서의 상태를 갱신해야 한다.
