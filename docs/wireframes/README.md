# Kindred — Wireframes

Low-fidelity screens for the Kindred prototype, one PNG per screen. They show layout, content and flow. Visual design (colour, illustration, final type) is applied later through design tokens (implementation plan §4.6 and task 4.4).

All screens use the same example family: **Maya** (the signed-in user and an admin), **Jonah** and **Ada**, caring for **Dad**. "Today" is Thursday 25 September, in the week of Mon 22 – Sun 28 September.

## Editing the wireframes

The screens are built in HTML so anyone, including Claude Code, can change them:

- **Source:** [`src/wireframes.html`](src/wireframes.html). Each `<section class="screen">` is one screen. Open the file in a browser to see them all, or add `#home` (or any screen ID) to the address to see one.
- **Render:** `docs/wireframes/src/render.sh` regenerates every PNG, or pass one screen ID (`render.sh home`) to regenerate just that one. It needs Google Chrome and an internet connection for the fonts.
- **Adding a screen:** add a `<section>` with an `id` and a `data-h` height in CSS pixels (a phone screen is 390 × 844), add its ID to `SCREENS` in `render.sh` (the order sets the file number), then add it to the table below.

Screens 01–30 are built in HTML. Most were rebuilt from the first wireframe export on 2026-09-28 with the changes agreed that day (see [Decisions](#decisions-behind-these-screens)); screens 07–10, 17, 23 and 24–27 were added the same day to cover the rest of the PRD's prototype scope. Screen 31 is still the original export.

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

### Joining and installing

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 07 | [Invite link](07-join-invite.png) | What someone sees when they open an invite link: who invited them, who's already in, sign in with Google or an email code | US 3.1 |
| 08 | [Join · one last thing](08-join-relationship.png) | After signing in: name, the care recipient's relationship to them, terms, **Join**. Explains the one-circle rule (BR-12) | US 3.1, 2.1 |
| 09 | [Add to Home Screen](09-add-to-home-screen.png) | Shown in Safari until Kindred is installed: three steps, with Safari's Share button highlighted | ADR-001, ADR-010 |
| 10 | [Turn on notifications](10-allow-notifications.png) | Shown once, in the installed app, before the phone's own permission prompt: what Kindred will notify about | Epic 11, ADR-010 |

Not drawn: an expired invite, and opening an invite while already in another Care Circle. Both show a short message with a way back to Home.

### Main tabs

The bottom tabs are **Home**, **This week**, **Updates** and **Summary**. Members, calendar and settings open from your initial at the top of Home (screen 30).

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 11 | [Home](11-home.png) | Counts; **Needs your answer** with Accept / Decline; today; needs someone with **I'll do it**; latest update; **Quick add** | §9 |
| 12 | [This week](12-this-week.png) | Items by day with owner and status (Overdue, Needs someone, Awaiting Maya, done); filter by person; previous and next week | §9, US 4.1 |
| 13 | [Updates](13-updates.png) | One thread of family updates, each optionally linked to a task or appointment | Epic 10 |
| 14 | [Weekly summary](14-weekly-summary.png) | "What happened, what's still open", made every Sunday from the week's items and updates, with actions for open items and **Share with family** | US 10.3 |

### Adding things

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 15 | [Quick add](15-quick-add.png) | Bottom sheet: Task, Appointment, or Update or note | US 4.2, 7.1, 10.1 |
| 16 | [New task](16-new-task.png) | Title, due date, optional time, repeat, notes, ask someone or nobody yet | US 7.1, 7.3 |
| 17 | [Repeat](17-repeat-options.png) | Doesn't repeat, daily, weekly or monthly, with an optional end date | US 7.6, BR-10 |
| 18 | [New appointment](18-new-appointment.png) | Title, date, time, repeat, location with map preview, who is taking Dad, notes | US 4.2, 4.3 |
| 19 | [New update](19-new-update.png) | Free text, link to an item or nothing, who gets told | US 10.1 |

### Owning and finishing items

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 20 | [Ask someone](20-assign-to.png) | Bottom sheet: **who's free** at that time (Free, Busy or Unknown), each member's load this week, or leave it unclaimed; the person is asked to accept | US 6.1–6.2, 7.3–7.4 |
| 21 | [Task awaiting your answer](21-task-awaiting-you.png) | "Ada asked you to do this", **Accept** / **Decline** | US 7.3, 11.1, BR-02 |
| 22 | [Task detail](22-task-detail.png) | Owner, due date, added by, notes, linked updates, **Mark done**, **Need coverage** with the allowance, **Reassign**, Share | US 7.5, 7.8, 8.1 |
| 23 | [Appointment detail](23-appointment-detail.png) | Owner, when, where with map, notes, its updates, follow-up tasks, **Add update**, **Create follow-up task**, Share | US 4.3, 10.1–10.2 |

### Sharing and coverage

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 24 | [Share](24-share-item.png) | The phone's own share sheet with Kindred's pre-written message and link. Private notes are left out | Epic 9 |
| 25 | [Ask for cover](25-need-coverage.png) | Confirm sheet: "1 of 2 left this month", who's free, then share to the family chat | US 8.1, BR-01 |
| 26 | [Cover request](26-coverage-request.png) | What the rest of the family sees: "Maya needs cover", **I can do it**. If someone got there first, they see who's covering | US 8.2 |
| 27 | [Cover limit reached](27-coverage-limit.png) | Both requests used: message the family or ask one person directly instead | BR-01 |

### Overdue and notifications

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 28 | [Overdue task](28-task-overdue.png) | Who was told (owner and admins), take it, ask someone else or the whole circle, mark done, change the date | US 11.5, 7.8 |
| 29 | [Notifications](29-notifications.png) | In-app list with unread dots: overdue, requests, updates, unclaimed items, summary ready | US 11.6 |

### Care Circle and settings

| # | Screen | What it shows | PRD |
| --- | --- | --- | --- |
| 30 | [Care Circle and settings](30-care-circle-settings.png) | Members (admins: remove), invite link, Google Calendar free/busy, calendar feed, notification categories, export, leave, delete account | §9, Epics 1–3, 5, 11 |

### Later, not in the prototype

| # | Screen | What it shows |
| --- | --- | --- |
| 31 | [This week · desktop](31-desktop-this-week.png) | A wide layout for laptops. The prototype shows the phone layout centred on wide screens (ADR-002). This is the original export, so it still says "Core Circle" |

## Decisions behind these screens

Agreed on 2026-09-28 when the first wireframes were compared with the PRD and ADR. The PRD decision log records each one.

| Question | Decision |
| --- | --- |
| Assigning | Keep **Accept / Decline**: someone isn't the owner until they accept (screens 11, 12, 16, 20, 21) |
| Weekly summary | Built from a template, **no AI** (screen 14) |
| Sign-in | **Passwordless**: Google, email code, Try the demo (screens 01–03, 07) |
| Invites | **Share an invite link** through the phone's share sheet (screens 06, 07) |
| Updates | One **Updates thread**, posts optionally linked to an item; **no @mentions** (screens 13, 19) |
| Voice notes | **Not in the prototype** |
| Loved one | Name and **relationship**; **no photo** (screens 05, 08) |
| Overdue | The **owner and admins** are told (screens 06, 28, 29) |
| Notifications | **Web push and an in-app list** (screen 29) |
| Map | **Embedded map** on appointments (screens 18, 23) |
| Navigation | Tabs **Home / This week / Updates / Summary**; settings from your initial (screen 30) |
| Desktop | **Later** (screen 31) |
| Group name | **Care Circle**, as in the PRD (the first wireframes said "Core Circle") |
