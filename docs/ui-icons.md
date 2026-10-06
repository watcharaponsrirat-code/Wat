# SVG interface icons

`assets/theme/ui-icons.js` replaces displayed emoji with local inline SVG icons across the application, including login, navigation, grade badges, games, exercise feedback, final results and transient notifications. Existing SVG navigation artwork is retained. Food-web organisms have distinct plant, grasshopper, mouse, frog and snake icons alongside their original Thai names.

The layer transforms DOM text only; curriculum data, answer values, event handlers and saved progress remain unchanged. It observes inserted text and subsequent text edits. It skips scripts, styles, editable fields, code, existing SVG and canvas. Scientific arrows in ordinary content are retained; directional glyphs in buttons and links receive equivalent icons. Standalone icons receive accessible names, while icons accompanying labels are decorative. No icon font, external request or dependency is required.

`assets/theme/ui-icons.css` supplies consistent sizing, stroke weight, theme colors and forced-color support. `index.html` loads both assets, and the Pages workflow verifies them before packaging.

Verification:

- `tests/ui-icons-browser.mjs`: 404 views/states, 2,729 icon instances, no displayed emoji or JavaScript errors; Chrome and WebKit.
- Food-web completion, dynamic notifications, editable text preservation, scientific-arrow preservation and decorative icon accessibility.
- Existing `tests/voxel-browser.mjs` covers full learning flows and responsive layout; `tests/simulation-3d-browser.mjs --smoke` checks the 3D controls and fallback alongside the icons.

The focused browser test starts an isolated local server and writes screenshots/report to `tmp/icon-audit/`. It uses installed Playwright or the existing local runtime under `tmp/browser-check/`.
