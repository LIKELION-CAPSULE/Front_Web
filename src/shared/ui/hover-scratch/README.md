# Hover Scratch Carousel

[UI Beats Scratch to Reveal](https://uibeats.com/docs/component/scratch-to-reveal)의 Canvas `destination-out` 지우기와 면적 기반 완료 방식을 참고한 이미지 배너입니다. 클릭·드래그를 요구하지 않고 마우스 이동만으로 현재 이미지와 그 위의 HTML 대사가 함께 지워져 아래의 다음 이미지와 대사가 보입니다. 완료 기준을 넘으면 커지는 지우개가 남은 조각을 제거하고 다음 배너를 현재 배너로 확정합니다. 마지막 이미지는 첫 이미지로 이어집니다.

```tsx
<HoverScratchCarousel
  slides={welcomeBanners}
  labelledBy="welcome-title"
  className="welcome-hero"
  brushSize={56}
  threshold={0.4}
  completionDuration={460}
  renderSlide={(slide) => <YourPerSlideHTML slide={slide} />}
>
  {({ index, select }) => <YourHTMLCopyAndAccessibleControls index={index} select={select} />}
</HoverScratchCarousel>
```

위 코드는 연결 형태를 설명하는 예시이며 실제 연결은 `features/rooms/components/StudyWelcomeBanner.tsx`입니다. `slides`에는 `id`, `src`, `label`이 필요하며 배열은 모듈 상수나 memo로 안정적으로 유지합니다. HTML 제목·첫 방문/이어하기 문구·버튼은 고정 콘텐츠로 유지합니다. `renderSlide`로 넘긴 HTML은 해당 이미지와 한 레이어로 묶여 함께 지워집니다. `renderOverlay`는 지워지지 않는 공통 오버레이가 필요할 때 사용합니다. `data-scratch-ignore` 영역과 링크·버튼·입력창 위에서는 지우지 않습니다.

| 조절값 | 기본값 | 의미 |
| --- | --- | --- |
| `brushSize` | 56 | CSS px 기준 지우개 반경 |
| `threshold` | 0.4 | 실제 알파가 지워진 비율, 40% |
| `completionDuration` | 460 | 남은 조각을 지우는 시간(ms) |

마스크는 **512×256**의 작은 Canvas에서 관리하며 포인터가 지나간 면적의 알파를 계산합니다. 같은 자리를 여러 번 문질러도 중복 면적으로 세지 않습니다. 한 프레임에 한 번 작은 알파 비트맵을 PNG로 인코딩해 현재 슬라이드의 CSS `mask-image`에 적용합니다. 이미지·그라디언트·유리 대사의 배경/테두리/글자를 모두 같은 마스크로 잘라 서로 남거나 어긋나지 않습니다. 원본 이미지는 일반 HTML `<img>`로 표시하므로 큰 이미지 캔버스와 별도의 DPR 제한은 사용하지 않습니다. 포인터 입력마다 React 상태를 갱신하지 않고, 화면 크기를 바꿔도 지운 영역의 상대 좌표를 유지합니다.

슬라이드는 `다음 이미지 + 다음 대사` 아래에 `현재 이미지 + 현재 대사`를 겹칩니다. 다음 대사는 현재 슬라이드에 가려져 있다가 지워진 자리에서만 보입니다. 수동 선택·완료·모션 감소 전환 시 이전 슬라이드의 마스크를 제거하므로, 같은 배너가 다음 순서로 돌아와도 구멍이 남지 않습니다. 대사는 HTML로 편집하며 초상화·이름·말풍선 꼬리는 표시하지 않습니다. 접근성 이름으로 화자를 보존합니다. 비활성 슬라이드는 `aria-hidden`으로 중복 낭독하지 않습니다.

유리 질감은 반투명 네이비 그라디언트, 18px 배경 블러와 125% 채도, 가는 하이라이트 테두리로 구성합니다. 필터 미지원 시 더 진한 반투명 표면을 사용합니다. 문구와 색은 `CompanionGreeting`·`styles/welcome.css`에서 수정합니다.

모든 목적지 이미지를 decode한 뒤 지우기를 활성화하므로 빈 배너가 드러나지 않습니다. 이미지 로딩 전·Canvas 또는 CSS 마스크 미지원/손실은 현재 이미지로 대체합니다. 전환 후 650ms 동안 새 지우기를 받지 않으며, 이후에도 새로운 마우스 이동이 있어야 다시 시작합니다. 일반적인 시간 기반 자동 슬라이드는 없습니다. 선택 버튼은 진행 중인 지우기와 완료 애니메이션을 취소하고 지정 이미지를 표시합니다.

768px 이상, hover/fine 마우스, 모션 감소가 꺼진 조건에서 활성화합니다. 모바일·터치·모션 감소에서는 정지 이미지와 키보드/터치 선택 버튼을 사용합니다. 터치 캡처나 `touch-action: none`을 설정하지 않아 스크롤을 유지합니다. 언마운트와 이미지 선택 시 RAF·이벤트·ResizeObserver를 정리합니다.

## 출처

- [공식 원본 소스](https://github.com/nikhils4/ui-beats/blob/main/components/demo/component/scratch-to-reveal.tsx), [해시 기록](upstream.json).
- [UI Beats MIT 고지](LICENSE.md), 배포용 동일 고지 [public/licenses](../../../../public/licenses/ui-beats-ScratchToReveal-LICENSE.md).
- 원본의 포일·라벨·포인터 캡처·Motion 페이드는 사용하지 않습니다. 현재/다음 이미지 합성, 호버 입력, 면적 마스크, 남은 조각의 원형 지우기, 반복과 반응형 처리는 프로젝트에 맞춰 구현했습니다. 추가 npm 의존성은 없습니다.
- [생성한 배너와 프롬프트](../../../assets/welcome-banners/README.md).

## 구현 참고

- [CSS mask-image · MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image)
- [backdrop-filter · MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)

## 검증

린트·TypeScript/Vite 빌드·단위 테스트 **17개**, 격리 Chromium의 브라우저 검사 **70항목**을 통과했습니다. 지워진 대사의 글자·테두리 영역이 실제 다음 슬라이드와 픽셀 차이 0으로 일치했습니다. 1440/1024/768/390/320px, 순환·마스크 해제·키보드·터치·모션 감소·미지원 대체·첫 방문/이어하기를 확인했습니다. 작은 마스크의 PNG 인코딩은 256회 측정에서 중앙값 약 0.6ms, 95백분위 약 0.8ms였습니다. 전체 프레임 시간이 아닌 인코딩 구간만의 측정입니다. [검증 항목과 수치](validation.json). 예전 이미지 캔버스의 cover 계산은 더 이상 사용하지 않아 해당 코드와 단위 테스트를 제거했습니다. 면적 계산과 완료 반경 테스트는 유지합니다.
