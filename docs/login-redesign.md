# Login redesign — Bright Voxel Science Adventure

## Scope and recovery

- Original state: commit `50ae884`; Git backup branch `backup/login-before-20261010-50ae884`.
- Existing file changed: `index.html` — only `renderLogin()` and two login-specific CSS/JS imports.
- New presentation files: `assets/login/login.css`, `login-ui.js`, `flask.svg`, `globe.svg`, `cloud.svg`, three WebP illustrations, and the locally bundled Anton font with its OFL license.
- New checks: `tests/login-redesign-regression.mjs` and `tests/login-redesign-browser.mjs`.
- The regression compares every line outside the login renderer/imports with the baseline. Authentication, password checks, account data, session, redirects, storage keys, progress, and all other page renderers remain unchanged. Shared styles, UI scripts and the build pipeline are untouched.

## Presentation

Real school crest: `assets/branding/33852269be64c916.png`, unchanged. No AI-generated crest.

### Follow-up: transparent identity and livelier motion

The original crest already contains transparency. Removed the CSS white background, logo glow, school-name text shadow and radial page halo; the source logo pixels and meaningful white details remain unchanged. No logo image was generated or edited for this follow-up. Backup branch: `backup/login-before-motion-07d2756`.

Clouds now drift farther, the flask and globe float, leaves sway, and the student gently shifts from an anchor at the feet. Only decorative transforms animate. The school identity and form remain still after the initial card entrance. Ambient motion pauses whenever the login panel contains keyboard focus and resumes when focus leaves; `prefers-reduced-motion` disables it. The login stylesheet URL is versioned to avoid stale cached effects.

Verified normal-motion and reduced-motion layouts at all six widths, actual changes to decorative transforms over time, stable form/control geometry, pause/resume during password entry, and the absence of logo background/glow. Existing valid/invalid demo login, storage and progress checks still pass. Updated files are limited to the login stylesheet, its import in `index.html`, this report and the login browser test.

Artwork, foreground student, school identity, HTML title/signs, HTML login form and SVG controls are separate layers. Thai text remains selectable HTML. CSS is scoped to `.loginPage`, with a login-scene-only rule to hide the existing particle overlay.

The title uses the locally hosted Anton font so Android/iOS do not depend on the availability of Windows Impact. The font is used only for the login title; see `assets/login/LICENSE.anton.txt`. Source: https://github.com/google/fonts/tree/main/ofl/anton.

The existing demonstration accounts and demo-storage notice are retained. Remember-me and registration controls are omitted because the original system has neither feature. Password visibility and the teacher-support disclosure are presentation-only. The original synchronous login handler is unchanged; busy/disabled styles are provided without adding an artificial authentication delay.

Contact channel: pending the user's later addition. The current “ติดต่อครูผู้ดูแล” control opens an on-page instruction to contact the science teacher at school; no fabricated external contact destination.

### Follow-up: fit the complete login into one screen

The complete default login fits inside the viewport without vertical or horizontal scrolling at the tested phone, tablet, laptop, and desktop sizes. The school identity, title and form remain centered like the reference composition. From 900px wide, the student and wooden sign sit beside the form instead of adding another row below it. The content is capped at 1080px and the form at 400px.

Crest/title sizes, line heights, form spacing and the mobile foreground respond to the available screen height. At heights up to 740px, the school identity becomes more compact and the optional foreground is hidden. Short landscape screens at least 560px wide use two columns so the entire card still fits. Inputs retain at least 16px text and 44px touch targets; no whole-page transform or browser zoom is used to shrink the controls. Safe-area padding and dynamic viewport minimum heights accommodate mobile browser chrome. Extra help, errors, an open keyboard or accessibility zoom can still grow the document and scroll naturally instead of clipping controls.

Changed files: the scoped login stylesheet, its cache version (`v=4`) and matching landscape background selection in `index.html`, the existing login browser checks, and this report. No authentication or shared application logic changed.

The browser suite covers 22 viewport sizes in both normal and reduced motion: 320×568, 360×640, 375×667, 375×812, 390×844, 430×932, 540×720, 600×800, 568×320, 640×360, 667×375, 844×390, 768×1024, 820×1180, 1024×768, 1180×820, 1280×720, 1366×768, 1536×864, 1880×914, 1920×1080, and 2560×1440. It checks the complete page height, full panel and demo notice, text clipping, control hit targets, visible foreground bounds and overlap, expanded help together with a real login error, and the 390×360 keyboard-space simulation. Screenshots use both dimensions in their names, for example `tmp/login-redesign/login-1880x914.png` and `login-390x844.png`.

## Validation

- Chromium: the 22 responsive viewport sizes listed above; the complete default login fits without scrolling in either direction, and controls receive pointer hit tests.
- Current single-screen follow-up passed: all 22 layouts in normal/reduced motion, expanded help/error checks, original demo login/storage checks, login scope regression, a fresh build in `tmp/login-fit-20261010`, and deployment resource regression. Publishing uses the existing GitHub Pages workflow on `main`; the release serves `assets/login/login.css?v=4`.
- Short 390 × 360 viewport: inputs and submit button remain reachable by scrolling (keyboard-space simulation).
- Password show/hide retains value and selection; contact disclosure; disabled/busy button styles; reduced motion; image/font loading; consistent accessible labels.
- Existing demo accounts: student and teacher success; incorrect password, unknown and inherited-property username rejection; Enter and button submit; logout and reload behavior.
- Existing progress seed preserved byte-for-byte; no new login storage writes.
- Passed: login scope regression, login browser checks, existing account regression and readiness browser smoke.
- Passed: fresh build in `tmp/login-final-20261010a`, deployment regression (script/CSS byte equality and order), and deployment browser checks under a `/school/` project subpath. This includes login, dashboard, reading images, native 3D import and saved progress after reload.
- Screenshots and detailed browser report: `tmp/login-redesign/` (local QA artifacts, not published).

These browser checks emulate viewport sizes; they are not a physical iPhone/Android keyboard test. No live student credentials were used.

## Artwork provenance and exact prompts

Generated using the **built-in image_gen tool**, not a CLI/API-key workflow. No school logo, title, Thai text, form or button was generated into the artwork. The PNG outputs were converted to WebP at quality 0.91 at the same resolution, preserving student transparency; no visual content was redrawn during compression. Final image payload is approximately 643 KB on mobile or 705 KB on desktop (background plus student), reduced from 4.38 MB / 4.59 MB PNG respectively.

### Portrait background

Saved asset: `assets/login/voxel-scene-v1.webp`

```text
Use case: stylized-concept. Asset type: portrait background artwork for a Thai school science adventure login website, 1024x1536 portrait composition.
Create polished, gorgeous bright 3D voxel / block-world game key art. Sunny saturated azure blue sky with large white cubic clouds, crisp dense foliage built from small lime and emerald cubes, rough cubic brown trunks framing both left and right edges. High-quality rendered cubic geometry with depth, ambient occlusion and sunlight, not a flat illustration. Distant tiny floating garden islands with flowers at the side edges. In the distant lower half, an inviting Thai-inspired white school with warm orange tiered roofs amid green trees. At the bottom quarter, a sparkling blue cubic stream running toward viewer, small wooden footbridge, wooden fences on each bank, dense green grass and white, yellow and pink block flowers. The environment continues naturally beyond the edges.
COMPOSITION CRITICAL: wide open central sky from the top through middle, gentle atmosphere, keep detailed trees mostly along the side edges so real HTML logo, title and form can overlay the central column. School is on the distant horizon, river at bottom; no major centered foreground obstruction. Magical adventurous atmosphere matching a beautifully lit 3D voxel game poster.
Color palette: vivid sky blue #3B82F6, grass #22C55E and #16A34A, warm golden sunlight, brown wooden details, white clouds.
Do not include any text, letters, numbers, logo, emblem, sign, title, game UI, form, buttons, icons, or people. No border, no mockup. The entire output is only the landscape artwork.
```

### Desktop background

Saved asset: `assets/login/voxel-scene-wide-v1.webp`

```text
Use case: stylized-concept. Asset type: landscape desktop background artwork for a Thai school science adventure login website, 1536x1024 wide landscape composition.
Create polished, gorgeous bright 3D voxel / block-world game key art. Sunny saturated azure blue sky with large white cubic clouds, crisp dense foliage built from small lime and emerald cubes, rough cubic brown trunks framing both far left and far right edges from top to bottom. High-quality rendered cubic geometry with depth, ambient occlusion and sunlight, not a flat illustration. Distant tiny floating garden islands with flowers at side edges. At the distant horizon around 65% down the frame, an inviting Thai-inspired white school with warm orange tiered roofs amid green trees. At the bottom quarter, a sparkling blue cubic stream running toward viewer, small wooden footbridge, wooden fences on each bank, dense green grass and white, yellow and pink block flowers. Environment extends naturally past all edges.
COMPOSITION CRITICAL: wide open central sky in middle half of image from top through about 60% height. Keep dense trees at leftmost and rightmost quarter. This central sky must accommodate an actual separately overlaid website logo/title/form; do not draw any overlay. School visible in distant horizon, river bridge at bottom. No major foreground object blocking center. Frame all school, river, bridge with beautiful block foliage. Magic adventurous optimistic welcoming atmosphere, beautifully lit 3D voxel game poster. Match tall bright school voxel background palette: vivid sky blue #3B82F6, grass #22C55E and #16A34A, golden sunlight, rich wood brown, bright white cubic clouds.
Do not include ANY text, letters, numbers, logo, emblem, sign, title, game UI, form, buttons, icons, people, or character. No border, no screenshot/mockup. Output only landscape artwork.
```

### Transparent foreground student

Saved asset: `assets/login/voxel-student-v1.webp`

```text
Use case: stylized-concept. Asset type: transparent foreground cutout for a bright 3D voxel school adventure website.
Create one full-body friendly Thai schoolboy as a polished 3D BLOCK/VOXEL game character, on a small isolated patch of bright lime-green cube grass with three tiny white/yellow block daisies. Brown chunky cube hair, blocky head, simple peach skin, white short-sleeve school shirt, navy school shorts, white socks, black school shoes. Charcoal and navy blue voxel backpack with bright blue small pocket. He is viewed from the BACK THREE-QUARTER left, looking toward the RIGHT inward into the scene, most of backpack and back visible, a little right cheek visible. Arms naturally by sides. Every shape is distinctly cubic with crisp square planar edges, matching a vivid high-quality block-world game render, friendly student proportions, not a smooth round toy or real person. Bright warm sunlight from upper left with soft ambient occlusion and rich vivid colors.
Composition: isolated character full body and small grounded grass patch, centered, nothing cropped, transparent background around all edges. Camera at child chest height, three-quarter view. Character fills most of frame.
Constraints: REAL TRANSPARENT BACKGROUND with alpha. No room, no sky, no scenery behind, no other people, no signs, no logo, no text, no letters, no watermark, no fake checkerboard. Preserve transparency.
```
