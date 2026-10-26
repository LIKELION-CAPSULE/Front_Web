# CAPSULE Web

AI 캐릭터와 함께 공부하는 CAPSULE의 프론트엔드 초기 기반입니다. `Front_Web` 안에서 독립적으로 실행하며, 옆의 `Landing_Page` 프로젝트와 의존성·설정을 공유하지 않습니다.

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
npm run build
npm run preview
```

## 이번 단계의 구현 범위

- React + TypeScript(strict) + Vite + Tailwind CSS(v4 Vite 플러그인).
- React Router 기반의 페이지·레이아웃 분리와 페이지 단위 지연 로딩.
- 피그마 S03-b 첫 방문 홈, S04 룸 상세의 기본 레이아웃.
- 버튼/링크, 아바타, 빈 상태, 페이지 제목, 룸 카드, 캐릭터 카드의 재사용 컴포넌트.
- 내 기록·캐릭터·크레딧 경로의 준비 화면과 잘못된 주소/룸 처리.
- 모바일에서의 줄바꿈·카드 열 수 조정, 키보드 포커스·본문 건너뛰기, 로컬 폰트.

현재 데이터는 와이어프레임을 확인하기 위한 로컬 샘플입니다. 공부 시작과 저장은 비활성화되어 있으며, 실제 인증·카메라·감지·Live2D·세션·대화·관계 적립·결제·서버 저장은 연결하지 않았습니다. 숫자 0은 실제 계정 조회 결과가 아닙니다. 이어하기 카드와 S01/S02/S05 이후 전체 화면은 다음 구현 범위입니다.

## 문서

[문서 목록](docs/README.md)부터 읽어 주세요.

- [원본 서비스 기획 정리](docs/CAPSULE_서비스_기획_정리.md) — 내용 수정 없이 `docs`로 이동.
- [서비스·와이어프레임 분석](docs/SERVICE_ANALYSIS.md) — 핵심 경험, 우선순위, 문서 간 차이.
- [피그마 화면 지도](docs/FIGMA_SCREEN_MAP.md) — 실제 확인한 노드와 현재 구현 범위.
- [프론트엔드 구조](docs/FRONTEND_ARCHITECTURE.md) — 컴포넌트 경계, 스타일, 데이터 교체, 후속 작업.

## 참고

피그마는 읽기 전용으로 확인했습니다. 원본 프레임의 번호 핀과 오른쪽 메모는 기획 주석이므로 웹 UI에 포함하지 않았습니다. 이미지가 없는 슬롯은 원본처럼 자리 표시자로 두었습니다. 두 번째·세 번째 룸의 콘텐츠는 미확정이어서 준비 중으로 표시합니다.

BrowserRouter를 사용하므로 배포 서버에서는 `/rooms/dawn-library` 같은 URL도 `index.html`로 연결하는 SPA fallback이 필요합니다. 실제 배포는 수행하지 않았습니다.

설정 참고: [Vite](https://vite.dev/guide/), [Tailwind Vite 설치](https://tailwindcss.com/docs/installation/using-vite), [React Router 설치](https://reactrouter.com/start/declarative/installation).
