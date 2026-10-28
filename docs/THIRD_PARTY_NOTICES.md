# Third-party notices

Reviewed on 2026-10-28. This document lists external code, libraries and fonts included in the current CAPSULE application. Commercial-use details are in [REFERENCE_COMMERCIAL_USE.md](REFERENCE_COMMERCIAL_USE.md).

| Source | License | Current use and distributed notice |
| --- | --- | --- |
| [UI Beats](https://github.com/nikhils4/ui-beats/blob/main/LICENSE.md) | MIT | The home banner scratch-to-reveal controller adapts the original Canvas erasure/completion implementation. Original notice is retained beside the source and in [public/licenses](../public/licenses/ui-beats-ScratchToReveal-LICENSE.md). |
| [GSAP 3.15.0](https://gsap.com/community/standard-license/) | Standard No Charge | Animation library imported by the login poster mosaic. Original package notices and [distributed notice](../public/licenses/GSAP-NOTICE.txt) are retained. |
| [Lucide / Feather](https://github.com/lucide-icons/lucide/blob/main/LICENSE) | ISC; MIT for listed Feather-derived icons | Notices for Lucide/Feather-compatible SVG outlines in the local icon set are retained in [public/licenses](../public/licenses/lucide-feather-LICENSE.txt). |

React, React DOM, React Router, scheduler, Tailwind CSS and tailwind-merge use MIT licenses. Pretendard and JetBrains Mono use SIL Open Font License terms. Their applicable copyright/license texts are included in [public/licenses](../public/licenses) and copied into the production output.

GSAP's license requires preservation of proprietary notices. A separate public-facing “Powered by GSAP” label is not added; the original library comments and distributed notice remain intact.

User-supplied and generated illustration assets retain their existing provenance manifests.

## Local camera inference

- **MediaPipe Tasks Vision 1.2.0 and official Face Landmarker float16 v1** — Apache-2.0. [Original license](../public/licenses/vision/MediaPipe-LICENSE.txt). The official bundle contains BlazeFace, FaceMesh V2 and Blendshape V2; model card sources and the unchanged weights are listed in the [model manifest](../public/models/README.md).

Runtime JS/WASM comes from the pinned MediaPipe package without altering library source. YOLO/ONNX models and runtimes are deferred until after MVP and are not distributed.
