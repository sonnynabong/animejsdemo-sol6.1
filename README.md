# Chronograph — Anime.js 3D Scroll Demo

An experimental demo inspired by the scroll-driven 3D presentation on the [Anime.js website](https://animejs.com/). A chronograph watch separates into an exploded view as you scroll down and reassembles as you scroll back up. Anime.js drives the animation; Three.js renders the GLB with studio lighting.

> **For testing and learning only.** This repository is a proof of concept for combining Anime.js scroll animations with Three.js rendering. It is not a production-ready application or a mechanical assembly reference.

## Features

- Scroll-driven disassembly and reassembly using native page scrolling.
- Four chapter buttons to jump between construction stages.
- Dark presentation, studio lighting, and animated headings.
- Responsive layouts for desktop and mobile screens.
- A static exploded view for visitors who prefer reduced motion.
- Loading progress, retry for failed model downloads, and an image fallback when WebGL is unavailable.

## Run locally

### Requirements

- **Node.js 22.12 or newer**, or Node.js 20.19+ within the 20.x release line.
- **npm**, included with Node.js.
- A browser with **WebGL 2** support for the interactive 3D scene.

Clone or download this repository, then open a terminal in the project directory:

```sh
npm ci
npm run dev
```

Open the address printed by Vite, usually [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

Scroll with your mouse wheel, touch, or keyboard to separate the watch. Scroll back up to restore it. Use the four buttons on the right to jump to a stage, or **Explore again** at the end to return to the beginning.

No backend, API keys, or environment variables are required. The GLB and preview image are included in the repository and served locally. Fonts load from Google Fonts, with system fonts as fallbacks.

### Build and preview

```sh
npm run build
npm run preview
```

The build performs TypeScript checking and generates the static site in `dist/`. Open the preview address printed in the terminal, usually [http://127.0.0.1:4173/](http://127.0.0.1:4173/).

## The 3D asset

The demo uses **Chronograph Watch** from the [KhronosGroup/glTF-Sample-Assets repository](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ChronographWatch).

| Detail | Value |
| --- | --- |
| Format | GLB, the binary form of glTF 2.0 |
| Included file | [`public/models/chronograph.glb`](public/models/chronograph.glb) |
| Download size | Approximately 7.4 MB |
| Mesh components | **13** |
| Scene nodes | **14**, including one parent node for the hands |
| Animation groups in this demo | **8** |
| Model and texture license | [Creative Commons Attribution 4.0 International — CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

The 13 mesh components are organized into eight groups for the scroll animation:

| Animation group | Original mesh names | Mesh count |
| --- | --- | --- |
| Glass | `Glass Face` | 1 |
| Bezel | `Bezel Frame` | 1 |
| Hands | `Hand Hours`, `Hand Minutes`, `Hand Seconds`, `Hand Setting` | 4 |
| Dial | `Watch Face` | 1 |
| Band | `Band Carbon Fiber`, `Band Plastic` | 2 |
| Controls | `Button Metal`, `Button Plastic` | 2 |
| Clasp | `Clasp DGG` | 1 |
| Backplate | `Backplate Khronos` | 1 |
| **Total** | | **13** |

These are the meshes supplied by the asset, rather than a count of every physical part in a real watch. Some meshes combine several visible pieces. The demo separates existing geometry; it does not add internal gears or a watch movement.

## How the animation works

**Three.js** loads and renders the GLB. **Anime.js v4** uses `onScroll()` to synchronize a reversible timeline with a section spanning five viewport heights. The scene stays sticky while the visitor scrolls through it.

| Scroll progress | Animation |
| --- | --- |
| 0–15% | Present the assembled watch with a gentle rotation |
| 15–40% | Separate the glass and bezel |
| 40–65% | Separate the hands and dial |
| 65–90% | Separate the band, controls, clasp, and backplate |
| 90–100% | Hold the complete exploded view |

[`src/sequence.mjs`](src/sequence.mjs) defines the groups, offsets, timing, and chapter text. [`src/main.ts`](src/main.ts) sets up the renderer, preserves each component's original transforms, links the timeline to scrolling, and handles loading and accessibility preferences. [`src/style.css`](src/style.css) controls the presentation and responsive layout.

The `Hands` parent carries its four child meshes as one animation group. The asset's embedded hand animation is deliberately not played. The camera fits the assembled and exploded bounds, and rendering pauses while the browser tab is hidden.

## Tests

Run the three asset and animation tests:

```sh
npm test
```

These verify that the animation groups cover all 13 meshes exactly once, that the Anime.js sequence reverses without drift, and that chapter boundaries match the intended stages.

Install Chromium once, then run the six browser regression tests:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite starts Vite automatically when needed. It checks exact visual reassembly, scroll stages, mobile navigation, reduced motion, failed-download recovery, delayed model loading, and the WebGL fallback.

To run only the TypeScript check:

```sh
npm run typecheck
```

## Asset and credits

- **Original asset:** [Chronograph Watch Mudmaster](https://skfb.ly/oAsPA) by **graphiccompressor**.
- **Optimized glTF asset:** Model and textures by **Eric Chadwick / Darmstadt Graphics Group GmbH**, credited in the upstream asset documentation (2025).
- [Official asset, documentation, and licensing](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/ChronographWatch/README.md).
- [Original GLB download](https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ChronographWatch/glTF-Binary/ChronographWatch.glb).
- [Local copy of the source documentation](public/models/SOURCE.md).
- Model and textures: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
- This demo adds scroll-driven separation, lighting, camera framing, and UI. Source geometry and textures are unmodified.
- Khronos, 3D Commerce, and DGG marks remain within the supplied asset. Their separate notices are included in [`public/models/`](public/models/). This project does not claim affiliation with or endorsement by those organizations or Anime.js.

## Built with

- [Anime.js](https://animejs.com/) — scroll synchronization and animation timelines.
- [Three.js](https://threejs.org/) — 3D rendering and GLB loading.
- [Vite](https://vite.dev/) — local development and production builds.
- [TypeScript](https://www.typescriptlang.org/) — application type checking.
- [Playwright](https://playwright.dev/) — browser regression tests.

Third-party assets retain their own licenses and attribution requirements. See the source documentation and notices included with the model.
