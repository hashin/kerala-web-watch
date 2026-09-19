# Code style

These apply regardless of language; adapt the specifics to the idioms of whichever target/stack you're working in (see `CLAUDE.md`'s Build & test table).

- **Name things for what they mean, not how they're implemented.** `active_users`, not `filtered_list_2`.
- **One level of abstraction per function.** If a function mixes high-level orchestration with low-level detail, split it.
- **Comments explain *why*, not *what*.** If a comment just restates the line below it in English, delete it. If a decision would look wrong or arbitrary without context, that context belongs in a comment or, if it's project-wide, in `docs/DECISIONS.md`.
- **No dead code.** Delete it; git history is the archive, not commented-out blocks.
- **Handle errors explicitly.** Don't swallow exceptions or ignore failure return values silently. If something can fail, the failure path should be as deliberate as the success path.
- **Keep functions short enough to hold in your head.** There's no universal line count, but if you can't summarize a function's purpose in one sentence, it's probably doing more than one thing.

## The explainer bar

Before considering any non-trivial piece of code finished, it should pass the `explainer` subagent's readability check without the explainer having to guess at intent. This isn't a suggestion for style points — it's the actual test this project uses for "is this code good enough to merge." If `explainer` can't explain it accurately, don't fix the explainer's prompt; fix the code or add the documentation it was missing.
