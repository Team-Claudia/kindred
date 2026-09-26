---
name: Build task
about: One task from the implementation plan, with the context a Claude Code session needs to build it
title: "<ID> <name>"
labels: task
---

<!--
One issue per task in docs/implementation-plan.md §6. Add the phase label (e.g. phase-1).
Copy context in full rather than linking to it, so the session doesn't need to read the whole PRD or ADR.
-->

## Task

<!-- What to build, from the task table. -->

## Done when

- [ ] <!-- From the task's "Done when" column. -->

## Depends on / runs alongside

- **Depends on:** <!-- #issue, or "nothing" -->
- **Runs alongside:** <!-- #issues that can be built in parallel -->

## Context

<!--
The passages this task needs, copied in full, each with its source. For example:
- PRD user stories and their acceptance criteria
- PRD business rules (BR-xx)
- ADR decisions (ADR-0xx), trimmed to what applies
- Implementation plan §4 spec rows (tables, RPCs, errors, routes)
-->

## Links

<!-- Full sections, only for when the excerpts above aren't enough. -->

## Checks before the PR

- [ ] Typecheck, lint, Vitest and build pass; pgTAP passes if the database changed
- [ ] `/code-review` run on the changes and its findings fixed
- [ ] State changes only through RPCs; no direct table writes from the app
- [ ] New user-facing text goes through `i18next` (`en-CA`)
- [ ] PR description in plain language: what changed, how to try it on a phone, and `Closes #<this issue>`
