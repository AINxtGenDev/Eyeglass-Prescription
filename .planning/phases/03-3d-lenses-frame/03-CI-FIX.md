# 03-CI fix: GitHub Actions run 42573586930 (commit 2bd6783)

The run failed in `npm run test:e2e` with 8 failed, 557 passed and 37 skipped tests. All 8 pass on
the dev machine. Nothing was deployed.

## Root cause

There are two causes, and neither one is a flaky test.

1. **Fonts (7 of 8 failures).** The app's font stack is `system-ui, …, 'Noto Sans', sans-serif`.
   The dev machine resolves it to Noto Sans. The ubuntu-latest runner resolves it to **DejaVu Sans**,
   which is about 10–20 % wider. The proof is reproduction: with the official
   `mcr.microsoft.com/playwright:v1.65.0-noble` image (same Playwright 1.65.0, the `--with-deps`
   font set, no DejaVu), all 7 view tests pass. In the same image with only
   `fonts-dejavu-core fonts-dejavu-extra` added (`fc-match system-ui` → DejaVu Sans), exactly the
   same 7 tests fail with the same messages as in CI. Ubuntu's `fontconfig-config` pulls in
   `fonts-dejavu-core`, and the runner image has it. The Playwright image does not. The wider
   font exposed three product faults and one test assumption:
   - **Callouts dropped at 360×780 (failures 3, 4, 5).** Measured pills: '1,8 mm' is 66 px wide in
     Noto and 77 px in DejaVu; 'dickste 4,6 mm' is 114 px in Noto and 139 px in DejaVu. The
     thickest-point callout sits 62 px from the stage's left edge. Every one of its five candidate
     boxes is blocked: outward hits the badge, which is also wider (113 px); below, above and left
     leave the stage; right hits the superior marker. All-or-nothing then removed all six callouts.
     I confirmed this with `layoutLabels` on the measured anchors and sizes: Noto → fit, DejaVu →
     not fit. Product fault: the layout had no fallback for a wide pill near an edge.
   - **Iso label over the keyboard hint at 320×640 (failures 2, 6).** In DejaVu the hint wraps to
     3 lines, so its top edge moves up to stage y 124. The iso '2,0' label ends at y 124.5 on screen.
     The hint's avoid box was measured from the stage's *border* box, but labels are laid out in
     `#view-labels`, which covers the *padding* box (1 px border). So the avoid box sat 1 px too
     low, and a label 0.5 px over the hint passed the layout. With Noto, the 2-line hint simply did
     not reach the label. Product fault: an off-by-one in the coordinate system.
   - **Bar thumbnail at 320 px (failures 7, 8).** In DejaVu the values or the prefixed label do
     not fit next to the thumbnail, so `fitThumb` stepped the thumbnail aside, which is the
     designed behaviour ("another font"). The tests asserted "thumbnail kept", which only holds for
     Noto. Test fault. Rewriting the test to check the rule then found a real **product fault**:
     the stepped-aside text bar does not fit either. 'R 16,3 mm · 15 g | L 17,2 mm · 16 g' is
     320 px at 1rem/600 in DejaVu, against 288 px free. `.num` is `nowrap`, so the numbers ran off
     the right edge of the screen.
2. **Time budget (failure 1).** The keyboard-only D-39 test (dozens of Tabs and several recomputes,
   each settled with a SwiftShader render) takes 14 s on the dev machine and 25–32 s in a
   container on a loaded 4-core machine. That is beyond the 30 s default timeout. The test was
   still making progress when the timeout hit (timeout in `settledCompare` and `keyboard.press`,
   not a hang). Phase 2 had no 3D view, so this test never ran with 3D in CI before. Test fault:
   the budget was too tight. Other long specs in the suite already raise their budget the same way (52 `test.setTimeout`
   calls).

## Fix

- `src/ui/view/label-layout.js`: after the five candidate boxes, each callout tries four more:
  below, above, left and right, slid along the stage edge until they fit. The slid box still spans
  its anchor on the slide axis, so the pill stays next to its marker. Layouts that fitted before
  are unchanged, because the old candidates come first. All-or-nothing is unchanged. New unit test
  with the DejaVu case (it fails on the old code).
- `src/ui/view/view.js` `updateAvoid`: the keyboard-hint avoid box is now computed in the stage's
  padding-box coordinates (`clientLeft`/`clientTop`), the same system as the labels and the badge.
- `src/ui/summary-bar.js` + `style.css`: if the text bar's values do not fit, the bar uses the
  same tight line as next to the thumbnail (`bar-tight`: 12 px side padding, 0,875rem). If they
  still do not fit, for example at a larger text size, they wrap (`bar-wrap`). The bar gets
  taller, but no number is ever clipped. `disableBarThumb` now re-fits too.
- `e2e/view.spec.js`: the two 320 px bar tests assert the font-independent rule. The thumbnail is
  shown iff it fits, and this is measured independently with the thumbnail layout forced on.
  Values are never clipped, the label stays on one line, and the bar is ≤ 59,6 px. New test: at
  150 % text size the values are still never clipped, in any font.
- `e2e/a11y.spec.js`: the D-39 test has `test.setTimeout(90_000)`.

No engine change. No number changed. The UI is de-AT only, and no strings were added.

## Verification

CI-like environment: the official `mcr.microsoft.com/playwright:v1.65.0-noble` image (Playwright
1.65.0, the same version as `@playwright/test`), plus `fonts-dejavu-core fonts-dejavu-extra`
(local image `pw-dejavu:1.65`). The repo is mounted, `CI=true`, and `vite preview` runs inside the
container's own network namespace, so the host ports 4173 and 4180 are not used. Command:
`docker run --rm --ipc=host --cpus=4 --user $(id -u):$(id -g) -e HOME=/tmp -e CI=true -v $PWD:/work -w /work pw-dejavu:1.65 npx playwright test --workers=2`.

| Run | Result |
|---|---|
| Base c16a39f, plain Playwright image (no DejaVu), 7 view tests | all pass: matches the dev machine |
| Base c16a39f, DejaVu image, 7 view tests | same 7 fail as in CI, same messages |
| Base c16a39f, DejaVu image, the 8 CI failures × 2 under load | all 16 fail (D-39 at 30,3 s / 31,4 s) |
| Fix, DejaVu image, the 8 CI failures + the new test × 2 | all pass |
| Fix, plain image, bar tests | 9 / 9 pass (thumbnail path still taken with the narrower font) |
| Fix, DejaVu image, full suite, 4 CPUs, 2 workers | 565 passed, 38 skipped, 1 failed (`worker.spec.js:331`, see below), 33,4 min |

`worker.spec.js:331` ("no 'rechnet …' for a normal edit") is load-sensitive and fails on the base
build under the same load as well. When run alone it passes 12 / 12 on both base and fix in the
DejaVu image. It passed in CI run 42573586930. It is not caused by this fix, so it is logged in
`deferred-items.md`.

Host gates (in order): `npm run lint` exit 0 → `npm run test:coverage` 46 files / 1800 tests
passed, coverage 98,91 % statements → `GITHUB_SHA=$(git rev-parse HEAD) npm run build` ok → port
4173 `000` → `npm run test:e2e`: 566 passed, 38 skipped, 0 failed (17,1 min), exit 0. The extra skip is the new
mobile-only bar test in the desktop project.
