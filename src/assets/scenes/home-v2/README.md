# 홈 룸 카드 전용 캐릭터 v2

2026-10-28 · **built-in image_gen**으로 원본 포스터를 직접 참조해 두 룸의 캐릭터 전경을 재생성했습니다. 포스터의 얼굴·헤어·복장·조명을 살리고, 의자 없이 바닥에 다리를 단정히 모아 앉은 자세를 사용합니다.

| 룸 | PNG 마스터 | 표시용 WebP |
| --- | --- | --- |
| 쌀쌀맞은 갸루짝꿍이 나에게만 친절하다! | [classroom-home-subject-v2.png](classroom-home-subject-v2.png) | [classroom-home-subject-v2.webp](classroom-home-subject-v2.webp) |
| 전교 1등을 이겨라 | [night-home-subject-v2.png](night-home-subject-v2.png) | [night-home-subject-v2.webp](night-home-subject-v2.webp) |

교실은 수아의 체크 조끼·흰 셔츠, 채린의 흰 셔츠·검은 타이, 다희의 검은 줄무늬가 있는 흰 소매를 유지합니다. 도윤은 원본의 검은 가디건·흰 셔츠·줄무늬 타이와 푸른 야간 조명을 유지합니다. 의자·책상·배경·제목은 캐릭터 전경에 포함하지 않습니다.

[generation-manifest.json](generation-manifest.json)에 전체 프롬프트, 원본 포스터·생성 파일 경로, 크기·해시·압축 설정을 기록했습니다. PNG와 WebP의 알파 픽셀은 일치하며 웹용 두 파일의 합계는 725,696바이트입니다.

[home-artwork.ts](../../../features/rooms/home-artwork.ts)의 `getHomeRoomArtwork`를 사용하는 홈 카드 두 개만 이 파일을 선택합니다. 다른 일곱 홈 카드와 룸 상세·친구·공부·리포트·환영 배너는 기존 이미지를 사용합니다. 이전 [의자 버전 v1](../home-v1/README.md)은 비교 기록으로 보관합니다.
