# 캠 가상 배경

스터디룸 캠 화면의 가상 배경 이미지 3종입니다. 인물은 그대로 두고 배경만 이 이미지로 바꿉니다. 옵션 목록(기본·블러 포함)은 `src/features/media/camera-backgrounds.ts`에서 관리합니다.

사용자가 제공한 3524×1184 PNG를 세로 720 기준으로 줄여 2143×720 WebP로 변환했습니다. 캠은 640×480(4:3)이라 화면에서는 가운데를 cover 방식으로 잘라 씁니다. 변환은 `cwebp -q 88 -m 6 -resize 0 720 원본.png -o 결과.webp`입니다.

| 파일 | 라벨 | 출처 |
| --- | --- | --- |
| `classroom-sunset-v1.webp` | 노을 지는 교실 | 사용자 제공 이미지 |
| `library-rainy-night-v1.webp` | 비 오는 밤의 도서관 | 사용자 제공 이미지 |
| `study-room-night-city-v1.webp` | 야경 보이는 공부방 | 사용자 제공 이미지 |

수정 시 기존 파일을 덮어쓰지 말고 `v2`처럼 새 버전을 추가한 뒤 `camera-backgrounds.ts`에 연결하세요.
