# Testing

Passing tests are the minimum bar, not the goal. The goal is a suite that would actually fail if the behavior it claims to protect broke. Everything below exists to keep the gap between those two as small as possible.

## Where tests come from

- `architect` writes acceptance criteria and a test plan *before* implementation exists, mapping each test to the criterion it proves (`.claude/plans/0000-template.md`). If you're writing a test with no acceptance criterion behind it, either the plan is missing something — go back to `architect` — or the change was trivial enough not to need a plan at all.
- `builder` implements the tests from that mapping, not tests invented ad hoc, and runs them locally before reporting done.
- `verifier` audits the result — not by re-reading the tests and nodding, but by deliberately breaking the behavior a test claims to cover and confirming the test actually catches it. See `.claude/agents/verifier.md`.

## What makes a test worth keeping

- **It fails for a specific reason.** If you can't say in one sentence what real-world bug would turn this test red, it isn't pulling its weight.
- **It asserts a concrete expected value, not a recomputation of the implementation's own logic.** A test that derives its expected output the same way the code under test does will pass even if both are wrong in the same way — this is the single most common way a green suite hides a broken feature.
- **It's deterministic.** No reliance on wall-clock time, network calls, or test execution order. A flaky test gets fixed or deleted on sight — it doesn't get a retry loop or a "known flaky" label that nobody revisits.
- **Its name states the behavior under test**, not `test1` or `test_edge_case` — a name like `rejects_expired_token` tells `explainer` and the next human what broke without opening the file.

## On coverage percentage

Coverage tells you what code has *never been executed* by a test — genuinely useful for finding gaps. It does not tell you whether the code that *was* executed was meaningfully checked: 100% coverage is fully compatible with a suite that asserts nothing (see the compute-score example this convention's design notes reference). Don't set or chase a blanket coverage number as a quality target. Use coverage reports to find untested paths, then ask whether those paths have acceptance criteria behind them — if they don't, that's a planning gap, not just a testing one.

## Test pyramid, loosely

Most tests should be fast, isolated unit tests close to the code they check. A smaller number of integration tests should cover the seams between components (the database, an external API, the UI talking to the backend). End-to-end tests covering full user flows should be fewer still — they're the most valuable signal when they fail, and the most expensive and flakiest to maintain, so reserve them for the acceptance criteria that genuinely span the whole system.

## CI and local parity

Run the relevant target's test command from `CLAUDE.md`'s Build & test table locally before considering any task done. CI (`.github/workflows/ci.yml`) runs the same command, per target, on every push — a green local run and a red CI run means the environments have diverged, which is itself worth a decision record if it happens more than once.

Don't delete or weaken a test to make it pass. If a test is wrong, say so explicitly and explain why in the commit message or plan file — don't just quietly adjust it.
