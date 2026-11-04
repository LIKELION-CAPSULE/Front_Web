# 사용 중인 외부 코드·라이브러리의 상업 이용

확인일: **2026-11-05, 한국 시간**. 현재 서비스에 포함된 외부 소스·라이브러리·폰트만 기록합니다.

| 사용 대상 | 공식 조건 | 현재 적용 |
| --- | --- | --- |
| AnimateIcons Lucide | [MIT](https://github.com/Avijit07x/animateicons/blob/main/LICENSE) 및 원본 Lucide ISC/Feather MIT, 권리 표시 보존 | 41종의 공식 SVG·모션을 로컬 적용했습니다. [고정 출처/해시](../src/shared/ui/animate-icons/upstream.json), [MIT](../public/licenses/AnimateIcons-MIT.txt), [Lucide/Feather 고지](../public/licenses/AnimateIcons-Lucide-NOTICES.md)를 배포합니다. |
| Tween UI Number Counter | [MIT](https://github.com/StaticMania/tween-ui/blob/main/LICENSE), 권리 표시 보존 | 공식 소스의 GSAP·NumberFlow 숫자 롤링을 리포트에 적용하고 [해시/변경 범위](../src/shared/ui/number-counter/upstream.json), [원문](../public/licenses/TweenUI-MIT.txt)을 보존합니다. |
| NumberFlow 0.6.2·Motion 14.9.1 | 설치 패키지 MIT, 권리 표시 보존 | 카운터·아이콘에 사용하며 [NumberFlow](../public/licenses/NumberFlow-MIT.txt)·[Motion](../public/licenses/Motion-MIT.txt)·[Framer](../public/licenses/FramerMotion-MIT.txt)·[esm-env](../public/licenses/esm-env-MIT.txt) 원문을 배포합니다. |
| UI Beats Scratch to Reveal | [MIT](https://github.com/nikhils4/ui-beats/blob/main/LICENSE.md). 상업 사용 가능, 저작권·허가문 보존 | 홈 배너의 지우기 컨트롤러를 원본 기반으로 수정했습니다. 소스 옆과 [배포 고지](../public/licenses/ui-beats-ScratchToReveal-LICENSE.md)에 원본 고지를 유지합니다. |
| GSAP 3.15.0 | [Standard No Charge](https://gsap.com/community/standard-license/). 상업 앱 사용 가능, 원본 권리 표시 보존. 경쟁 시각 애니메이션 빌더 등의 용도는 제한 | 로그인 포스터·리포트 숫자 애니메이션에서 사용합니다. `@gsap/react` 2.1.2의 [원문 고지](../public/licenses/GSAP-React-NOTICE.txt)도 배포합니다. 원본 코드 주석과 [배포 고지](../public/licenses/GSAP-NOTICE.txt)를 유지합니다. |
| Lucide / Feather 계열 SVG 윤곽 | [Lucide ISC 및 Feather 파생 MIT](https://github.com/lucide-icons/lucide/blob/main/LICENSE). 상업 사용 가능, 저작권·허가문 보존 | 로컬 아이콘의 해당 윤곽을 위한 [배포 고지](../public/licenses/lucide-feather-LICENSE.txt)를 유지합니다. |
| React·React DOM·React Router·scheduler·Tailwind CSS·tailwind-merge | 설치 패키지의 MIT | 해당 라이브러리를 실제 사용하며 원문 고지를 배포 폴더에 포함합니다. |
| Pretendard·Hahmlet | SIL OFL 1.1 | 공식 원본 폰트를 자체 호스팅하고 원문 고지를 배포 폴더에 포함합니다. Hahmlet은 [공식 Google Fonts 배포본](https://github.com/google/fonts/tree/main/ofl/hahmlet)을 수정 없이 사용하며 [OFL 고지](../public/licenses/Hahmlet-OFL.txt)를 포함합니다. JetBrains Mono는 현재 앱에서 사용하지 않으며 과거 고지만 보존합니다. |

GSAP는 외부 라이브러리가 맞습니다. 라이브러리 사용에도 그 라이선스가 적용되므로 원본의 저작권·라이선스 표시는 보존합니다. 공식 약관에는 별도의 서비스 화면에 사용 문구나 로고를 추가하라는 요구가 없습니다. 프로젝트의 고지 문서와 `public/licenses` 파일은 배포물의 출처·이용 조건을 관리하기 위해 유지합니다.

실제 배포 고지 목록은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), 원문 파일은 [public/licenses](../public/licenses)에 있습니다.

## 브라우저 얼굴 감지

| 사용 대상 | 공식 조건 | 현재 적용 |
| --- | --- | --- |
| MediaPipe Tasks Vision 1.2.0 및 Face Landmarker float16 v1 | Apache-2.0. 상업 이용 가능, 원문 라이선스·권리 표시 유지 | 공식 `.task`와 패키지 JS/WASM을 자체 호스팅합니다. 구성 모델 3개의 공식 모델 카드·원본 URL·해시는 [모델 문서](../public/models/README.md)에 기록합니다. |

MVP는 MediaPipe만 사용합니다. YOLO 기반 휴대폰 감지는 MVP 이후로 미뤘으며, 관련 가중치·런타임·의존성과 사용 고지를 배포물에서 제거했습니다. 사용 중인 MediaPipe의 Apache-2.0 원문 고지는 유지합니다.
