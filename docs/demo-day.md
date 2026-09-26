# Kindred — Demo Day

Notes for preparing the Demo Day pitch and demo. Building the prototype is covered by [implementation-plan.md](implementation-plan.md); how we're scored is in [judging-criteria.md](judging-criteria.md).

## Timeline

| Date | Milestone |
| --- | --- |
| 2026-10-03 | productBC "How to Pitch" workshop |
| **2026-10-13 (Tue)** | **Feature freeze** (end of day): only fixes and demo polish after this |
| Suggest ~2026-10-14 | Backup demo video recorded |
| **2026-10-17 (Sat)** | **Demo Day**: the judged 7-minute pitch with live demo |
| 2026-10-24 | ProductBC Conference: showcase for the **top three teams** only; not a judging round |

If Kindred reaches the top three, the week before 24 October is for polish.

## Demo format

- **Live demo** on phones, with the web app added to the Home Screen.
- A **recorded video demo** made beforehand as a backup, from stable demo data after the feature freeze.
- The demo follows PRD §28 (normal coordination) and §29 (coverage), so it needs **at least two, ideally three, signed-in members** in one Care Circle, with realistic sample data (a named care recipient, appointments, recurring tasks, some history).
- Judges may try the app on their own phones by opening the URL.

## What the pitch needs

- **The demo is short.** A 7-minute pitch covering five criteria leaves maybe 2–3 minutes of demo, so script the demo path around the core loop: create → assign → accept → hand off (coverage) → share to the messaging app → complete.
- **Someone else must be able to experience it.** Put the public URL and a QR code in the slides.
- **Everyone presents** and the team stays within 7 minutes (Communication & Product Thinking, 20%). The PRD decision log and the ADR record the reasoning behind decisions.
- **Show the design process** (Solution & Design, 20%): wireframes, mockups and iterations count, so keep them in `docs/design/`.

## How judges get in

With no custom domain, Supabase's built-in email codes only reach the team (and only 2 emails per hour for the whole project), so judges can't use email sign-in. Instead:
- **Sign in with Google** works for any judge with a Google account, with no set-up.
- **"Try the demo"** uses Supabase anonymous sign-in to put the judge straight into a pre-filled sample Care Circle, with no account or email.

## Before Demo Day

- Raise the anonymous sign-in rate limit in the Supabase dashboard, because everyone on conference Wi-Fi shares one IP address.
- Connect the demo accounts' Google Calendars beforehand, or be ready to tap through the "Google hasn't verified this app" screen (the app is unverified because there's no domain).
- Keep the Supabase project active: free projects pause after a week without activity.
- Web push on iPhone only works with the app added to the Home Screen (iOS 16.4+).
