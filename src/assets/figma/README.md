# Figma wireframe assets

Source: [CAPSULE wireframes](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL/?node-id=682-172), read-only inspection on 2026-10-26.

The 25 SVG/PNG files here are downloaded exports returned by Figma design context. Their contents and SVG root dimensions are preserved. Repeated exports with identical hashes reuse one local file. Full-screen screenshots are not used as UI assets.

| Node prefix | Usage |
|---|---|
| `682-430` | Camera check icon, 22×22 |
| `706-172` | Previous camera check and selected tier check, 18×18 |
| `689-172` | Grid heads, expand icon, face guide, purple status dot |
| `689-219` | Focus/small heads, collapse icon, small face guide, green status dot |
| `693-172` | Break-time head, microphone/message/send icons |
| `707-172` | Quiet chat send icon, 18×18 |
| `694-189` | Exhausted free-turn indicator, 10×10 |
| `695-173` | Selected/unselected payment and upgrade radio indicators, 16×16 |
| `682-610` | Report head and speech-bubble tail |
| `705-172` | Share-card head and color palette |

Consumers: `features/session/assets.ts`, `CharacterFigure`, `ChatComposer`, `TierSelector`, `PreparePage`, `ReportPage`, `CapsuleCardPage`, and `shared/ui/RadioOption`. Avatar/room thumbnails and CSS body shapes are placeholders from the wireframe; finished character artwork is not supplied.
