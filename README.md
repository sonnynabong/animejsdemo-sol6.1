# Chronograph — a study in motion

A real, 13-mesh chronograph model disassembles as you scroll down and reassembles as you scroll up. Anime.js drives a reversible timeline; Three.js renders the original GLB with studio lighting. Built with Vite and TypeScript.

## Run locally

Requires Node.js 22.12+ (or 20.19+) and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite, usually http://127.0.0.1:5173. Scroll with the wheel, touch, or keyboard. The four small buttons on the right jump to construction stages; “Explore again” returns to the beginning.

```sh
npm test       # validates the real GLB's mesh coverage and Anime.js reversibility
npm run build # includes TypeScript checking
npm run preview
```

For browser regression checks, install Chromium once with `npx playwright install chromium`, then run `npm run test:browser`. The suite checks visual reassembly, all chapters, mobile navigation, reduced motion, delayed loading, retry, and the WebGL fallback. It starts Vite automatically when needed.

## How the animation works

The five-viewport section contains a sticky scene. Anime.js `onScroll()` synchronizes one timeline with the section's scroll range using `sync: 0.22`. The first 15% shows the assembled watch; glass and bezel separate from 15–40%, hands and dial from 40–65%, and the remaining components from 65–90%. The final 10% holds the exploded view.

`src/sequence.mjs` defines eight animation groups, referring to the original GLB node indices. The `Hands` parent carries its four child meshes as one group. Three.js wrappers preserve the original transforms, and displacement is defined in normalized model coordinates. The source geometry, materials, and hierarchy of the hands are preserved. No internal gears are added. The embedded animation is deliberately not played.

The camera fits the full exploded bounds and rotation path. A reduced-motion preference shows a static exploded view. A lack of WebGL shows the source preview image. Asset failures have a retry action; rendering pauses while the page is hidden.

## Asset and credits

- **Chronograph Watch**, originally “Chronograph Watch Mudmaster” by **graphiccompressor**, optimized and adapted by **Eric Chadwick / Darmstadt Graphics Group GmbH** (2025).
- [Official asset, documentation, and licensing](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/ChronographWatch/README.md).
- Model, textures, and included preview: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
- This demo adds scroll-driven separation, lighting, camera framing, and UI. Source geometry and textures are unmodified.
- Khronos, 3D Commerce, and DGG marks remain within the supplied asset. Their separate notices and the upstream README are included in `public/models/`. The demo does not claim endorsement.
- [Anime.js](https://animejs.com/) and [Three.js](https://threejs.org/) are MIT licensed.

The GLB and preview are served locally. The only external presentation request is Google Fonts; the page has system font fallbacks. No backend, credentials, or hosting setup is needed.
