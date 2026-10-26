# 수정 가능한 공부 공간 에셋

2026-10-26 · 사용자의 이미지 생성 요청에 따라 **built-in image_gen**으로 원본 포스터를 참조해 만들었습니다. 생성 모델이 원본 얼굴·헤어·의상·표정을 보존하도록 지시한 파생 이미지이며, 픽셀 단위로 동일한 누끼라는 뜻은 아닙니다.

| 장면 | 참고 원본 | 배경 | 캐릭터 전경 |
| --- | --- | --- | --- |
| 방과 후, 너와 나 | `../rooms/classroom.webp` | `classroom-background-v1` | `classroom-subject-v1` |
| 전교 1등을 이겨라 | `../rooms/night-study.webp` | `night-background-v1` | `night-subject-v1` |
| 냥냥 독서실 | `../rooms/cat-library.webp` | `cat-background-v1` | `cat-subject-v1` |

각 이름의 `.png`는 생성 마스터, `.webp`는 웹용 압축 파일입니다. 원본 포스터를 덮어쓰지 않았으며 전체 생성 프롬프트·입력·해시·웹 파생 파일은 [generation-manifest.json](generation-manifest.json)에 보관합니다. 입력 포스터는 `Landing_Page`에서 복사한 기존 프로젝트 에셋입니다.

- 배경: 캐릭터와 큰 제목을 제거하고 가로로 재구성한 약 16:9 장면. 배경에는 cover를 적용할 수 있습니다.
- 캐릭터: 실제 알파 채널을 가진 투명 PNG/WebP. contain으로 배치해 눈·귀·머리·몸을 보존합니다. 가장자리의 반투명 헤어·빛 표현을 유지합니다.
- 제목: 이미지 파일에 넣지 않고 `src/features/rooms/artwork.ts`의 `title`·`subtitle` 문자열과 DOM으로 관리합니다. 문구·폰트·크기 변경에 이미지 재생성이 필요하지 않습니다.
- 설명/상태/버튼: 페이지와 카드의 별도 DOM 레이어입니다.

## 레이어 순서

`RoomArtwork`가 배경(z0) → 캐릭터(z1) → 가독성용 CSS 그라디언트(z2) → 제목(z3)을 합성합니다. 카드·홈 히어로·룸 소개·도윤/모루의 세션·리포트·공유 카드에서 같은 파일을 재사용합니다. 원래의 가로형 채린/수아/다희 공부·반응 그림은 그대로 사용합니다.

## 나중에 바꾸는 방법

1. 인물/고양이만 바꾸려면 해당 `*-subject-v2.png`를 새 파일로 만들고 투명도를 유지합니다.
2. 장소만 바꾸려면 `*-background-v2.png`를 새 파일로 만듭니다.
3. cwebp 등으로 WebP를 만들고 `src/features/rooms/artwork.ts`의 해당 import만 교체합니다.
4. 크기와 위치는 `src/styles/scenes.css`의 `card` / `hero` / `scene` / `portrait` / `thumb` 변형에서 조정합니다. 캐릭터에 cover나 음수 바깥 배치를 사용하지 않습니다.
5. PNG 내보내기는 `src/features/rooms/draw-artwork.ts`가 같은 배경·캐릭터를 Canvas에 합성합니다. 원본 마스터와 manifest는 함께 보관합니다.

## 검사

생성된 캐릭터 3개 모두 모서리 알파 0을 확인했습니다. PNG를 WebP로 변환할 때 알파 품질 100을 유지했습니다. 웹용 6개 파일의 합은 약 1.5MB이며, 필요한 곳에서 지연 로드합니다. UI 내 회전·이동은 포인터 입력에만 작게 반응하며 reduced-motion에서는 적용하지 않습니다.
