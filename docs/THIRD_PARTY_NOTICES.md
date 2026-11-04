# Third-party notices

Reviewed on 2026-11-05. This document lists external code, libraries and fonts included in the current CAPSULE application. Commercial-use details are in [REFERENCE_COMMERCIAL_USE.md](REFERENCE_COMMERCIAL_USE.md).

| Source | License | Current use and distributed notice |
| --- | --- | --- |
| [AnimateIcons Lucide](https://animateicons.in/icons/lucide) | MIT · Copyright (c) 2025 Avijit Dey; Lucide ISC / Feather MIT | 41 official icon sources with their original SVG and Motion variants, adapted to inline spans and the local helper. [Pinned source hashes](../src/shared/ui/animate-icons/upstream.json), [MIT](../public/licenses/AnimateIcons-MIT.txt), [Lucide/Feather notices](../public/licenses/AnimateIcons-Lucide-NOTICES.md). |
| [Tween UI Number Counter](https://tween-ui.vercel.app/component/number-counter) | MIT · Copyright (c) 2026 StaticMania | Local GSAP/NumberFlow counter with accessibility and reduced-motion adaptations. [Source hashes](../src/shared/ui/number-counter/upstream.json), [distributed MIT](../public/licenses/TweenUI-MIT.txt). |
| [NumberFlow 0.6.2](https://github.com/barvian/number-flow) | MIT · Copyright (c) 2024 Maxwell Barvian | Report number rolling. [Original notice](../public/licenses/NumberFlow-MIT.txt). `esm-env` is MIT, [original notice](../public/licenses/esm-env-MIT.txt). |
| [Motion 14.9.1](https://motion.dev/) | MIT · Motion B.V.; Framer B.V. | AnimateIcons animation runtime, including motion-dom/motion-utils/framer-motion. [Motion notice](../public/licenses/Motion-MIT.txt), [Framer notice](../public/licenses/FramerMotion-MIT.txt). |
| [UI Beats](https://github.com/nikhils4/ui-beats/blob/main/LICENSE.md) | MIT | The home banner scratch-to-reveal controller adapts the original Canvas erasure/completion implementation. Original notice is retained beside the source and in [public/licenses](../public/licenses/ui-beats-ScratchToReveal-LICENSE.md). |
| [GSAP 3.15.0](https://gsap.com/community/standard-license/) | Standard No Charge | Animation library used by the login poster mosaic and report counters. The `@gsap/react` 2.1.2 helper retains its [original notice](../public/licenses/GSAP-React-NOTICE.txt). Original package notices and [distributed notice](../public/licenses/GSAP-NOTICE.txt) are retained. |
| [Lucide / Feather](https://github.com/lucide-icons/lucide/blob/main/LICENSE) | ISC; MIT for listed Feather-derived icons | Notices for Lucide/Feather SVG outlines used by AnimateIcons are retained in [public/licenses](../public/licenses/lucide-feather-LICENSE.txt). |

React, React DOM, React Router, scheduler, Tailwind CSS and tailwind-merge use MIT licenses. Pretendard and Hahmlet use SIL Open Font License 1.1 terms. Hahmlet is distributed unchanged from the Google Fonts repository; its [original notice](../public/licenses/Hahmlet-OFL.txt) is included. JetBrains Mono is no longer loaded by the application; its prior notice remains as provenance history. Their applicable copyright/license texts are included in [public/licenses](../public/licenses) and copied into the production output.

GSAP's license requires preservation of proprietary notices. A separate public-facing “Powered by GSAP” label is not added; the original library comments and distributed notice remain intact.

User-supplied and generated illustration assets retain their existing provenance manifests.

## Local camera inference

- **MediaPipe Tasks Vision 1.2.0 and official Face Landmarker float16 v1** — Apache-2.0. [Original license](../public/licenses/vision/MediaPipe-LICENSE.txt). The official bundle contains BlazeFace, FaceMesh V2 and Blendshape V2; model card sources and the unchanged weights are listed in the [model manifest](../public/models/README.md).
- **Official Selfie Segmenter float16 v1** — Apache-2.0, covered by the same [MediaPipe license](../public/licenses/vision/MediaPipe-LICENSE.txt). Used for the camera virtual background; the model card source and the unchanged weights are listed in the [model manifest](../public/models/README.md).
- **Official Gesture Recognizer float16 v1 and EfficientDet-Lite2 float16 v1 (MediaPipe Object Detector)** — Apache-2.0, covered by the same [MediaPipe license](../public/licenses/vision/MediaPipe-LICENSE.txt). Used for study-time wave and phone detection; sources and the unchanged weights are listed in the [model manifest](../public/models/README.md).

Runtime JS/WASM comes from the pinned MediaPipe package without altering library source. YOLO/ONNX models and runtimes are deferred until after MVP and are not distributed.
