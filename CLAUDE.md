# Kindred

A prototype PWA that helps families coordinate care. `web/` is the React + Vite app, `supabase/` holds migrations, Edge Functions and pgTAP tests, and `docs/` holds the PRD, ADR and implementation plan.

## How to work

- Work from your GitHub issue. Don't read the full PRD or ADR unless the issue links to a section.
- The spec lives in `docs/implementation-plan.md` §4. Update it in the same PR that changes an RPC, error code or table.
- Before opening a PR: run all checks, run `/code-review` and fix its findings, then write a plain-language PR description (what changed, how to try it on a phone) with `Closes #N`.
- No secrets, team names or email addresses in the repo.

## Checks

- Web, in `web/`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Database: `supabase db start` then `supabase test db`. Only one local Supabase stack can run at a time across worktrees; elsewhere, rely on CI.

## Database

- All state changes go through Postgres RPC functions. The app never inserts, updates or deletes circle data directly.
- Migrations use the Supabase CLI's timestamped names (`supabase migration new <name>`). Never edit a merged migration; add a new one.
- Regenerate `web/src/lib/database.types.ts` after schema changes (`supabase gen types typescript --local`).

## App

- Screens call `web/src/platform/`, never browser APIs directly.
- All UI text goes through `i18next` (`web/src/i18n/locales/en-CA.json`).
- Status is always shown as text plus colour. 44px tap targets, safe-area insets, `rem` units.
- Colours, radii, spacing and fonts are CSS variables in `web/src/styles/tokens.css`.
