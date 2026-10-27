# 전신 캐릭터와 책상 전경

2026-10-27 · **built-in image_gen**으로 원본 포스터를 참조해 전신 캐릭터/그룹 9종과 책상 전경 3종을 만들었습니다. 포스터의 얼굴·헤어·의상·표정을 보존하도록 지시한 파생 그림이며, 각각 선택한 PNG 마스터와 웹용 WebP를 보관합니다. 기존 배경·상반신 전경·원본 포스터는 덮어쓰지 않았습니다.

| 장면 | 전신 파일 | 구성 | 책상 |
| --- | --- | --- | --- |
| `classroom` | `classroom-fullbody-v3` | 수아 · 채린 · 다희 | `desk-light-v1` |
| `night` | `night-fullbody-v2` | 도윤 | `desk-dark-v1` |
| `cat` | `cat-fullbody-v2` | 모루 | `desk-light-v1` |
| `lantern` | `lantern-fullbody-v2` | 세 명의 군인/의무관 | `desk-dark-v1` |
| `fantasy` | `fantasy-fullbody-v2` | 에이든 · 엘리아 · 레온 | `desk-dark-v1` |
| `iljin` | `iljin-fullbody-v3` | 민하준 | `desk-light-v1` |
| `jurassic` | `jurassic-fullbody-v2` | 유리와 공룡 네 마리 | `desk-light-v1` |
| `lab` | `lab-fullbody-v2` | 코튼 · 핑키 · 라임 | `desk-workshop-v1` |
| `joseon` | `joseon-fullbody-v2` | 설아 · 연화 · 봄이 | `desk-dark-v1` |

`.png`는 생성 마스터, `.webp`는 실제 표시용입니다. 캐릭터/그룹에는 완전한 하체·옷자락·발 또는 발바닥을 포함하고, 투명 안전 여백을 둡니다. 책상은 위쪽이 투명하고 표면부터 화면 아래쪽까지 이어지는 전경 띠입니다. 소품이 없는 책상 세 가지를 톤이 맞는 룸들에서 재사용합니다.

- [원본 경로·전체 프롬프트·생성 도구·파일 크기·해시](generation-manifest.json)
- [실제 알파·몸 경계·책상 표면 위치·PNG/WebP 비교](layer-validation.json)

12개 모두 PNG와 WebP의 알파 픽셀 차이가 0입니다. 전신 9개 모두 불투명한 몸이 캔버스 경계에 닿지 않으며, 책상 3개는 아래쪽을 빈틈없이 채웁니다. 선택된 웹용 파일 합계는 약 3.5MiB입니다.

채린의 가운데 다리는 v3에서 꼬지 않은 자세로 수정했습니다. [수정 프롬프트](classroom-fullbody-v3-generation.json)와 이전 v2 마스터를 함께 보관합니다.

## 합성 방식

공통 [RoomArtwork](../../../features/rooms/components/RoomArtwork.tsx)가 **배경 → 전신 캐릭터 → 책상 → 음영 → 제목** 순으로 배치합니다. 메인화면에서는 `variant="seated"`로 [책상 없는 바닥 배경](../seated-v1/README.md) 위에 전신을 배치하며 책상을 생략합니다. 메인 배치는 도윤의 크기를 기준으로 그룹도 확대하며, 발끝이 조금 프레임 아래로 내려갑니다. `seatedLayout`으로 룸별 폭·중심·발 기준선·최대 높이를 따로 조정합니다. 초상화/이름과 저장 버튼은 그 위의 별도 UI입니다.

[sceneArtwork](../../../features/rooms/artwork.ts)의 `subjectSize`는 PNG의 원래 크기, `subjectLayout`은 표시 폭·중심·팔/발의 접점·최대 높이입니다. `deskSurface`에는 책상 이미지에서 실제 표면이 시작하는 높이 비율을 기록합니다. 같은 [composition.ts](../../../features/rooms/composition.ts)의 설정을 CSS와 Canvas 내보내기가 공유합니다.

화면이 좁아지면 캐릭터 전체의 가로폭을 줄이고 얼굴·머리·양옆 인물은 프레임 안에 둡니다. 발이 프레임 아래로 내려가는 공부 장면에서는 앞쪽 책상이 먼저 몸을 가리므로, 상반신 파일 끝이 갑자기 잘려 보이는 경계가 생기지 않습니다. 세로·리포트는 별도의 표면 높이를 쓰고, 상세 배경은 오른쪽에 캐릭터를 모읍니다. 작은 포인터 이동에서도 책상은 고정됩니다.

공부 장면의 원본 배경 안 책상과 책은 환경의 일부로 유지되며, 캐릭터 앞쪽을 가리는 근경 책상은 새 전경 이미지입니다. 캐릭터별 표정 이미지·포스터 기반 개별 초상화와 룸 장면의 전신 그룹은 별도 에셋입니다.

## 확인과 교체

개발 서버의 `/src/assets/scenes/preview.html`에서 **메인화면 구도**를 끄면 책상이 있는 공부 장면을 확인합니다. **배경 / 캐릭터 전경 / 책상 전경 / 제목**을 독립적으로 켜고 끕니다. **전신 확인**을 켜면 책상·제목을 숨기고 발까지 전부 프레임 안에 넣습니다. 가로 16:9, 카드 4:3, 세로 3:4에서 비교할 수 있습니다.

캐릭터를 바꾸려면 새 투명 PNG/WebP와 크기를 등록하고 `subjectLayout.anchor`를 팔/발의 표면 접점에 맞춥니다. 책상을 바꾸려면 `desk`와 `deskSurface`를 함께 바꿉니다. 압축은 `cwebp -q 88 -alpha_q 100 -m 6`을 사용합니다. 원본·프롬프트·경계와 알파 검사 결과도 같이 보관합니다.
