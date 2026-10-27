# 포스터 서체를 살린 투명 제목 9종

2026-10-27 · 원본 포스터를 참조해 **built-in image_gen**으로 재생성한 제목 레이어입니다. 실제 폰트 파일이나 원본 픽셀과 동일한 누끼가 아니라, 원본의 붓글씨·색상·질감·장식에 가깝게 만든 투명 래스터 이미지입니다.

| 장면 ID | 제목 | 파일 이름 |
| --- | --- | --- |
| `classroom` | 쌀쌀맞은 갸루짝꿍이 나에게만 친절하다! | `classroom-title-v3` |
| `night` | 전교 1등을 이겨라 | `night-title-v1` |
| `cat` | 냥냥이가 날 그렇게 쳐다보면 집중할 수가 없잖아!! | `cat-title-v1` |
| `lantern` | 김상병의 두근두근 비밀연등 | `lantern-title-v1` |
| `fantasy` | 페보니우스 마법학교 | `fantasy-title-v1` |
| `iljin` | 모르는 일진이 나한테 말을 건다 | `iljin-title-v1` |
| `jurassic` | 쥬라기 독서실 | `jurassic-title-v1` |
| `lab` | 뚝딱뚝딱 실험실 | `lab-title-v1` |
| `joseon` | 조선시대 야간 학습 | `joseon-title-v1` |

각 `.png`는 선택한 생성 마스터, 같은 이름의 `.webp`는 크롭 전 보관본입니다. **실제 화면에는 `*-trimmed.webp` 9개**를 사용하며, `night`는 왼쪽 장식을 줄인 `night-title-v1-compact-trimmed.webp`를 사용합니다. 기존 크롭본과 원본도 보관합니다. 배경·캐릭터는 포함하지 않으며, 제목 주변의 빛·하트·왕관·별 등은 제목 장식에 포함됩니다. 원본 포스터와 생성 마스터는 수정하지 않았습니다.

- 원본·최종 프롬프트·크기·SHA-256: [generation-manifest.json](generation-manifest.json)
- 실제 알파 채널 및 PNG/WebP 비교: [alpha-validation.json](alpha-validation.json)
- 크롭 좌표·상하좌우 제거량·결과 해시: [crop-manifest.json](crop-manifest.json)
- 크롭 후 글자/장식 보존 및 알파 픽셀 비교: [crop-validation.json](crop-validation.json)
- 압축 명령: `cwebp -q 90 -alpha_q 100 -m 6 input.png -o output.webp`

## 적용과 교체

[sceneArtwork](../../features/rooms/artwork.ts)의 `titleImage`로 크롭본을 등록하고, `titleImageSize`에는 실제 크기를 기록합니다. 공통 [RoomTitle](../../features/rooms/components/RoomTitle.tsx)이 크기 속성과 대체 텍스트를 설정합니다. 메인화면의 `RoomCard`와 개발용 `RoomArtwork` 미리보기가 같은 파일을 재사용합니다.

룸 카드의 이미지·캐릭터·제목·초상화/이름·저장 버튼은 독립된 레이어입니다. 제목은 **왼쪽·위쪽에서 각각 12px** 떨어뜨리고, 반투명 초상화/이름 배지는 왼쪽 아래에 표시합니다. **제목 가로폭은 룸 카드 이미지 영역의 50%**이며, 원래 비율에 따라 높이가 결정됩니다. 서로 다른 비율의 제목을 동일한 높이 안에 넣어 일부만 작아지는 문제를 피합니다.

제목의 크기·위치는 [index.css](../../styles/index.css)의 `.room-card-title`, 미리보기는 [scenes.css](../../styles/scenes.css)의 `.scene-title`에서 조절합니다. 크롭본에 남긴 수 픽셀의 안전 여백은 붓글씨와 장식 가장자리를 보존하기 위한 것입니다.

## 크롭 재생성

`cwebp`가 설치된 환경에서 `Front_Web`의 `npm run assets:titles`를 실행합니다. [처리 스크립트](../../../scripts/prepare-room-titles.mjs)는 PNG의 실제 알파 영역을 읽어 상하좌우 여백을 계산하고, 각 마스터에서 크롭한 WebP와 `crop-manifest.json`을 만듭니다. 이미지 생성이나 글자 재작성은 하지 않습니다.

기본 규칙은 알파값 **8/255 이상**인 모든 픽셀을 포함하고, 바깥으로 4px의 안전 여백을 두는 것입니다. 코덱의 짝수 시작 좌표에 맞춰 일부 방향은 1px 더 남을 수 있습니다. 기본 크롭에서는 알파값 8 미만의 미세한 흔적만 범위 밖에 있을 수 있으며, 보존된 영역의 알파값은 원본과 동일합니다. 원본 비율을 늘이거나 글자를 잘라서 크기를 맞추지 않습니다.

`night`는 글자보다 왼쪽으로 길게 뻗은 번개 장식 때문에 제목 시작이 밀려 보이므로, 원본 PNG의 x=290에서 시작하도록 추가 크롭합니다. 이 예외는 처리 스크립트의 `cropOverrides`와 `crop-manifest.json`의 `decorationCrop`에 기록됩니다. 이 경우 잘려 나가는 장식에는 불투명 픽셀도 포함되며, 유지한 영역의 글자·색상·알파는 재작성하지 않습니다.

제목을 바꿀 때는 새 버전의 투명 PNG를 만들고 생성 매니페스트를 갱신한 뒤 크롭을 다시 실행합니다. `titleImage` import와 `titleImageSize`를 결과에 맞게 교체합니다. `sceneArtwork.title`과 `data/rooms.ts`의 `name`도 함께 바꿔 대체 텍스트·검색·상세·기록의 이름을 일치시킵니다. 이미지 파일이 글자 역할을 하지만 실제 제목 문자열은 별도로 유지합니다.

개발 서버의 `/src/assets/scenes/preview.html`에서 배경·전경을 끄면 체크무늬 위에 제목만 볼 수 있고, 각 제목 WebP도 개별적으로 열 수 있습니다.
