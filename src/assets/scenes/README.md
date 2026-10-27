# 수정 가능한 공부 공간 에셋 9종

메인화면의 룸 카드와 환영 영역은 **바닥 배경 → 앉은 전신 캐릭터/그룹 → 음영 → 제목** 순으로 합성하고 책상을 표시하지 않습니다. 다른 공부·상세·리포트 장면은 **배경 → 전신 캐릭터/그룹 → 책상 → 음영 → 제목** 순서입니다. 이전의 상반신 전경 대신 [전신·책상 에셋](layered-v2/README.md)을 사용해 몸이 파일 끝에서 끊기는 문제를 보완했습니다. 첫 룸의 캐릭터 전경에는 **수아·채린·다희 세 명**이 모두 들어 있습니다.

## 현재 에셋

메인화면 전용 배경 9종은 [seated-v1/](seated-v1/README.md)에 있습니다. 아래 표의 배경과 책상은 공부 장면용이며, 전신 캐릭터는 두 구도에서 재사용합니다.

| 장면 ID | 배경 | 전신 전경 | 책상 |
| --- | --- | --- | --- |
| `classroom` | `classroom-background-v1` | `layered-v2/classroom-fullbody-v3` | 밝은 나무 |
| `night` | `night-background-v1` | `layered-v2/night-fullbody-v2` | 어두운 나무 |
| `cat` | `cat-background-v1` | `layered-v2/cat-fullbody-v2` | 밝은 나무 |
| `lantern` | `lantern-background-v1` | `layered-v2/lantern-fullbody-v2` | 어두운 나무 |
| `fantasy` | `fantasy-background-v1` | `layered-v2/fantasy-fullbody-v2` | 어두운 나무 |
| `iljin` | `iljin-background-v1` | `layered-v2/iljin-fullbody-v3` | 밝은 나무 |
| `jurassic` | `jurassic-background-v1` | `layered-v2/jurassic-fullbody-v2` | 밝은 나무 |
| `lab` | `lab-background-v1` | `layered-v2/lab-fullbody-v2` | 작업대 |
| `joseon` | `joseon-background-v1` | `layered-v2/joseon-fullbody-v2` | 어두운 나무 |

각 `.png`는 생성 마스터, `.webp`는 실제 표시용 압축본입니다. 원본 포스터·이전 전경·배경은 보관합니다. 새 전신 9개와 공통 책상 3개는 **built-in image_gen**으로 만들었으며, [전체 생성 프롬프트·참조 원본·규격·해시](layered-v2/generation-manifest.json)와 [경계·알파 검사](layered-v2/layer-validation.json)를 보관합니다. 캐릭터의 얼굴·헤어·의상을 원본에 가깝게 보존하도록 지시한 재생성 파생 그림입니다.

- **배경:** 메인은 `seated-v1/`의 책상 없는 바닥 배경을, 공부 장면은 인물과 큰 제목을 제거한 기존 가로 환경 이미지를 사용합니다. 환경 안의 책상·책은 배경에 남아 있고, 근경에서 몸을 가리는 책상은 별도 전경입니다.
- **전신 전경:** 인물·동물의 완전한 몸과 발·옷자락을 포함합니다. 메인화면에서는 도윤 기준으로 앉은 캐릭터를 확대해 오른쪽 아래에 두고 발끝을 조금 자르며, 공부 장면에서는 앞쪽 책상이 하체를 가립니다.
- **책상:** 위쪽은 투명하고 아래쪽은 연속된 표면으로 채운 3개 이미지를 분위기가 맞는 룸들에서 재사용합니다.
- **제목:** [포스터 서체 제목 9종](../room-titles/README.md)을 별도로 배치합니다. 실제 이름 문자열도 검색과 접근성을 위해 유지합니다.
- **초상화/이름/저장:** 카드 위의 별도 DOM UI입니다.

## 합성과 사용

```tsx
<RoomArtwork roomId="dawn-library" variant="seated" />
<RoomArtwork roomId="fantasy" variant="welcome" />
<RoomArtwork roomId="joseon" variant="fullbody" />
```

[sceneArtwork](../../features/rooms/artwork.ts)가 장면·전신 크기·표면 접점·책상 목록을 관리합니다. `dawn-library`·`room-2`·`room-3`은 각각 `classroom`·`night`·`cat`의 별칭입니다. [composition.ts](../../features/rooms/composition.ts)의 설정을 공통 `RoomArtwork`와 Canvas의 `drawRoomLayers`가 공유하므로, 캡슐 카드 저장에서도 **배경 → 캐릭터 → 책상** 순서와 배치가 같습니다. `seated`와 메인 환영 영역의 `welcome`은 전용 배경을 선택하고 책상을 생략합니다. `welcomeLayout`은 말풍선 영역을 고려한 개별 배치 보정입니다.

룸 목록과 구성원은 `features/rooms/data/rooms.ts`, 원본 포스터 목록은 `features/rooms/posters.ts`에서 관리합니다. 개별 캐릭터의 표정 이미지·초상화 창은 `features/characters/artwork.ts`와 `CharacterArtwork`를 통해 별도로 사용합니다. 로그인 격자는 원본 포스터를 유지합니다.

## 미리보기와 수정

`Front_Web`에서 `npm run dev` 후 **`/src/assets/scenes/preview.html`**을 엽니다. **메인화면 구도**를 켜고 끄며 배경·캐릭터·책상·제목을 독립적으로 확인하고, 가로 16:9 / 카드 4:3 / 세로 3:4로 비교합니다. **전신 확인**에서는 책상과 제목을 숨기고 발까지 프레임 안에 표시합니다.

1. 캐릭터를 바꾸려면 새 투명 PNG/WebP를 만들고 `subject`·`subjectSize`·`subjectLayout`을 수정합니다. 메인 표시 크기·중심·발 기준선은 `seatedLayout`으로 따로 조정합니다.
2. 책상을 바꾸려면 `desk`와 `deskSurface`를 함께 수정합니다. 표면 접점과 안전 여백 설명은 [전신·책상 편집 가이드](layered-v2/README.md)를 참고합니다.
3. 메인 배경은 `seatedBackground`, 공부 장면 배경은 `background`를 교체합니다.
4. 제목은 `titleImage`·`titleImageSize`와 실제 `title`·룸 `name`을 함께 갱신합니다.
5. `cwebp -q 88 -alpha_q 100 -m 6`으로 웹용 파일을 만들고 마스터·프롬프트·알파 검사 결과도 보관합니다.

이전 배경/상반신 세트의 [생성 기록](generation-manifest.json)과 [검사 기록](layer-validation.json)은 과거 버전 자료로 유지합니다. 현재 전신/책상 검사는 `layered-v2/`에 있습니다.
