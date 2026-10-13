# Premium Voxel Science Adventure — first reader prototype

14 October 2026. First-reader prototype; GitHub publication authorized after local review. No rollout to other activities.

## Scope and checkpoint

- Approved page: **เรียนรู้วิทยาศาสตร์อย่างไร**, lesson `G1U1L1`, content stage only.
- Reviewed the existing application architecture: 3 grades, 21 units, 40 lessons; reader, infographic rendering, simulations, games, exercises, O-NET, exams, results, navigation, accounts and browser progress.
- Baseline: `424fae3` on `voxel-theme-redesign`. Git working tree was clean before editing.
- Pre-edit source copy, SHA-256 and Git state: `tmp/reading-adventure-checkpoint-20261013-211153/`. Existing files and earlier checkpoints were not overwritten.

## Files

| File | Change |
| --- | --- |
| `index.html` | One stylesheet link after the existing stylesheets. |
| `assets/theme/science-adventure.css` | New scoped tokens, component styling and responsive presentation. |
| `tests/reading-adventure-browser.mjs` | Baseline comparison and browser verification using disposable local profiles. |
| `docs/reading-adventure-prototype.md` | Scope, reusable design system and actual verification results. |

No existing JavaScript, content source, science image, activity engine, deployment script or existing stylesheet was changed. The reader's original DOM structure and accessible labels are retained.

## Visual system

The prototype is activated by the existing `.readingMode #reading-G1U1L1S1` marker. It is not activated for other lessons or other stages. CSS `:has()` follows the original renderer automatically, without adding state, observers or application logic.

All tokens are prefixed `--va-` and scoped. They include ink/forest/muted colors, white and cream surfaces, gold/green/blue accents, corner radius, shadows, scene/sign artwork and decorative icon masks. No global `:root` variables are changed.

| Component | Current or reserved hook |
| --- | --- |
| World artwork | Scoped `#app::before`, `--va-scene` with portrait/landscape WebP |
| Wooden title | Original `.hudTop > b`; reusable `.va-title` |
| Content card | Original `.readingSection`; reusable `.va-card` |
| Activity navigation | Original `.stageHUD`, `.stageDots`, `.stageDot`, active/done states |
| Progress track | Original `.progress`; original inline width retained |
| Voxel buttons | Original `.pixelBtn`; reusable `.va-button`, `.va-button--secondary` |
| Feedback | Original `.callout`, `.callout.warn`; reserved `.va-feedback`, `.va-feedback--success`, `.va-feedback--retry` |
| Worked/result surface | Original `.readingWorked`; reserved `.va-result` |
| Infographic frame | Original `.infoCard`; existing images remain intact |
| Completion surface | Original `.readingComplete` and completion handler |

After approval, a future page can opt in by adding `.scienceAdventure` to its existing main wrapper and using these primitives. **No page currently has that opt-in class.** This prepares the system for the requested infographic, simulation, game, exercise, exam and result pages without changing any of them now.

The title remains real HTML over a blank wooden image. CSS grid presents the existing HUD title as a sign without moving nodes. Desktop uses one row of ten activities; tablet and mobile use two rows of five. The activity bar remains in normal document flow. Text lives on opaque reading cards; scientific images retain their aspect ratio and links to the originals.

Animations are limited to short button interactions. There is no ambient reading animation. Reduced motion removes transitions and hover/press movement. Keyboard focus remains visible. Active/primary green gradients were darkened for white text contrast.

## Existing artwork reused

All three assets were visually inspected; none contains baked text, UI, or a screenshot.

| Asset under `assets/lesson-selection/` | Dimensions | Bytes |
| --- | --- | ---: |
| `lesson-scene-v1.webp` | 1024 × 1536 | 364,582 |
| `lesson-scene-wide-v1.webp` | 1536 × 1024 | 433,158 |
| `lesson-sign-v1.webp` | 1200 × 400 | 117,566 |

The scenes contain block clouds, sky, trees, grass, flowers, books, flasks and test tubes. Portrait and landscape versions are selected through media queries. Artwork is shared with the existing asset cache; no additional raster images or runtime libraries were introduced. The new CSS is approximately 20 KB (4.4 KB gzip). Existing science-image lazy loading is unchanged.

## Verification performed

Chrome browser tests passed on the local source at all requested sizes:

**375×812, 390×844, 430×932, 768×1024, 1280×720, 1366×768, 1440×900.**

- Exact baseline reader HTML and text at all seven sizes, including all eight original scientific images, eight sections, captions, links, formulas, examples, worked question/answer and references.
- Exact original ten navigation buttons: names, order, IDs, status text, active state and DOM.
- No horizontal page overflow, clipped text/buttons, hidden educational text or overlapping activity buttons.
- All eight images decoded and retained their proportions; original full-size PNG links are unchanged.
- All activity/continue buttons at least 44 × 44 CSS pixels. Completion button is reachable and unobscured.
- Actual clicks through all ten activities, Back, reading completion → Simulation, lesson Continue, and reload/login resume.
- **14** saved-state comparisons against the baseline, with timestamps normalized. Storage keys/schema, progress and resume match.
- **13** style-isolation comparisons: all nine other activity stages, plus two unrelated readers at mobile and desktop sizes. Computed styles and pseudo styles match the baseline.
- Keyboard focus, Enter/Space activation, no running animation under reduced motion, and no reduced-motion hover translation.
- Zero JavaScript errors, console errors, failed resources or external API requests during the tests.
- Existing static build succeeded. Its new stylesheet and referenced assets are present. Git diff whitespace check passed; all pre-existing source bytes, including mixed line endings, were preserved.

Tests exercise the original code in isolated test profiles; they do not touch a student's browser data. Gameplay, randomization and scoring code are unchanged. This round did not repeat every game/scoring scenario or a full curriculum correctness audit.

Evidence: `tmp/reading-adventure-review/report.json`, baseline records, and 21 screenshots (top, complete page and completion area at seven sizes). Desktop/mobile top and completion screenshots were visually inspected. Full-page screenshots paint the fixed world at the initial viewport; the scrolled completion screenshots verify the artwork remains behind the live viewport.

Run again with `node tests/reading-adventure-browser.mjs`. It uses the existing local Playwright installation and Chrome; nothing is added to the shipped application.

## Review and remaining limits

- Open the original application, choose ม.1 → first unit → **เรียนรู้วิทยาศาสตร์อย่างไร** → **เนื้อหา**.
- Preview images: `tmp/reading-adventure-review/reading-top-390x844.png` and `reading-top-1366x768.png`.
- Local build: `tmp/reading-adventure-build-20261014/`.
- No known blocking issue remains in the tested prototype. Physical iPhone/Safari and Firefox were not tested in this round. The scoped selector uses CSS `:has()`, already used elsewhere in this project.
- The user authorized publishing this reviewed prototype to GitHub on 14 October 2026. The existing Pages workflow publishes pushes to `main`; other pages remain outside this release and await separate approval.
