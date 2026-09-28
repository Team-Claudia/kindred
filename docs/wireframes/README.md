# Kindred — Wireframes

Low-fidelity screens for the Kindred prototype, one PNG per screen. They show layout and content. Visual design (colour, illustration, final type) comes later.

The images were exported from the original wireframe file, which is the editable version. If a screen changes, update it there, export it again as a PNG and replace the file here under the same name so links keep working.

All screens use the same example family: **Maya** (the signed-in user and an admin), her brother **Jonah** and **Ada**, caring for **Dad**, in the week of Mon 22 – Sun 28 September.

## Screens

### Getting started

| # | Screen | What it shows | Flow step |
| --- | --- | --- | --- |
| 01 | [Welcome](01-welcome.png) | First screen: one-line pitch, **Create an account** or **Log in**, "not a medical record" disclaimer | Open Kindred |
| 02 | [Sign up · your account](02-signup-account.png) | Step 1 of 3: name, email, password, terms checkbox | Create account |
| 03 | [Sign up · your loved one](03-signup-loved-one.png) | Step 2 of 3: what the family calls them, relationship, optional photo | Create Care Circle |
| 04 | [Sign up · invite your circle](04-signup-invite-circle.png) | Step 3 of 3: invite by email or phone, member list with Invited or Joined status, option to make someone an admin, skip for now | Invite family |
| 05 | [Log in](05-log-in.png) | Email and password, forgot password, link to create an account | Sign in |

### Main tabs

The mobile app has four bottom tabs: **Home**, **This week**, **Updates** and **Summary**.

| # | Screen | What it shows | Flow step |
| --- | --- | --- | --- |
| 06 | [Home](06-home.png) | Greeting, counts (tasks, appointments, overdue), today's items, weekly summary preview, latest update, **Quick add** | Home |
| 07 | [This week](07-this-week.png) | Items grouped by day, filter by person, unclaimed item with **Assign someone**, overdue and done states | Calendar tab / Tasks tab |
| 08 | [Updates](08-updates.png) | One shared thread of family updates, each optionally linked to a task or appointment, with @mentions | Activity feed, appointment updates |
| 09 | [Weekly summary](09-weekly-summary.png) | "What happened, what's next" generated every Sunday, with action buttons for open items and **Share with family** | — (not in the flow yet) |

### Adding things

| # | Screen | What it shows | Flow step |
| --- | --- | --- | --- |
| 10 | [Quick add](10-quick-add.png) | Bottom sheet: add a Task, an Appointment, or an Update or note | Create task or appointment |
| 11 | [New task](11-new-task.png) | Title, due date, optional time, notes, assign to someone or nobody yet | Create task, assign |
| 12 | [New appointment](12-new-appointment.png) | Title, date, start time, location with map preview, who is taking Dad, notes for the family | Create appointment, assign |
| 13 | [New update](13-new-update.png) | Free text or voice note, @mentions, link to an item, shows who gets notified | Add appointment update |

### Owning and finishing items

| # | Screen | What it shows | Flow step |
| --- | --- | --- | --- |
| 14 | [Assign to](14-assign-to.png) | Bottom sheet: pick a member (with their load this week) or leave it unclaimed | Assign to someone? |
| 15 | [Task detail](15-task-detail.png) | Owner, due date, added by, notes, linked updates, **Mark done** and **Reassign** | Task / appointment detail |
| 16 | [Overdue task](16-task-overdue.png) | Overdue banner, who was notified, hand it to someone else or ask the whole circle, mark done or change the due date | Detail (Overdue), reassign |
| 17 | [Notifications](17-notifications.png) | In-app list: overdue, assigned to you, new update, summary ready, item still unclaimed | Notifications |

### Larger screens

| # | Screen | What it shows | Flow step |
| --- | --- | --- | --- |
| 18 | [This week · desktop](18-desktop-this-week.png) | Wide layout: top tabs, sidebar with circle members and their load, the week in the middle, summary and latest updates on the right | Calendar tab |

## Where the wireframes differ from the docs

The wireframes, the [PRD](../PRD.md) and the [user flow](../user-flow.md) don't agree yet on the points below. Decide which one is right before building the affected screens, then update the other.

- **Name of the group.** The wireframes say **Core Circle**. The PRD, ADR and user flow say **Care Circle**.
- **Sign-in.** Screens 02 and 05 use email and password. The PRD and [ADR-004](../ADR.md) say passwordless only (Google and email one-time code).
- **Tabs.** The wireframes have Home / This week / Updates / Summary. The user flow has Home / Calendar / Tasks / Care Circle. The wireframes have no screen yet for members, calendar connection, notification preferences or account settings.
- **Features not in the PRD.** The weekly summary (09), voice notes (13) and @mentions (08, 13).
- **Features in the PRD with no screen yet.** Accepting or declining an assignment, coverage requests, calendar connection and availability, recurring items, sharing to a messaging app, and joining from an invite link.
- **Wording.** Screen 17 says "Build-a-thon MVP". Kindred is a prototype, so that text should change in the next export.
