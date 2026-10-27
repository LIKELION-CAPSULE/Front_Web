# 히어로 배경의 Halftone Reveal

> 이전 시안 보관용입니다. 현재 메인 배너에서는 사용하지 않으며 `RoomArtwork`의 연결도 제거했습니다. 현재 구현은 [Hover Scratch Carousel](../hover-scratch/README.md)입니다. 아래 설정·검증은 이전 시점의 기록입니다.

메인 히어로의 배경에만 사용하는 포인터 효과입니다. 배경 PNG/WebP 위에 셰이더를 겹치며, 캐릭터·말풍선·제목은 기존 DOM 레이어를 유지합니다. 원본 이미지는 항상 아래에 남아 있습니다.

## 출처

- [React Bits 데모·설정](https://reactbits.dev/animations/halftone-reveal)
- [공식 TypeScript/Tailwind 소스](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Animations/HalftoneReveal/HalftoneReveal.tsx)
- 고정한 원본 파일 해시와 라이선스 해시: [upstream.json](upstream.json)
- David Haz 저작권·전체 조건: [LICENSE.md](LICENSE.md). 배포 빌드에도 [public/licenses](../../../../public/licenses/react-bits-HalftoneReveal-LICENSE.md)의 동일 고지를 포함합니다.

공식 소스를 앱 안에서 사용하는 파생 구현입니다. 별도 npm 의존성을 추가하지 않았습니다.

## 연결과 설정

```tsx
<RoomArtwork roomId={room.id} variant="welcome" backgroundEffect="halftone" eager />
```

`backgroundEffect`를 생략한 룸 카드·상세·공부 화면은 캔버스를 만들지 않습니다. `HalftoneBackground.tsx`가 원본 렌더러를 감싸고, 현재 설정과 활성 조건을 관리합니다.

| 설정 | 값 |
| --- | --- |
| 기본 상태 | 원본 이미지 (`reverse`) |
| 색 | 네이비 `#171925`, 라벤더 `#c8b4ed` |
| 점 간격·각도 | 4.5px · 45도 |
| 포인터 반경·경계 | 120px · softness 0.72 |
| 잔상 | linger 0.38초 |
| 배경 합성 불투명도 | 0.58 |
| 자동 이동·클릭 파동·초기 프린트 | 사용하지 않음 |
| 최대 픽셀 비율 | 1.5 |

데스크톱 768px 이상, hover/fine 포인터, 모션 감소가 꺼진 조건에서만 캔버스를 만듭니다. 터치만 사용하는 기기·모바일·모션 감소 설정에서는 원본 이미지로 표시합니다. 렌더 준비 전, WebGL2 미지원, 컨텍스트 손실 때에도 원본 이미지가 보입니다.

## 원본 대비 조정

- 엄격한 TypeScript와 배열 인덱스 검사에 맞춘 유니폼 키·버퍼 튜플·색 채널 타입.
- 외부 기본 이미지 제거. 소비자가 로컬 `src`를 명시합니다.
- 불투명 배경의 색이 지워지지 않도록 자동 매트 제거를 끕니다.
- 렌더 준비 콜백과 컨텍스트 손실 처리, 부분 컴파일 실패 시 리소스 해제.
- 확대된 배경에서도 포인터가 맞도록 변환된 화면 좌표를 셰이더 좌표로 환산.
- DPR 상한을 낮추고, 부모의 매초 상태 갱신으로 불필요하게 렌더러가 깨어나지 않도록 래퍼를 memo 처리.
- 원본의 화면 밖·숨겨진 탭 일시정지와 언마운트 시 GPU 리소스·관찰자·이벤트 정리를 유지.

모바일 동작이나 밝기를 바꾸려면 래퍼와 `halftone.css`를 조정합니다. 포인터 이벤트는 장식 배경에만 연결되며 링크·버튼·말풍선을 가로막지 않습니다.

## 확인 결과

- 린트·TypeScript/Vite 빌드·기존 상태 및 배치 테스트 15개 통과.
- 실제 화면의 포인터 반응·복원·GPU 유휴 상태·화면 이동·모바일·터치·모션 감소·WebGL 미지원·컨텍스트 손실 처리 17항목 통과.
- 배경 픽셀 변화가 발생하는 동안 캐릭터 내부와 대사 영역의 변화는 확인되지 않았고, 포인터가 떠난 뒤 초기 화면과의 픽셀 차이는 0으로 복원됐습니다.
- 9개 룸의 이미지 교체·정상 렌더 준비·기존 대사/행동과 작은 화면의 고양이 배치 등 26항목 통과.
