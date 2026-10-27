# 메인화면의 앉은 장면 배경 9종

2026-10-27 · **built-in image_gen**으로 기존 가로 배경을 편집했습니다. 앞쪽 책상·의자·큰 소품을 제거하고 각 룸의 색감과 장소를 유지한 바닥/러그를 만들었습니다. 캐릭터와 제목은 포함하지 않습니다. 먼 벽이나 측면의 환경 가구는 남아 있을 수 있습니다.

- 파일: `<장면 ID>-seated-background-v1.png`(마스터), 같은 이름의 `.webp`(웹 표시용)
- 장면 ID: `classroom`, `night`, `cat`, `lantern`, `fantasy`, `iljin`, `jurassic`, `lab`, `joseon`
- 규격: 1672 × 941, 9종. 웹용 합계 약 2.51MiB.
- [전체 프롬프트·참조 배경·파일 크기·해시](generation-manifest.json)
- [함께 사용하는 투명 전신 캐릭터](../layered-v2/README.md)

메인화면의 룸 카드는 `RoomArtwork variant="seated"`, 환영 영역은 `variant="welcome"`를 사용합니다. `welcome`은 앉은 장면을 재사용하며 `welcomeLayout`으로 하단 말풍선과 겹치는 얼굴 위치만 별도로 보정할 수 있습니다. `sceneArtwork.seatedBackground` 위에 전신 캐릭터를 배치하고 책상 DOM을 만들지 않습니다. 도윤을 기준으로 캐릭터 한 명의 표시 크기를 맞추고, 여러 명인 룸은 그룹 폭을 확대합니다. 캐릭터를 오른쪽 아래에 배치하며 실제 발/옷자락 기준선을 카드 높이의 103.5%에 둬 발끝을 조금 자릅니다. 투명 여백은 `seatedLayout.anchor`로 보정하고, 고양이는 얼굴이 발 높이에 있어 기준선을 99%로 따로 조정합니다. 원래 이미지 비율은 유지합니다. 제목은 카드 너비의 절반, 왼쪽/위 12px 여백을 유지합니다.

공부·상세·리포트는 별도의 `background`와 책상 레이어를 사용합니다. 메인화면 배경만 바꾸려면 `src/features/rooms/artwork.ts`의 `seatedBackground`를 교체합니다. 기존 배경과 원본 포스터는 덮어쓰지 않았습니다.

개발 서버의 `/src/assets/scenes/preview.html`에서 **메인화면 구도**를 켜고 배경/캐릭터/제목을 따로 확인하세요. 이 설정을 끄면 공부 장면의 책상 레이어도 확인할 수 있습니다.
