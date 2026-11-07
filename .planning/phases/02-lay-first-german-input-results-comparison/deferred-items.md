# Deferred items (phase 02)

## From 02-06

- **Flaky e2e: `e2e/frame.spec.js:117` "smart PD (RX-06) › "64" is the binocular PD: 32 mm per eye" [desktop].**
  It failed once in the 02-06 plan-end full run (`Expected: "32,0 mm"`, `Received: "31,5 mm"` at line 122). It passed 20/20 with `--repeat-each=10`, and the following full `npm run test:e2e` passed 182/182. Cause (read from the spec, not proven): line 122 reads `#rx-os-pd-echo` with a one-shot `text()` right after a retrying `toContainText` on the OD echo, so the read can land before the left echo updates under parallel load. 02-06 changed no page code. A fix would be a retrying `await expect(page.locator('#rx-os-pd-echo')).toHaveText('32,0 mm')`. Out of 02-06 scope, not fixed.
  - **Resolved in 02-07** (`fix(02-07)`). Cause proven, not guessed: a probe spec filled OD '64', waited one rAF + setTimeout, and read `OD "64,0 mm Gesamt-PD → je 32,0 mm" | OS "31,5 mm"` with the OS field still '31,5'. When the input frame runs between the two `fill()` calls, the OD echo already passes `toContainText('Gesamt-PD')` and the one-shot OS read sees the example's 31,5. The next frame (OS cleared) gives 32,0. The app converges, so this was a test race, not an app bug. Fix: both echoes asserted with retrying `toHaveText`. Proof: `npx playwright test e2e/frame.spec.js --repeat-each=20 --workers=8` while a full `npx playwright test` ran at the same time: 520/520 passed.

## From 02-07

- **Load-sensitive under deliberate overload: `e2e/worker.spec.js:176` "rechnet …" marks old values (slow worker) [desktop].** It failed once with its own guard `busy window too short` in the full suite that ran *concurrently* with the 8-worker frame.spec repeat run above (two suites, about 16 browsers on 8 cores). The axe scan inside the 2000 ms slow-worker window took longer than the window. Not seen in normal single-suite runs. Not fixed; the guard does its job (it says the window was too short, not that the app is wrong). If it recurs in a normal run, lengthen the slowWorker delay for that test.

