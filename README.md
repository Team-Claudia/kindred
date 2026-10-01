# Kindred

Kindred helps families coordinate care without forcing them to abandon the tools they already use. It is a mobile app (iOS/Android) that gives families sharing caregiving responsibilities one place to see what needs to happen, who has agreed to handle it, who is available, and what has changed.

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Prototype user flow](docs/user-flow.md)
- [Architecture Decision Record](docs/ADR.md)
- [How Kindred is built (plain English)](docs/architecture-explained.md)
- [Implementation plan](docs/implementation-plan.md)
- [Demo Day](docs/demo-day.md)
- [Wireframes](docs/wireframes/README.md)

## Local development

1. Copy `.env.example` to `.env.local` and fill it in from the shared password manager.
2. In `web/`: `npm install`, then `npm run dev`.
3. For the database (needs Docker and the Supabase CLI): `supabase start` at the repo root.
