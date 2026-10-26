# CAPSULE Web

AI 캐릭터와 함께 공부하는 CAPSULE의 프런트엔드 데모입니다. 백엔드 없이 더미 계정·기록·크레딧으로 전체 화면 흐름을 체험할 수 있습니다. `Front_Web` 안에서 독립적으로 실행하며, 옆의 `Landing_Page`와 의존성·설정을 공유하지 않습니다.

## 실행

Node.js 22 LTS(22.13 이상) 또는 24 이상이 필요합니다. `.nvmrc`는 Node 22를 기준으로 합니다.

```bash
cd Front_Web
npm ci
npm run dev
```

Vite가 출력하는 로컬 주소에서 확인합니다.

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run preview
```

## 화면 흐름

```text
더미 로그인 → 내 아바타 → 홈 → 스터디룸 상세
  → 카메라 확인 → 세트·등급 선택 → 공부 → 휴식·대화
  → 종료 리포트 → 캡슐 카드·다음 약속 → 홈
```

| 경로 | 화면과 동작 |
|---|---|
| `/login` | 카카오/이메일 로그인 모형, 더미 계정으로 바로 둘러보기 |
| `/onboarding` | 이름과 헤어·의상·외모·배경의 샘플 옵션 선택 |
| `/` | 첫 방문/이어하기 홈, 룸 탐색·저장, 진행 중인 세션 복귀 |
| `/rooms/:roomId` | 룸 설명과 캐릭터 관계, 공부 시작 |
| `/rooms/:roomId/prepare` | 카메라 확인 → `?step=set`에서 등급·시험 일정 선택 |
| `/study/:sessionId` | 1:1/1:3 공부, 포커스 보기, 타이머·일시정지·채팅·휴식·등급 변경 |
| `/reports/:recordId` | 집중·딴짓·복귀·관계 변화의 샘플 결과 |
| `/capsules/:recordId` | 카드 색·PNG 저장·공유·다음 공부 약속 |
| `/records` | 전체/스터디룸별 시간·이용일·최근 세션 |
| `/characters/:characterId` | 관계·해금 콘텐츠, 시험·목표·약속 추가/수정/삭제 |
| `/characters/:characterId/shop` | 선물/보이스 필터·미리보기·더미 구매·보관함 |
| `/credits` | 잔액·패스·원장 필터·샘플 영수증 |
| `/credits/charge` | 상품/결제 수단/동의 선택 → 명시적 데모 결제 확인 |

`/characters`는 기본 캐릭터 채린의 관계 화면으로 열립니다. 없는 룸·캐릭터·기록은 찾을 수 없음으로 처리합니다.

## 빠르게 체험하기

1. 카카오로 계속하기 → 아바타 설정을 완료하거나, **더미 계정으로 바로 둘러보기**를 누릅니다.
2. 방과 후, 너와 나 → 공부 시작 → 카메라 확인 → 스탠다드를 선택하면 더미 잔액 1,240에서 200크레딧이 차감됩니다.
3. 공부 화면의 **데모 조작 → 휴식 화면 보기**를 누르면 50분을 기다리지 않고 휴식을 볼 수 있습니다. 시작 타이머는 와이어프레임처럼 47:12, 휴식 미리보기는 07:42부터 표시합니다.
4. 쉬는 시간에 프리미엄으로 올리면 이미 낸 200을 제외한 300만 차감됩니다. 베이직의 3턴 한도는 캐릭터·공부/휴식 화면 전체에서 공유하며, 서울 기준 새벽 5시에 갱신합니다.
5. 종료 후 캡슐 카드 이미지를 저장하거나 다음 공부 약속을 추가합니다. 크레딧 충전·선물·패스도 더미 상태로 연결됩니다.

프로필 메뉴에서 **첫 방문 홈 보기**, 아바타 변경, 로그아웃, **데모 초기화**를 할 수 있습니다. 사용자 데이터는 `localStorage`의 `capsule-wireframe-demo:v1`에 저장됩니다. 저장을 사용할 수 없으면 메모리로 동작하며, 새로고침하면 초기화될 수 있음을 화면에 안내합니다.

## 디자인

홈의 캐릭터 환영 장면, 포스터형 스터디룸 카드, 일러스트 기반 공부·휴식 화면, 캐릭터 관계·선물·기록·크레딧 화면을 같은 색상·컨트롤로 연결했습니다. 룸/캐릭터 검색·분위기/저장 필터·저장 되돌리기 알림·SVG 아바타 미리보기를 지원하고, 캡슐 카드의 실제 PNG에도 캐릭터 그림이 들어갑니다.

- 색상·폰트·간격: `src/styles/index.css`의 Tailwind `@theme`
- 공통 UI: `src/shared/ui`의 `Brand`, `Icon`, `AvatarIllustration`, `Button`, `Panel` 등
- 캐릭터 그림·표정: `src/features/characters/artwork.ts`
- 룸 문구: `src/features/rooms/data/rooms.ts` / 이미지 결합: `services/room-service.ts`
- 룸 장면의 배경·캐릭터·제목: `src/features/rooms/artwork.ts` / `src/styles/scenes.css`
- 탐색·기록·공통 피드백 스타일: `src/styles/interactions.css`
- 상세 가이드: [디자인 시스템](docs/DESIGN_SYSTEM.md)

참고 사이트 45곳의 공개 화면을 조사해 활동 달력·집중률 링·공통 로딩·조용히 집중 모드를 추가했습니다. 조사 범위와 적용/보류 판단은 [참고 사이트 조사](docs/REFERENCE_RESEARCH.md)에 정리했습니다. Behance는 접근 오류로 미확인입니다.

기존 포스터의 잘림을 줄이기 위해 이미지 생성으로 캐릭터 전경 3개와 가로 배경 3개를 만들었습니다. **원본 포스터 / PNG 마스터 / 웹용 WebP / 제목 DOM**을 분리했습니다. [에셋 편집 가이드](src/assets/scenes/README.md)와 [전체 생성 프롬프트](src/assets/scenes/generation-manifest.json)에서 파일을 교체하는 방법을 확인할 수 있습니다.

스터디룸의 더미 이름은 그림에 맞춰 **방과 후, 너와 나 / 전교 1등을 이겨라 / 냥냥 독서실**로 정리했습니다. 기존 룸·캐릭터 ID와 저장 데이터 형식은 유지합니다.

## 구현 경계

실제 OAuth·카메라 촬영·행동 감지·Live2D·LLM/TTS·결제·서버 저장은 연결하지 않았습니다. 카메라는 아바타가 있는 샘플 미리보기, 대화는 준비된 답변, 음성은 샘플 텍스트로 보여 줍니다. 결제에는 카드 정보를 받지 않으며 실제 청구가 없습니다. 관계·집중 리포트는 더미 계산 규칙입니다.

캡슐 카드 PNG는 실제로 저장할 수 있습니다. 파일 공유를 지원하는 브라우저에서는 공유 창을 열고, 지원하지 않으면 이미지 저장으로 안내합니다. 복사한 데모 링크의 기록은 이 브라우저 안에만 있으므로 다른 기기와의 동기화는 지원하지 않습니다.

React + TypeScript(strict) + Vite + Tailwind CSS v4를 사용합니다. 공통 UI, 기능 모듈, 페이지와 더미 reducer를 분리했고 페이지는 지연 로딩합니다. 타입 검사·린트·빌드 및 타이머/원장/대화 한도 등의 상태 테스트를 실행할 수 있습니다.

## 문서

로컬의 [문서 목록](docs/README.md)에서 기획 근거와 구조를 확인할 수 있습니다. 현재 저장소의 `docs/` 제외 규칙은 유지되어 있습니다.

- [원본 서비스 기획 정리](docs/CAPSULE_서비스_기획_정리.md) — 내용 수정 없이 `docs`로 이동.
- [서비스·와이어프레임 분석](docs/SERVICE_ANALYSIS.md) — 핵심 경험, 우선순위, 문서 간 차이.
- [피그마 화면 지도](docs/FIGMA_SCREEN_MAP.md) — 실제 확인한 노드와 현재 구현 범위.
- [프론트엔드 구조](docs/FRONTEND_ARCHITECTURE.md) — 컴포넌트 경계, 스타일, 데이터 교체, 후속 작업.

## 참고

피그마는 읽기 전용으로 확인했습니다. 원본 프레임의 번호 핀과 메모는 기획 주석이므로 웹 UI에 포함하지 않았습니다. 화면 흐름은 유지하면서 `Landing_Page`의 로고·Pretendard 폰트·WebP 포스터·캐릭터 일러스트를 재사용해 네이비와 라벤더 중심의 디자인을 적용했습니다. Figma 원본과 랜딩페이지 파일은 수정하지 않았습니다. 에셋 출처와 매핑은 [에셋 문서](src/assets/README.md)에 정리했습니다.

BrowserRouter를 사용하므로 배포 서버에서는 `/rooms/dawn-library` 같은 URL도 `index.html`로 연결하는 SPA fallback이 필요합니다. 실제 배포는 수행하지 않았습니다.

설정 참고: [Vite](https://vite.dev/guide/), [Tailwind Vite 설치](https://tailwindcss.com/docs/installation/using-vite), [React Router 설치](https://reactrouter.com/start/declarative/installation).
