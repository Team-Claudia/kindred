# Kindred — Design System

**Option B: Garden** (green theme). Soft, rounded and nurturing.

A calm green palette with generous rounding and a rounded typeface. It feels like a home, not software. Marigold stands in for apricot as the attention colour.

- **Personality:** nurturing, calm, human.
- **Feels like:** a handwritten note left on the kitchen table.
- **Trade-off:** green can read as wellness or health. Keep imagery domestic, never clinical.

**Status in the app:** applied (task 4.4). The colours, font and radii live in `web/src/styles/tokens.css` (implementation plan §4.6). The app adds a few colours the design doesn't name: a text-safe muted grey (`#4D5C55`), an input outline that meets 3:1 (`#7B8E85`), a pale marigold tint for overdue cards (`#FDF3E2`), and a background and text pair for each assignment state. The design has no dark mode.

## Colour

| Role | Hex | Contrast | Use |
|---|---|---|---|
| Primary | `#2F6B57` | 6.2:1 on white | Main actions, navigation, selected |
| Secondary | `#8CC3AC` | 7.2:1 with text | Supportive UI, progress, tags |
| Surface | `#E7F2EC` | 12.5:1 with text | Grouped content, chips |
| Accent (marigold) | `#E9A23B` | 6.6:1 with text | Attention and overdue only |
| Background | `#FBF8F1` | 13.5:1 with text | Main canvas |
| Text | `#1F2D27` | 14.4:1 on white | Headings, primary content |

## Typography

Typeface: **Nunito**.

| Style | Size / line height (px) | Example |
|---|---|---|
| H1 | 34 / 40 | Who is doing what |
| H2 | 24 / 30 | This week for Dad |
| H3 | 18 / 24 | Call the pharmacy |
| Body | 16 / 24 | Everything your family is coordinating. |
| Small | 14 / 20 | Due Friday 5:00 pm · Maya |
| Caption | 12 / 16 | Assigned to |

## Components

**Radius:** buttons 14px · inputs 14px · cards 22px · chips 16px. All touch targets are at least 44 × 44px. Sentence case throughout.

- **Buttons:** filled primary ("Add to this week"), outlined ("Reassign"), text link ("Skip for now"), disabled surface ("Unavailable"), and small filled and outlined pairs ("Assign someone", "Take it").
- **Inputs:** rounded text fields ("Share an update with the circle…"), with the focused field outlined in primary; separate date and time fields; checkboxes for Open and Done.
- **Chips and status:** kind chips (Task, Appointment) on surface; Overdue in accent; Done muted; person filters (Everyone, Maya, Jonah), with the selected one filled primary.
- **Avatars:** round, with an initial. Filled primary for you, surface for others, dashed outline with "?" for nobody.
- **Task card:** checkbox, title, "Due 5:00 pm · Maya" and the owner's avatar.
- **Overdue card, the same everywhere:** accent border, tinted background and an Overdue chip.
- **Unclaimed card:** dashed "?" avatar, "Nobody has claimed this", primary-outlined card and an "Assign someone" button.

## In use

Shown on the This week view and the weekly summary, built from the approved [wireframes](wireframes/README.md) (12 and 14).

1. **Ownership at a glance.** Avatar plus first name on every item. Round avatars, filled primary for you.
2. **Overdue is always accent.** `#E9A23B` border and tinted card in This week, notifications and the assignee's own view.
3. **Unclaimed is a clear invitation.** Dashed avatar and a primary button make the next action obvious.
4. **Calm AI summary.** Plain bullets grouped into what happened and what's next, with action buttons inline.
5. **Non-clinical by design.** A reassurance line sits on screens that touch health-adjacent content, e.g. "Kindred summarises what the family logged. It never interprets health information or gives medical advice."
