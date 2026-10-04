# React refactor validation

Validated 2026-10-04 against repository baseline `17b7cc77abafde4877747cac7bd7361d81b6b1e8`.

## Implemented

- React 19 + React Router migration with shadcn-style tokens and Radix controls
- Original desktop finder density: two settings columns, 32px controls, 16px base text, 14px control text; 18px decorative resource icons
- Responsive settings, rule rows, viewer and dialogs, without the old 1024/1080px page minimum widths
- All original rule types, profiles, seed import, pause/resume, saved results, native/browser search, galaxy routes/query settings, CSV/XLSX/TXT export, and English/Chinese text retained
- Ordered immutable persistence checkpoints, stale response guards, independent worker cancellation, explicit worker errors, and abortable exports
- Reused calculator atlas with full source license and game-art attribution

## Passed

- Clean `npm ci`
- `npm run check`: ESLint, three TypeScript projects, 115 tests in 13 suites, production web build
- Full `npm run build`: optimized WebAssembly, native executable, production web build
- `cargo test --release`: four passed, one pre-existing golden-print helper ignored
- `npm run test:engine`: three complete native/WASM galaxies including actual/estimated veins and changed parameters; six rule searches; seed zero; repeated native/WASM batches with all-match and genuinely filtered results
- Original catalog message audit: no original English message IDs removed; thirteen new status/error/accessibility messages translated into Chinese
- Rust sources and Cargo manifest/lockfile unchanged

The engine parity checker compares structure, IDs, counts and resource amounts exactly. Float-valued native JSON and WASM values allow a 1e-6 relative tolerance for f32 serialization differences.

Interaction tests cover real App/Radix ruleset editing, actual IndexedDB profile persistence, Save-to-Start, seed-zero results, theme/language switching, leading-decimal editing, repeated/interrupted search, cancellation, stale navigation, profile selection, export failures, and keyboard controls.

## Limits

- Public browser QA is now available after deployment. At 1180×757, both the original and refactored finder show the complete settings/rules/start interface without horizontal scrolling. Resource icons measure 18×18. Live WASM search over seeds 0–4, profile persistence, TXT export contents, galaxy/star viewing, and Chinese switching were checked. A visual follow-up restores fixed-width numeric fields and prevents narrow selector labels wrapping.
- The Windows build and Pages deployment passed for publication commit `31e6d297b85299b1c187ae63702cfcb67128de22`, including all 115 tests, Rust tests and engine parity. The Windows download URL returns HTTP 200. Local full build and engine tests also passed on Linux.
- Vite reports a nonblocking warning for chunks over 500kB (the application and ExcelJS workbook worker).
- The upstream calculator license is retained byte-for-byte, including its original whitespace/line endings. Source whitespace checks pass with that vendored license excluded.
- Publication to `master` and its GitHub Pages deployment were authorized after the default branch was renamed. Deployment filters now target `master`; subsequent fixes are checked and redeployed through the same workflow.

## Applying the patch

Apply `dsp-seed-finder-react-refactor.patch` to the exact baseline above with `git apply`. The source ZIP contains the complete editable source tree but excludes `.git`, dependencies, generated WASM/native binaries, and `dist`. Install Rust, wasm-pack 0.14.0 and Node 24, then run `npm ci` and `npm run build` before the checks.
