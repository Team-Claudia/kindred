# Kindred — Wireframes

Low-fidelity screens for the Kindred prototype, one PNG per screen. They show layout, content and flow. Visual design (colour, illustration, final type) is applied later through design tokens (implementation plan §4.6 and task 4.4).

All screens use the same example family: **Maya** (the signed-in user and an admin), **Jonah** and **Ada**, caring for **Dad**. "Today" is Thursday 25 September, in the week of Mon 22 – Sun 28 September.

## Editing the wireframes

The screens are built in HTML so anyone, including Claude Code, can change them:

- **Source:** [`src/wireframes.html`](src/wireframes.html). Each `<section class="screen">` is one screen. Open the file in a browser to see them all, or add `#home` (or any screen ID) to the address to see one.
- **Render:** `docs/wireframes/src/render.sh` regenerates every PNG, or pass one screen ID (`render.sh home`) to regenerate just that one. It needs Google Chrome and an internet connection for the fonts.
- **Adding a screen:** add a `<section>` with an `id` and a `data-h` height in CSS pixels (a phone screen is 390 × 844), add its ID to `SCREENS` in `render.sh` (the order sets the file number), then add it to the table below.

Screens 01–20 were rebuilt in HTML from the first wireframe export on 2026-09-28, with the changes agreed that day (see [Decisions](#decisions-behind-these-screens)). Screen 21 is still the original export.

## Screens

### Getting started

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 01 | [Welcome](01-welcome.png) | One-line pitch; **Continue with Google**, **Email me a code**, **Try the demo**; "not a medical record" disclaimer | US 1.2 |
| 02 | [Sign in with email](02-sign-in-email.png) | Email field and **Email me a code**. The same step for new and returning people | US 1.1–1.2 |
| 03 | [Enter code](03-enter-code.png) | 6-digit code, send a new code, use a different email | US 1.2 |
| 04 | [Set up · you](04-setup-your-name.png) | Step 1 of 3: your name (filled in from Google if used), terms | US 1.1 |
| 05 | [Set up · your loved one](05-setup-loved-one.png) | Step 2 of 3: what the family calls them, their relationship to you | US 2.1 |
| 06 | [Set up · invite your Care Circle](06-setup-invite-circle.png) | Step 3 of 3: **Share invite link**, members who have joined, option to make someone an admin, skip for now | US 3.1, 2.2 |

The prototype's built-in email only delivers codes to the team's own addresses (ADR-004), so people outside the team use Google or Try the demo.

### Main tabs

The bottom tabs are **Home**, **This week**, **Updates** and **Summary**. Members, calendar and settings open from your initial at the top of Home (screen 20).

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 07 | [Home](07-home.png) | Counts; **Needs your answer** with Accept / Decline; today; needs someone with **I'll do it**; latest update; **Quick add** | §9 |
| 08 | [This week](08-this-week.png) | Items by day with owner and status (Overdue, Needs someone, Awaiting Maya, done); filter by person; previous and next week | §9, US 4.1 |
| 09 | [Updates](09-updates.png) | One thread of family updates, each optionally linked to a task or appointment | Epic 10 |
| 10 | [Weekly summary](10-weekly-summary.png) | "What happened, what's still open", made every Sunday from the week's items and updates, with actions for open items and **Share with family** | US 10.3 |

### Adding things

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 11 | [Quick add](11-quick-add.png) | Bottom sheet: Task, Appointment, or Update or note | US 4.2, 7.1, 10.1 |
| 12 | [New task](12-new-task.png) | Title, due date, optional time, notes, ask someone or nobody yet | US 7.1, 7.3 |
| 13 | [New appointment](13-new-appointment.png) | Title, date, time, location with map preview, who is taking Dad, notes | US 4.2, 4.3 |
| 14 | [New update](14-new-update.png) | Free text, link to an item or nothing, who gets told | US 10.1 |

### Owning and finishing items

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 15 | [Ask someone](15-assign-to.png) | Bottom sheet: pick a member (with their load this week) or leave it unclaimed; the person is asked to accept | US 7.3–7.4 |
| 16 | [Task awaiting your answer](16-task-awaiting-you.png) | "Ada asked you to do this", **Accept** / **Decline** | US 7.3, 11.1, BR-02 |
| 17 | [Task detail](17-task-detail.png) | Owner, due date, added by, notes, linked updates, **Mark done**, **Reassign** | US 7.5, 7.8 |
| 18 | [Overdue task](18-task-overdue.png) | Who was told (owner and admins), take it, ask someone else or the whole circle, mark done, change the date | US 11.5, 7.8 |
| 19 | [Notifications](19-notifications.png) | In-app list with unread dots: overdue, requests, updates, unclaimed items, summary ready | US 11.6 |

### Care Circle and settings

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 20 | [Care Circle and settings](20-care-circle-settings.png) | Members (admins: remove), invite link, Google Calendar free/busy, calendar feed, notification categories, export, leave, delete account | §9, Epics 1–3, 5, 11 |

### Later, not in the prototype

| # | Screen | What it shows |
| --- | --- | --- |
| 21 | [This week · desktop](21-desktop-this-week.png) | A wide layout for laptops. The prototype shows the phone layout centred on wide screens (ADR-002). This is the original export, so it still says "Core Circle" |

## Decisions behind these screens

Agreed on 2026-09-28 when the first wireframes were compared with the PRD and ADR. The PRD decision log records each one.

| Question | Decision |
| --- | --- |
| Assigning | Keep **Accept / Decline**: someone isn't the owner until they accept (screens 07, 08, 12, 15, 16) |
| Weekly summary | Built from a template, **no AI** (screen 10) |
| Sign-in | **Passwordless**: Google, email code, Try the demo (screens 01–03) |
| Invites | **Share an invite link** through the phone's share sheet (screen 06) |
| Updates | One **Updates thread**, posts optionally linked to an item; **no @mentions** (screens 09, 14) |
| Voice notes | **Not in the prototype** |
| Loved one | Name and **relationship**; **no photo** (screen 05) |
| Overdue | The **owner and admins** are told (screens 06, 18, 19) |
| Notifications | **Web push and an in-app list** (screen 19) |
| Map | **Embedded map** on appointments (screen 13) |
| Navigation | Tabs **Home / This week / Updates / Summary**; settings from your initial (screen 20) |
| Desktop | **Later** (screen 21) |
| Group name | **Care Circle**, as in the PRD (the first wireframes said "Core Circle") |

## Still without a screen

These PRD features are in the prototype but have no wireframe yet. They can be drawn in `src/wireframes.html` or built straight from the PRD:

- **Coverage** (Epic 8): "Need coverage — N of 2 remaining", the request, **I can do it**, limit reached.
- **Joining from an invite link** (US 3.1): the `/join/<code>` screen.
- **Add to Home Screen** guide and the notification permission prompt (ADR-010).
- **Who's free?** availability when assigning (Epic 6).
- **Repeat** options on new tasks and appointments (US 7.6).
- **Share to the messaging app** from an item (Epic 9).
- **Appointment detail** with its updates and **Create follow-up task** (US 10.2).
