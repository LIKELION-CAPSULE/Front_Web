# CAPSULE 에셋

메이트 연결 서비스가 쓰는 번들 에셋만 둔다. 외부 이미지 URL이나 `Landing_Page` 경로를 런타임에 참조하지 않는다. 운영의 메이트 모델·카드 이미지는 백엔드 응답(`model` · `cardImageUrl`)을 쓰고, 여기 있는 것은 그 응답이 없을 때의 대체 이미지와 화면 고유 그림이다.

공식 로고는 이 폴더가 아니라 [로고 v2 원본](../../design/brand/capsule-logo-2026-11-22-v2/README.md)을 `src/shared/design/brand-logo.ts` 한 곳에서 가져온다.

| 위치 | 내용 | 사용처 |
| --- | --- | --- |
| `brand/` | Pretendard(공통 서체)·Hahmlet(캡슐 카드 대표 문장)과 라이선스 · [서체 기록](brand/README.md) | `styles/design-tokens.css`, `styles/index.css` |
| `characters/chaerin-v2/` | 채린 카드·히어로·전신·졸음·아바타 정지 이미지와 상반신 표정(일부) · [생성 기록](characters/chaerin-v2/README.md) | `features/mates/artwork.ts`, 로그인 졸음 화면(상반신 표정은 지금 안 씀) |
| `characters/seojin/` | 서도현(서버 이름 서진) 같은 구성 · [생성 기록](characters/seojin/README.md) | 같은 곳 |
| `characters/chaerin-call-bg/` | 채린 통화 배경(가로·세로) | 연결 화면, 홈 히어로 |
| `connection/` | 통화 종료·전화 받기 연출의 수화기 3D 이미지 · [제작 기록](connection/README.md) | `features/mates/hangup-sequence.ts`, `pickup-sequence.ts` |
| `attendance/` | 홈 출석 위젯 그림 | `features/attendance/` |
| `public/favicon.svg` | `Landing_Page/public/favicon.svg` 복사 | 파비콘 |

`characters/*/expressions/`·`expressions-bust/`는 `scripts/render-chaerin-expressions.mjs`·`render-mate-stills.mjs`가 만든 세트 전체를 둔다. 화면이 지금 쓰는 것은 그중 일부다.

옛 스터디 버전의 에셋(룸 포스터·장면 레이어·룸 제목·상세 배너·환영 배너·리포트 완료 이미지·말포이 TS 세트·가상 배경·Figma 추출 아이콘·League Gothic)은 2026-11-25 정리에서 삭제했다. 생성 기록과 프롬프트는 git 이력에서 볼 수 있다.
