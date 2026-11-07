# Deferred items (phase 02)

## From 02-06

- **Flaky e2e: `e2e/frame.spec.js:117` "smart PD (RX-06) › "64" is the binocular PD: 32 mm per eye" [desktop].**
  It failed once in the 02-06 plan-end full run (`Expected: "32,0 mm"`, `Received: "31,5 mm"` at line 122). It passed 20/20 with `--repeat-each=10`, and the following full `npm run test:e2e` passed 182/182. Cause (read from the spec, not proven): line 122 reads `#rx-os-pd-echo` with a one-shot `text()` right after a retrying `toContainText` on the OD echo, so the read can land before the left echo updates under parallel load. 02-06 changed no page code. A fix would be a retrying `await expect(page.locator('#rx-os-pd-echo')).toHaveText('32,0 mm')`. Out of 02-06 scope, not fixed.
