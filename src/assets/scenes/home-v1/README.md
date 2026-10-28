# 홈 룸 카드 전용 캐릭터

현재 홈에는 의자를 없애고 원본 포스터 복장을 복원한 [v2](../home-v2/README.md)를 사용합니다. 이 폴더는 이전 시안과 생성 기록입니다.

2026-10-28 · **built-in image_gen**으로 기존 얼굴·헤어·그림체를 참고해 두 룸의 캐릭터 전경을 재생성했습니다. 단정한 셔츠와 가디건·조끼, 긴 스커트, 노트를 든 자연스러운 의자 자세를 사용합니다.

| 룸 | PNG 마스터 | 표시용 WebP |
| --- | --- | --- |
| 쌀쌀맞은 갸루짝꿍이 나에게만 친절하다! | [classroom-home-subject-v1.png](classroom-home-subject-v1.png) | [classroom-home-subject-v1.webp](classroom-home-subject-v1.webp) |
| 전교 1등을 이겨라 | [night-home-subject-v1.png](night-home-subject-v1.png) | [night-home-subject-v1.webp](night-home-subject-v1.webp) |

[generation-manifest.json](generation-manifest.json)에 전체 프롬프트, 참조 이미지, 생성 원본 경로, 크기·해시와 압축 설정을 기록했습니다. PNG에서 WebP로 바꾼 뒤 알파 픽셀이 모두 같은지 확인했습니다. 웹용 두 파일의 합계는 672,906바이트입니다.

[home-artwork.ts](../../../features/rooms/home-artwork.ts)의 `getHomeRoomArtwork`는 현재 v2를 선택하며 **홈의 `RoomCard`에서만** 호출합니다. 기존 배경과 제목은 유지하며 캐릭터 전경 두 개만 덮어 선택합니다. 룸 상세 배너·친구 초상화·공부/리포트의 공통 장면·홈 환영 배너에는 기존 이미지를 사용합니다. 원본 전신 파일은 수정하지 않았습니다.
