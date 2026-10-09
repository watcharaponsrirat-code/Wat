# Native 3D simulation studio — all 40 lessons

Each lesson now has a purpose-built three-dimensional scene. The renderer no longer extrudes the old SVG diagram. Grade-specific builders use actual spheres, cylinders, solids, curved tubes, transparent vessels, articulated connections, and camera-facing labels. The original 2D diagram remains available for comparison.

## Interaction and rendering

- Unrestricted horizontal 360° orbit, damped pointer rotation, and equal 15° left/right buttons. Opposite button rotations cancel exactly.
- Smooth 260 ms camera transitions, reciprocal zoom controls, front/top/initial presets, optional automatic rotation, and a label visibility toggle.
- Two-finger pinch zoom in touch interaction mode. Page scrolling remains available until “ลากหมุน” is enabled. The canvas also supports arrow keys, plus/minus and Home.
- Persistent mesh objects and shared primitive geometry. Slider changes interpolate object transforms, colors and tube vertices instead of rebuilding the scene.
- Environment lighting, clearcoat materials, transparent volumes, soft shadow filtering and a common studio stage. Framing is tuned for smaller apparatus while rotation behavior remains identical.
- Labels face the camera and retain a readable screen size while orbiting and zooming.
- Rendering stops after transitions settle, when the scene is offscreen, on hidden tabs, and in 2D mode. Automatic rotation is opt-in. Reduced-motion preferences remove transition animation.
- Navigation disposes the scene, materials, textures, geometry, lights' shadow resources, environment, observers, animation frame and WebGL context. Existing experiment timers stop as before.

## Lesson coverage

| Grade | Native scenes |
|---|---|
| 1 (12) | Controlled plant growth; floating/sinking; atoms and molecules; plant/animal cells; diffusion/osmosis; flower reproduction; photosynthesis; plant transport; melting/boiling; heat transfer; pressure-driven wind; greenhouse radiation |
| 2 (17) | Evidence/model fit; solubility; concentration; four-chamber circulation; lung expansion; nephron filtration/reabsorption; reflex arc; menstrual-cycle schematic; distance/displacement; forces and a cart; inclined plane; falling-object energy; distillation; sediment transport; soil drainage; runoff/flood accumulation; renewable generation |
| 3 (11) | Bridge design; allele combinations; transverse waves; reflection/refraction; Moon phases; conservation of mass; material deformation; series/parallel circuits; electrical energy meter; food-chain energy; habitat corridors |

These remain educational models under the original stated assumptions. Anatomy is schematic, celestial distances and sizes are illustrative, and the scenes are not medical, engineering or weather-prediction tools. Numeric metrics and learning progression still come from the original application. Camera actions do not save or change earned progress.

`models3d-kit.js` owns reusable geometry, materials, readable label textures and interpolation. `models3d-grade1.js`, `models3d-grade2.js`, and `models3d-grade3.js` implement the lesson scenes; `models3d.js` registers all 40. `scene3d.js` handles lighting, camera, gestures, frame scheduling and cleanup. Three.js 0.180.0, OrbitControls and RoomEnvironment are self-hosted with their MIT license. No external runtime requests are needed.

## Verification

```
node tests/native-models-regression.mjs
node tests/simulation-regression.mjs
node tests/simulation-3d-browser.mjs
node tests/voxel-browser.mjs
```

- Native registry exactly matches all 40 original lesson IDs. Every control affects its scene; 245 option/boundary cases produce finite geometry/state.
- Independent numeric checks cover submersion, atom counts, conserved particles, phase changes, solubility, lung/diaphragm relationships, force and energy, genetics, total internal reflection, lunar illuminated fraction, conserved mass, circuits and electrical energy.
- Browser checks: 40 native scenes, 84 controls, 120 responsive layouts at widths 320/390/1366; equal rotation steps and reciprocal zoom on every scene; pointer drag, full 360° turn, camera presets, automatic rotation, labels, reduced motion and two-finger pinch via Chromium's touch input protocol.
- Missing WebGL and context loss fall back to the working 2D diagram. Timer pause, navigation cleanup and persisted values after reload are checked. Mobile WebKit renders the native scene as well.
- The existing broad browser audit covers 2,400 activity layouts and a complete learning flow through results. Screenshots of every native scene are produced for visual review in `tmp/simulation-3d/`.

The browser tests use isolated profiles and a local HTTP server. Install Playwright with Chrome/WebKit, or use the existing local runtime in `tmp/browser-check/`. `--smoke` checks four representative scenes. WebKit and emulated touch checks do not replace testing on physical devices.

## Visual clarity revision — 9 October 2026

All 40 builders now include clearer silhouettes, component labels or directional context. Anatomical models use extruded organ outlines and a frontal starting view. Labels are separated in screen space on desktop and mobile. See [simulation-clarity.md](simulation-clarity.md) for the anatomical, circuit and other corrections, references and validation.
