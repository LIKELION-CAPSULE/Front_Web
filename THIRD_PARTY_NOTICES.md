# Third-party notices and UI reference review

Reviewed on 2026-10-27 for the CAPSULE study application. A commercial application is different from selling a component library or a visual animation builder; the permissions below are for this application's use.

| Source | Verified terms | Use in this repository |
| --- | --- | --- |
| [UI Beats](https://github.com/nikhils4/ui-beats/blob/main/LICENSE.md) | MIT; retain copyright and permission notice | Scratch-to-reveal was adapted with attribution. The SVG progress ring was implemented locally using the existing component. [Distributed notice](public/licenses/ui-beats-ScratchToReveal-LICENSE.md). |
| [Bklit UI](https://github.com/bklit/bklit-ui/blob/main/LICENSE) | MIT; retain notices when copying its code | Contribution cells, line charts, tooltips and legend interactions were used as visual references. `StudyHeatmap` and `CompanionTimeChart` are independent HTML/CSS/SVG/React implementations; no Bklit package or source was copied. |
| [Animate UI](https://github.com/imskyleen/animate-ui/blob/main/LICENSE.md) | MIT + Commons Clause; commercial app/website use is allowed; selling or redistributing the original components themselves is restricted | Checkbox stroke/fill motion was a reference. `AnimatedCheckbox` uses a native input and locally authored CSS/SVG; Animate UI, Base UI, Motion and its icon packages were not added. |
| [affectUI free repository](https://github.com/flohoeller/affectui/blob/main/LICENSE) / [Pro license](https://www.affectui.com/license) | Free repository: MIT. Pro items have separate purchased-license, seat and source-distribution conditions | Only the public reaction preview's small icon response was referenced. `BookmarkButton` was independently implemented with the Web Animations API and the application's bookmark SVG. No Pro code was copied. |
| [React Bits](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md) | MIT + Commons Clause; commercial application use is allowed; component/tool/export resale and standalone redistribution are restricted | Previous HalftoneReveal implementation is archived in `src/shared/ui/halftone-reveal` and is not imported by the application. Its original license remains beside the source and in [public/licenses](public/licenses/react-bits-HalftoneReveal-LICENSE.md). |
| [GSAP 3.15.0](https://gsap.com/standard-license/) | Standard No Charge license permits commercial use in websites/apps. Competing visual animation builders are restricted | Used for the login poster mosaic. CAPSULE is a study application, not a visual animation builder. Original package notices are retained; [distributed notice](public/licenses/GSAP-NOTICE.txt). |

Renaming variables or translating vendor code does not remove its license conditions. Restricted or paid source was not relabeled to avoid them. Locally authored controls implement common interaction ideas while retaining CAPSULE's own layout, styling and state handling.

React, React DOM, React Router, scheduler, Tailwind CSS and tailwind-merge use MIT licenses. Pretendard and JetBrains Mono use SIL Open Font License terms. The applicable copyright/license texts are copied into [public/licenses](public/licenses) so they are present in production output.

The earlier reference-site research supplied layout and interaction ideas, rather than a downloaded website/template or third-party image bundle. This review addresses component/library code and fonts; the existing user-supplied and generated illustration assets keep their separate provenance manifests.

The detailed review and license-source hashes are in local `docs/REFERENCE_LICENSE_AUDIT.md`, `docs/reference-license-manifest.json` and `docs/license-evidence/`. The project's existing `docs/` ignore rule is unchanged. This root notice and `public/licenses/` are outside that ignored directory.
