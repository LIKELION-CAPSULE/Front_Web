# 메인 환영 배너 3종

2026-10-27, **built-in imagegen (`image_gen.imagegen`)**으로 생성했습니다. 포스터 확대 대신 메인 배너에 맞춰 새로 구성한 3:1 일러스트입니다. 원본 PNG는 2172×724, 웹에서는 WebP를 사용합니다. 기존 캐릭터의 얼굴·머리·의상을 참조했습니다.

| 파일 | 캐릭터 | 분위기 | 웹 파일 |
| --- | --- | --- | --- |
| `chaerin-banner-v1.png` | 채린 | 따뜻한 노을빛 교실 | 약 156KiB |
| `sua-banner-v1.png` | 수아 | 비 오는 도서관, 차분한 청색 | 약 168KiB |
| `dahee-banner-v1.png` | 다희 | 보랏빛 도시 야경의 스터디룸 | 약 158KiB |

텍스트·버튼·대사는 그림에 합치지 않았습니다. 왼쪽은 HTML 문구를 위한 어두운 여백, 오른쪽은 인물과 공부 공간으로 구성했습니다. 큰 문구는 `features/rooms/welcome-copy.ts`, 버튼은 `features/rooms/components/StudyWelcomeBanner.tsx`, 이미지 순서와 대사는 `features/rooms/welcome-banners.ts`, 배치와 명암 오버레이는 `styles/welcome.css`에서 바꿉니다. 이 배너는 룸 카드의 기존 배경/전신/책상 레이어와 독립적으로 사용합니다.

[generation-manifest.json](generation-manifest.json)에 세 이미지의 **전체 생성 프롬프트**, 참조 이미지 역할, 생성 방식, 실제 해상도, 파일 해시를 보관했습니다. 사용자의 첨부 배너는 구도 참고, `kang-study.webp`·`han-study.webp`·`ryu-study.webp`는 각각 인물 정체성 참고입니다. 원본 생성 파일은 삭제하지 않고 작업 폴더로 복사했습니다.

수정 시 PNG 마스터를 보존하고 `v2`처럼 새 버전을 생성한 뒤 WebP를 연결하세요. 웹용 변환은 `cwebp -q 88 -m 6 원본.png -o 결과.webp`입니다. [호버 지우기 컴포넌트](../../shared/ui/hover-scratch/README.md)에서 전환 기준과 순환 동작을 확인할 수 있습니다.
