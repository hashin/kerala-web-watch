# Plans and decisions in this repository

This project was designed up front. Two committed files already play the roles the generic convention gives to
`.claude/plans/` and `.claude/decisions/`:

## Plans → `docs/IMPLEMENTATION.md` (work packages)

The 34 work packages are the plans: each has a goal, files touched, steps, a mechanical **Verify** section and a
**Done when** acceptance criterion. Work from them. Progress is tracked in `docs/STATE.md`, not inside the WP text.

`.claude/plans/` is only for work that is **not** a WP — a bug found in production, a feature someone asks for after
Phase 5, a refactor. For those, `architect` writes `.claude/plans/YYYY-MM-DD-<slug>.md` from `0000-template.md`
with numbered, falsifiable acceptance criteria and a test plan mapped to them, before any code.

## Decisions → `docs/DECISIONS.md` (single-file ADR log)

Append-only, numbered `ADR-NNN`, format described at the top of the file. Write one when a real alternative was
rejected, when a future session would ask "why is it done this way?", or when narrowing a rule. Never delete;
supersede. A deviation from `docs/DESIGN.md` is a **Proposed** ADR plus an open question in `docs/STATE.md` — and
a stop, not a silent workaround (see `CLAUDE.md`, Decision protocol).

## State → `docs/STATE.md`

Updated at the end of every session. Its **Next action** line is the literal next command or edit.
