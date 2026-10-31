# Browser vision models

The official, unmodified MediaPipe Face Landmarker and Selfie Segmenter models are self-hosted here; their versions, original URLs, sizes and SHA-256 digests are pinned in [manifest.json](manifest.json).

- MediaPipe Face Landmarker combines BlazeFace, FaceMesh V2 and Blendshape V2. Their Google model cards identify Apache-2.0: [BlazeFace](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20%28Short%20Range%29.pdf), [FaceMesh V2](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf), [Blendshape V2](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf).
- MediaPipe Selfie Segmenter separates the person from the background for the camera virtual background. Its Google model card identifies Apache-2.0: [Selfie Segmentation](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf). It is loaded only after a non-default background is chosen and runs on the displayed preview; focus scoring still uses the Face Landmarker on original frames.

Original notices are distributed in [/licenses/vision](../licenses/vision). Camera frames stay in browser memory and are transferred to a local Worker for inference. The microphone is connected only to a local Web Audio analyser; it is neither recorded nor sent for speech recognition. No microphone playback connection is made.

`npm ci`, `npm run dev` and `npm run build` prepare the pinned MediaPipe JS/WASM runtime in `public/runtime/`. This generated directory is ignored by Git. All runtime assets are served from the application origin.

MVP scoring uses valid face-presence measurements only. Missing-face intervals reduce the focus ratio; camera off, initialization, errors, pauses and hidden tabs do not create observations. The YOLO/phone detection feature is deferred until after MVP; its weights, runtime and dependencies are not included.
