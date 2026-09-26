# Kindred — Implementation Planning Brief

Inputs for writing the implementation plan. Read this with [PRD.md](PRD.md), [user-flow.md](user-flow.md), [ADR.md](ADR.md) and [judging-criteria.md](judging-criteria.md). Where this brief and the ADR's build plan (§6) disagree on dates, this brief is newer.

**Last updated:** 2026-09-26 (Demo Day confirmed as 17 October)

---

## 1. Timeline

| Date | Milestone |
| --- | --- |
| 2026-09-28 (Mon) | Build starts |
| 2026-10-03 | productBC "How to Pitch" workshop |
| Suggest ~2026-10-13 | Feature freeze: only fixes and demo polish after this |
| Suggest ~2026-10-14 | Backup demo video recorded |
| **2026-10-17 (Sat)** | **Demo Day**: the judged 7-minute pitch with live demo |
| 2026-10-24 | ProductBC Conference: showcase for the **top three teams** only; not a judging round |

About **3 weeks** of build time (28 September – 17 October). If Kindred reaches the top three, the week before 24 October is for polish.

## 2. Demo format

- **Live demo** on the team's iPhones, with the web app added to the Home Screen.
- A **recorded video demo** made beforehand as a backup. The plan needs a feature freeze and time to record, with stable demo data.
- The demo follows PRD §28 (normal coordination) and §29 (coverage), so it needs **at least two, ideally three, signed-in members** in one Care Circle, with realistic sample data (a named care recipient, appointments, recurring tasks, some history).
- Judges may try the app on their own phones by opening the URL.

**How judges get in.** With no custom domain, built-in email codes only reach the team (and only 2 emails per hour for the whole project), so judges can't use email sign-in, and adding them in advance or on the day doesn't help. Instead:
- **Sign in with Google** works for any judge with a Google account, with no set-up.
- **"Try the demo" button** (recommended, ~half a day): Supabase anonymous sign-in puts the judge straight into a pre-filled demo Care Circle as a member, with no account or email. Raise the anonymous sign-in rate limit in the Supabase dashboard before Demo Day, because everyone on conference Wi-Fi shares one IP address.

## 3. Team and working model

Four people, none of them software engineers: a PM, a designer, a GTM specialist and a data engineer. **Claude Code writes most of the code**, so the plan should maximise parallel workstreams (for example, separate Claude Code sessions or worktrees for backend, frontend and integrations) with clear interfaces between them.

Team members' names and email addresses are kept out of this repo.

**Repo conventions:** every change goes on a branch with a pull request; `main` is protected.

## 4. Judging criteria and what they mean for the plan

Full text: [judging-criteria.md](judging-criteria.md). Summary:

| Criterion | Weight | Implication for the build |
| --- | --- | --- |
| Problem & Validation | 20% | Not a build task; the team presents user research |
| Solution & Design | 20% | Wireframes and mockups count; keep design artefacts to show the process |
| Execution & Prototype | 25% | A deployed build that someone else can experience. **"Prototype, not MVP"**: no required feature list |
| Viability & GTM | 15% | Not a build task |
| Communication & Product Thinking | 20% | Everyone presents, 7 minutes total; explain the reasoning behind decisions (the ADR and PRD decision log help) |

What this means for the plan:
- **Depth over breadth.** Build the core loop from PRD §28–29 end to end and make it solid: create → assign → accept → hand off (coverage) → share to the messaging app → complete. Other P0 items are candidates to cut or simplify (use the ADR §6 cut order).
- **The demo is short.** A 7-minute pitch covering five criteria leaves maybe 2–3 minutes of demo. Plan the build around a scripted demo path, with sample data that tells the story quickly.
- **Someone else must be able to experience it.** A public URL that judges can open (and a QR code for the slides) matters more than extra features.

## 5. Design

- Designs are **in progress** and will arrive as work-in-progress.
- Approach: build on the default shadcn/ui + Tailwind styling first, and keep all visual styling in design tokens (CSS variables) so the brand can be applied later in about a day.
- Ask the designer for **screen structure early** (wireframes of Home, item detail, assign/accept, coverage, onboarding). Layout and flow changes are the expensive ones late on; colours, type and polish are cheap.
- Designs can be shared as exported PNGs or screenshots in the repo (e.g. `docs/design/`).
- Constraints for the designer: phone-sized web app with safe-area insets, 44px tap targets, status shown as text plus colour, WCAG 2.2 AA (PRD §25).
- The plan should include a **design-application pass** late in the build.

## 6. Accounts and access

The PM is setting these up. Ideally they're owned by a shared team account rather than one person.

| Account | Status | Notes |
| --- | --- | --- |
| Supabase | To do | Region: Canada (Central). Add team emails to the organisation so built-in email codes reach them |
| Vercel | To do | Hobby plan |
| Google Cloud | To do | OAuth client for Google sign-in; Calendar API enabled. Set the consent screen's publishing status to **In production**, not Testing: in Testing mode only listed test users can sign in, which would lock judges out |
| GitHub | Done | `Team-Claudia/kindred` |
| Custom domain | **Not buying** | The app lives at a `*.vercel.app` address |

**Team emails:** collected privately by the PM and never committed to this repo. Needed for the Supabase organisation, so built-in email codes reach the team.

**Sign-in without a domain:** Supabase's built-in email only reaches team addresses, so **judges and anyone outside the team sign in with Google**. Email codes remain for the team. The plan should make Google the prominent sign-in option.

## 7. Plan format

- A markdown file in `docs/` (no GitHub issues for now).
- It's written in a fresh Claude Code session, so it must stand alone and point at the PRD, user flow, ADR and this brief.

## 8. Still to come

- [ ] Team email list (shared privately, not in the repo).
- [ ] Work-in-progress designs.

## 9. Reminders from earlier decisions

- Team phones are all iPhones; no Android devices.
- Budget is $0: free tiers only (ADR §5).
- Where options differ, pick the **easiest and simplest to implement**.
- Web push on iPhone needs the app added to the Home Screen (iOS 16.4+).
- Google app is unverified (no domain, so it can't be verified yet): connecting a calendar shows a "Google hasn't verified this app" screen, capped at 100 users. Tap through it when recording the video and in the live demo, or connect demo accounts beforehand.
- The Supabase free project pauses after a week without activity; keep it active near the demo.
