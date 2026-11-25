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
| [ReactDrops Showcase Pointer 0.1.0](https://reactdrops.dev) | ReactDrops Component License 1.0 · Copyright (c) 2026 ReactDrops | The home tutorial's coach-mark cursor (「채린」). Installed from the registry item `showcase-pointer` into `src/shared/ui/showcase-pointer/` with its license header in every file and a [LICENSE.txt](../src/shared/ui/showcase-pointer/LICENSE.txt) copy; used only inside this application and not redistributed as a reusable component. Loaded in the tutorial's lazy chunk with GSAP. |
| [Lucide / Feather](https://github.com/lucide-icons/lucide/blob/main/LICENSE) | ISC; MIT for listed Feather-derived icons | Notices for Lucide/Feather SVG outlines used by AnimateIcons are retained in [public/licenses](../public/licenses/lucide-feather-LICENSE.txt). |

React, React DOM, React Router, scheduler, Tailwind CSS and tailwind-merge use MIT licenses. Pretendard and Hahmlet use SIL Open Font License 1.1 terms. Hahmlet is distributed unchanged from the Google Fonts repository; its [original notice](../public/licenses/Hahmlet-OFL.txt) is included. JetBrains Mono is no longer loaded by the application; its prior notice remains as provenance history. Their applicable copyright/license texts are included in [public/licenses](../public/licenses) and copied into the production output.

GSAP's license requires preservation of proprietary notices. A separate public-facing “Powered by GSAP” label is not added; the original library comments and distributed notice remain intact.

User-supplied and generated illustration assets retain their existing provenance manifests.

## Live2D rendering (study room friend)

- **Live2D Cubism Core 5.1.0** — Live2D Proprietary Software License Agreement, "Redistributable Code". Served unchanged from `public/live2d/live2dcubismcore.min.js` (official distribution, original header retained). Source, hash and license links: [Live2D notice](../public/licenses/Live2D-Cubism-NOTICE.txt).
- **Live2D Cubism SDK Framework** (bundled inside the engine below) — Live2D Open Software License. Covered by the same [Live2D notice](../public/licenses/Live2D-Cubism-NOTICE.txt). A Live2D publication license may be required for a commercial release depending on the publisher's scale; check the current terms before release.
- **[untitled-pixi-live2d-engine 1.4.0](https://github.com/Untitled-Story/untitled-pixi-live2d-engine)** — MIT · Copyright (c) 2026 GuangChen2333. [Original notice](../public/licenses/untitled-pixi-live2d-engine-MIT.txt).
- **[PixiJS 8.21.0](https://pixijs.com/)** — MIT · Copyright (c) 2013-2023 Mathew Groves, Chad Engler. [Original notice](../public/licenses/PixiJS-MIT.txt). Its dependencies eventemitter3, ismobilejs, parse-svg-path, @xmldom/xmldom, gifuct-js, js-binary-schema-parser and @pixi/colord are MIT; earcut is ISC; tiny-lru is BSD-3-Clause.
- **[@pixi/sound 6.0.2](https://github.com/pixijs/sound)** — MIT · Copyright (c) 2017 Matt Karl, LLC. Installed as an engine dependency and only loaded for motion sounds or lip sync, which CAPSULE does not use. [Original notice](../public/licenses/PixiSound-MIT.txt).

- **Live2D sample models (user avatars)** — Hiyori PRO, Haru (greeter), Natori PRO, Chitose PRO, Epsilon PRO and Wanko, under the Live2D Free Material License Agreement, license type "Live2D Original Character" ([terms](https://www.live2d.com/ko/learn/sample/model-terms/)). Used unmodified for the avatar picker; the required credit ("본 서비스의 아바타 캐릭터에는 주식회사 Live2D의 저작물이 이용되었습니다.") is shown under the picker in onboarding and account settings. The model files are not in this repository: production serves them from the backend (`GET /api/avatars`), local development from the git-ignored `local-assets/avatars/`.

PixiJS and the engine load while preparing a study session, in a separate `live2d` chunk. Live2D model files come from the backend's storage (`modelJsonUrl`) and are not distributed from this repository.

## Capsule card opening (3D intro)

- **[three.js 0.187.0](https://threejs.org/)** — MIT · Copyright © 2010-2026 three.js authors. [Original notice](../public/licenses/three.js-MIT.txt). Used with its bundled `RoomEnvironment` addon for the capsule opening shown when a capsule card is made from a report. It loads only for that intro, in a separate lazy chunk; no external HDR or model files are used.

## Local camera inference

- **MediaPipe Tasks Vision 1.2.0 and official Face Landmarker float16 v1** — Apache-2.0. [Original license](../public/licenses/vision/MediaPipe-LICENSE.txt). The official bundle contains BlazeFace, FaceMesh V2 and Blendshape V2; model card sources and the unchanged weights are listed in the [model manifest](../public/models/README.md).
- **Official Selfie Segmenter float16 v1** — Apache-2.0, covered by the same [MediaPipe license](../public/licenses/vision/MediaPipe-LICENSE.txt). Used for the camera virtual background; the model card source and the unchanged weights are listed in the [model manifest](../public/models/README.md).
- **Official Gesture Recognizer float16 v1 and EfficientDet-Lite2 float16 v1 (MediaPipe Object Detector)** — Apache-2.0, covered by the same [MediaPipe license](../public/licenses/vision/MediaPipe-LICENSE.txt). Used for study-time wave and phone detection; sources and the unchanged weights are listed in the [model manifest](../public/models/README.md).

Runtime JS/WASM comes from the pinned MediaPipe package without altering library source. YOLO/ONNX models and runtimes are deferred until after MVP and are not distributed.

## Login screen: heatmap logo

- **[Paper Shaders](https://shaders.paper.design) — `@paper-design/shaders-react` 0.0.82 and its dependency `@paper-design/shaders` 0.0.82** — Apache-2.0. The `Heatmap` shader lets light flow inside the capsule of the CAPSULE symbol on the laptop lid of the login screen (`src/features/auth/login-variants/doze/LidHeatmapLogo.tsx`). Used unmodified through its public React component; no Componentry code is used. It is in the production build only as its own lazy chunk, loaded when the login mate's Live2D model is running (not with reduced motion, without WebGL, or while the login mate has no model, which is the case until the login mate API exists). Distributed notices: [Apache-2.0 license](../public/licenses/paper-shaders/LICENSE.txt) and the package [NOTICE](../public/licenses/paper-shaders/NOTICE.txt) (both packages carry the same two files), copied into the production output. The NOTICE reads:

  > Paper Shaders · Copyright 2026 Paper · Powered by Paper Shaders: https://shaders.paper.design
