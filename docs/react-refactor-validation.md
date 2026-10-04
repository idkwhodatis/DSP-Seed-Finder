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
- Original catalog message audit: no original English message IDs removed; ten new status/error messages translated into Chinese
- Rust sources and Cargo manifest/lockfile unchanged

The engine parity checker compares structure, IDs, counts and resource amounts exactly. Float-valued native JSON and WASM values allow a 1e-6 relative tolerance for f32 serialization differences.

Interaction tests cover real App/Radix ruleset editing, actual IndexedDB profile persistence, Save-to-Start, seed-zero results, theme/language switching, leading-decimal editing, repeated/interrupted search, cancellation, stale navigation, profile selection, export failures, and keyboard controls.

## Limits

- Browser screenshot and same-viewport visual comparison of the refactored build have not been completed. The available cloud browser blocks localhost previews. Compact dimensions are preserved in CSS and covered where practical by component tests, but this does not substitute for visual QA.
- The Windows GitHub Actions workflow has been updated but has not run remotely. Local full build and engine tests ran on Linux; Windows executable download is conditionally included only when that executable exists.
- Vite reports a nonblocking warning for chunks over 500kB (the application and ExcelJS workbook worker).
- The upstream calculator license is retained byte-for-byte, including its original whitespace/line endings. Source whitespace checks pass with that vendored license excluded.
- Publication to `master` and its GitHub Pages deployment were authorized after the default branch was renamed. Deployment filters now target `master`; remote build and visual QA results will be verified after publication.

## Applying the patch

Apply `dsp-seed-finder-react-refactor.patch` to the exact baseline above with `git apply`. The source ZIP contains the complete editable source tree but excludes `.git`, dependencies, generated WASM/native binaries, and `dist`. Install Rust, wasm-pack 0.14.0 and Node 24, then run `npm ci` and `npm run build` before the checks.
