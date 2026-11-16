# Mutation testing: Issue #64 -- Scan document content for credentials on update

**PR(s):** #TODO  **Tool:** StrykerJS 10.1.1 with `@stryker-mutator/vitest-runner`  **Config:** [stryker.config.mjs](../../../stryker.config.mjs) and [vitest.stryker.config.ts](../../../vitest.stryker.config.ts) (my own setup, merged in #105)  **Command:** `$env:STRYKER_VITEST_PROJECTS="app,shared-node"; $env:TZ="UTC"; yarn stryker run --mutate "app/scenes/Document/hooks/useCredentialScan.ts,shared/utils/credentialPatterns.ts:72-119"`
**Reports:** [before](reports/64-TheOneWhoWished-before.json) · [after](reports/64-TheOneWhoWished-after.json)
**Mutation score:** before 33.10% → after 40.00% (covered code: 88.89% → 93.55%)

Only the code this PR added was mutated: all of `useCredentialScan.ts` (new file) and lines 72–119 of `credentialPatterns.ts` (`findCredentialMatches`). `findCredentialMatches` scored 100% in both runs. The PR's edits to `Document.tsx` and `Editor.tsx` only wire the hook in and have no unit tests, so they were not mutated.

| Run | Killed | Timeout | Survived | No coverage | Ignored (static) |
|---|---|---|---|---|---|
| Before | 48 | 0 | 6 | 91 | 1 |
| After | 57 | 1 | 4 | 83 | 1 |

## Surviving mutants

All six survivors from the before report are listed; there were fewer than 10, so every one is analyzed. All are in lines this PR added.

| Location (file:line) | Mutation | Equivalent or test gap? | Why |
|---|---|---|---|
| useCredentialScan.ts:34 | `if (globalThis.crypto?.subtle)` → `if (true)` | Test gap (killed in after) | Tests ran where Web Crypto always exists, so the fallback hash used in non-secure contexts (self-hosted Outline over plain HTTP) was never run. A test with `crypto` stubbed out makes the mutant crash. |
| useCredentialScan.ts:34 | `globalThis.crypto?.subtle` → `globalThis.crypto.subtle` | Test gap (killed in after) | Only differs when `crypto` is undefined, which no test simulated. Not equivalent, since stubbing `crypto` as undefined kills it. |
| useCredentialScan.ts:70 | `stored.filter((fp) => typeof fp === "string")` → `stored` | Test gap | The "malformed" test stores an object, not an array with non-string entries, so the filter is never exercised. Low impact: a stray number or null never equals a real fingerprint. |
| useCredentialScan.ts:70 | `typeof fp === "string"` → `true` | Test gap | Same cause as above: no test stores an array like `["a", 1, null]`. |
| useCredentialScan.ts:88 | `merged.delete(fp);` → removed | Test gap | Deleting before re-adding moves a re-dismissed fingerprint to the newest end, so the 200-entry cap keeps it. No test re-dismisses an old fingerprint and then pushes the set past the cap. |
| useCredentialScan.ts:108 | `if (!byValue.has(value))` → `if (true)` | Equivalent | The mutant lets a repeated value overwrite its type name with a later match's name. Repeats of the same text always come from the same pattern, since each pattern's match includes its own distinct prefix or format, so the name, keys and count never change. |

Testing the fallback hash also covered 8 mutants that had no coverage before. Two of them survived an intermediate run, `useCredentialScan.ts:47` (`i < value.length` → `i <= value.length`) and `useCredentialScan.ts:56` (`+` → `-` when combining the hash halves), because they change the exact hash but keep it stable and distinct. The known-answer tests below kill both; they show as killed in the after report.

## New or strengthened test

Commit: TODO · Test: `app/scenes/Document/hooks/useCredentialScan.test.ts` › fingerprintCredential › without the Web Crypto API (non-secure contexts) › falls back to a non-cryptographic hash when crypto is undefined / when crypto.subtle is undefined · Kills: `useCredentialScan.ts:34` (both survivors)

Test: `app/scenes/Document/hooks/useCredentialScan.test.ts` › fingerprintCredential › without the Web Crypto API (non-secure contexts) › matches the reference cyrb53 hash for `""` / `"a"` / the AWS test key · Kills: `useCredentialScan.ts:47` and `useCredentialScan.ts:56`

## Questions

1. **What did the surviving mutants reveal about your tests?**
   The tests only covered the environment they happen to run in. Vitest's jsdom always has Web Crypto, so the fallback hash, which every self-hosted instance served over plain HTTP would use, had no tests at all. If it had returned colliding fingerprints, dismissing one credential would have silenced warnings for every other credential in the document, and nothing would have failed. The storage tests covered the happy path but not malformed array contents or re-dismissing an old fingerprint near the cap. The no-coverage count (83 mutants, nearly all in the React hook) shows the larger gap: the debounce, remote-edit filtering, flush on "Done editing" and toast logic are only checked manually.

2. **Did any surviving mutant point to an assertion whose expected value was not based on the requirements? Explain.**
   No. The survivors came from missing assertions, not wrong ones. The closest case was the fallback hash: the first new tests checked only properties (format, stable, distinct), so mutants that changed the exact value still survived. To kill them, the known-answer tests had to pin exact values, and copying them from the current code's output would have made the expected values come from the implementation instead of a requirement. Instead, the values were checked against the reference cyrb53 implementation (github.com/bryc/code, `jshash/experimental/cyrb53.js`), and the requirement they protect is that fingerprints stay the same across releases so that saved dismissals keep working. The existing SHA-256 test's `/^[0-9a-f]{64}$/` check is an implementation detail rather than a requirement, but no survivor pointed at it.

3. **If you used AI to configure the tool, analyze survivors, or write tests, what did it produce and what did you verify or correct? If AI was not used, write "N/A."**
   TODO
