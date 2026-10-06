# Interactive 3D simulation studio

All 40 existing lesson simulations now open in a lit, interactive WebGL scene. Students can rotate, zoom, restore the initial camera, and switch to the original 2D diagram. On touch devices, one-finger page scrolling works until the student enables “ลากหมุน”. The control panel, result cards and experiment description have a responsive lab layout.

## Scientific scope

This is a three-dimensional schematic presentation of the existing models, not a new physics engine or anatomically accurate reconstruction. Positions, colors, labels and numeric outputs come from the original lesson model. Circular objects become shaded spheres/ellipsoids, filled shapes become extruded solids, lines become tubes, and plant pots become tapered cylinders. Depth is illustrative. The 2D view retains the exact source diagram and assumptions.

The grade model definitions, formulas, saved-value schema, XP, exam scoring and learning progression are unchanged. Adjusting the camera or switching views does not write progress. Existing experiment controls continue to save their values and update results.

## Runtime

- Three.js 0.180.0 and its MIT license are self-hosted under `assets/vendor/three/`; no CDN requests at runtime.
- The 3D module loads only when opening a simulation. Static hosting over HTTP(S) is required for module loading; the 2D view remains usable if loading fails.
- Rendering occurs on model updates, camera interaction and resize, with pixel ratio capped at 1.75. There is no permanent animation loop.
- Geometry, materials, textures, event listeners, observers and the WebGL context are released on navigation. The existing simulation timer also stops.
- Missing WebGL or context loss switches to a usable 2D diagram. Camera fitting is recomputed from the requested zoom so temporary narrow layouts cannot leave the view over-zoomed.

## Verification

Run with Node and Playwright (Chrome and WebKit installed):

```
node tests/simulation-regression.mjs
node tests/navigation-regression.mjs
node tests/simulation-3d-browser.mjs
```

The browser test accepts an installed `playwright` package or the existing local runtime at `tmp/browser-check/playwright/driver/package`. It starts its own local HTTP server and uses isolated browser profiles. `--smoke` limits the lesson sweep to two representative lessons.

Coverage: 40 3D scenes, 84 controls, 120 layouts at widths 320/390/1366, camera pixel changes, recovery after extreme viewport changes, 2D/3D switching without progress changes, timer pause and cleanup, saved values after reload, unavailable WebGL, context loss, and mobile WebKit interaction. The formula regression covers 245 numerical/boundary variants. Reports and screenshots are generated in `tmp/simulation-3d/` and are not published.

WebKit is an engine-level test, not a physical iPhone test. Source reference: [Three.js documentation](https://threejs.org/docs/).
