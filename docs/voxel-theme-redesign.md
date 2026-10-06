# Bright voxel theme redesign

6 October 2026 · Science Learning Hub · branch `voxel-theme-redesign`

The presentation now follows the supplied reference: daylight sky, block clouds and trees, grass and dirt terrain, water, the existing voxel school and student artwork, wooden signs, green action buttons and white reading surfaces. The actual school crest and Thai school identity are retained. No curriculum or learning-system rebuild was performed.

## Source checkpoint

- Baseline Git revision: `ed40b472b37fdcbb294be3acca0750be572e2867`.
- Pre-edit copies: `tmp/voxel-backup/index.html` and `tmp/voxel-backup/theme/`.
- The source backup and baseline revision provide the pre-edit checkpoint. The redesign is prepared on `voxel-theme-redesign` for publication to `main`.
- Existing untracked `tmp/` tooling and earlier audits were left in place.

## Implementation

`assets/theme/voxel-world.css` supplies the shared light-theme tokens, landscape, wood/grass surfaces, world cards, buttons, navigation, activity path, reader and infographic frames, simulation workstation, game arenas, green/blue/gold exercise levels, quiet final exam and results. Portrait layouts are defined for 360–430 px, with tablet and desktop adaptations.

`assets/theme/voxel-ui.js` makes presentation-only DOM enhancements after the existing renderer runs: school branding, form labels, keyboard activation for existing unit cards, checkpoint emphasis, result/perfect-score banners, and a collapsible exam guidance area. Existing guidance text is retained. The question is displayed before the question-navigation grid, so students can start reading sooner on a phone. The sticky login badge keeps the crest visible when the larger entrance logo scrolls away.

The UI helper does not read or write localStorage, call the learning engines, calculate scores, create progress, or replace navigation handlers. Full-view changes are observed; simulation animation ticks are not observed. No libraries or network services were added to the production site.

The existing school and three grade-world illustrations were extracted verbatim into cacheable PNG files. Their combined size is 590,207 bytes; the largest is 294,473 bytes. The new decorative landscape is a 3.8 KB SVG. Topic images and scientific diagrams remain the existing originals, with lazy loading retained.

The existing decorative particle handler now uses daylight colors, skips reading/exam views, honors reduced motion and safely exits when `matchMedia` is unavailable in a non-browser test harness. The original duplicate particle effect is hidden by CSS. Button motion is approximately 150 ms; feedback is 180–280 ms and small particle bursts last 420 ms.

## System map reviewed before editing

| Area | Existing source of truth |
| --- | --- |
| Curriculum, lesson IDs, sections, original activities | `window.SLH_DATA` in `index.html` |
| Reading explanations, sources and reader | `assets/content/` |
| Main rendering, accounts and route handlers | Original application closure in `index.html` |
| Activity state, next recommendation, earned progress and XP | `baseProgress`, `nextRequired`, `stageDone`, `contentProgress`, `userStats` |
| Simulation models, saved values and controls | `assets/simulations/` |
| Game definitions, mechanics and answer evaluation | `assets/games/` |
| Exercises and original O-NET questions | `assets/exercises/` plus original exercise handlers |
| Final bank, question/choice shuffling and attempts | `assets/exams/` plus original exam handlers |
| Mastery | Original `mastery` function and saved trace |
| Resume | Original `openLesson`, `p.resume` and saved in-progress attempts |
| Storage | Existing `slh_v163_<user>_<lesson>` schema and `slh_v162_<lesson>` legacy handling |

The current system intentionally allows free activity selection while tracking earned completion separately. This was preserved exactly. New prerequisites or locks were not introduced. Existing grade relations, score thresholds and progression behavior take priority over contradictory example wording in the design brief.

## Data-integrity report

`scripts/audit-voxel-integrity.mjs` compares the redesign to the checkpoint. Result: **passed**.

- Every original inline data and application script is exactly identical to the baseline.
- SHA-256 comparison passed for **898 protected files** in content, exams, exercises, games, labs, simulations, lesson assets and unit assets. Only Git checkout CRLF/LF differences are normalized for text-file comparisons; binary assets are compared exactly.
- **3 grades, 21 units, 40 lessons and 319 content sections** remain unchanged.
- All **40 lesson-cover mappings** are retained, point to their respective lesson assets, and exist on disk. A contact-sheet review confirms topic correspondence, including heart/circulation, lungs, kidneys/nephron, nervous system, reproduction, cells, plants, forces, energy, waves, light, circuits, solar system, genetics and ecosystems.
- Questions, answer choices, correct answers, distractors, scoring, 20-question exams, 60% threshold, randomization, mastery, account handling, storage keys/schema and resume behavior were intentionally not modified.

Machine-readable evidence: `tmp/voxel-audit/integrity.json`. Visual topic review: `tmp/voxel-audit/lesson-gallery.png`.

## Regression report

All nine existing regression/migration scripts passed: account, exercise, final-exam, game, lab, navigation, O-NET, simulation and final-exam migration.

| Check | Coverage / result |
| --- | --- |
| Games | 120 games, all nine mechanics; correct/wrong answers, completion, replay and reload |
| Exercises | 120 sets; 318 basic and 240 application questions; completion and persistence |
| Final bank | 800 questions; 4,000 generated forms; topic coverage, shuffle and answer-position checks |
| Simulations | 40 models and 245 numerical/boundary cases |
| Navigation / accounts | Activity switching, teacher/student isolation, legacy progress and saved attempts |
| Browser layout | 40 lessons × 10 activities × 6 sizes = **2,400 checks**, no horizontal overflow |
| Browser assets / controls | **319** content images loaded; **84** simulation controls changed successfully |
| Original O-NET in browser | **66** questions, local images and correct/wrong answer controls |
| Final exam in browser | Incomplete submission blocked; **55% fails, 60% passes, 100% perfect-score badge**; retry, mastery and reload |
| Continuous browser flow | Login → grade → unit → lesson → reading → simulation → all 3 games → all 3 exercise levels → final exam → results |
| Resume | Checkpoint card, retained simulation stage, results after reload and student progress after account switching |
| Motion | Reduced-motion preference disables decorative animation |
| Final Chrome + WebKit layout review | **372 additional layouts**: 3 representative lessons × 10 stages plus dashboard, at all 6 sizes, in both engines; no overflow, clipped button text or missing school logo |
| Login in both engines | **12 viewport checks**; sticky school crest visible after scrolling; successful login removes the temporary entrance header |

Test sizes: **375×812, 390×844, 393×852, 430×932, 768×1024 and 1366×1000**. Browser tests use isolated profiles containing synthetic test progress, never a student's existing profile.

`tests/voxel-browser.mjs` is the full browser audit, with screenshots and `tmp/voxel-audit/report.json`. `tests/voxel-mobile.mjs` checks Chrome and WebKit at all six sizes, including button clipping, school-logo visibility, final-exam guidance/selection and reduced motion. Both reuse the already available local Playwright package; browser tooling is not shipped with the application.

Final cross-engine results: `tmp/voxel-audit/cross-browser.json` and `tmp/voxel-audit/login-check.json`, both with empty findings. The broad audit also has empty findings. Screenshot previews include `Chrome-final-home.png`, `Chrome-exam-393.png`, `lessons-390.png`, `simulation-390.png`, `challenge-complete-390.png` and `result-100-390-viewport.png` in that directory.

The in-app Browser connection was unavailable, so testing used headless Chrome and Playwright WebKit. WebKit is a Safari-engine approximation, not a physical iPhone Safari test. Physical iOS and Android devices were not available.

## Files changed

Modified:

- `.github/workflows/pages.yml` — validate the active Voxel stylesheet, script and artwork before packaging the site.
- `index.html` — theme stylesheet/script references only; original inline scripts unchanged.
- `assets/theme/block-effects.js` — decorative colors, quiet-mode behavior and non-browser guard.

Added:

- `.gitignore` — exclude local browser tooling, backups and generated audit reports in `tmp/`.
- `assets/theme/voxel-world.css`
- `assets/theme/voxel-ui.js`
- `assets/theme/voxel-landscape.svg`
- `assets/theme/school-world.png`
- `assets/theme/world-nature.png`
- `assets/theme/world-science.png`
- `assets/theme/world-space.png`
- `scripts/audit-voxel-integrity.mjs`
- `tests/voxel-browser.mjs`
- `tests/voxel-mobile.mjs`
- `docs/voxel-theme-redesign.md`

Earlier theme files remain on disk for reference but are no longer loaded. Publishing to `main` triggers the existing GitHub Pages workflow. No student-data reset was performed.
