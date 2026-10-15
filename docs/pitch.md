# Kindred — Demo Day Pitch

Draft 1, October 2026. The judged 7-minute live pitch on 17 October (see [demo-day.md](demo-day.md) and [judging-criteria.md](judging-criteria.md)). Built from the [GTM plan](gtm-plan.md), the [competitor analysis](competitor-analysis.md) and the [user research plan](user-research-plan.md).

Our own survey didn't reach enough people, so the validation beat uses published research (Caregiver Action Network's [Caregiver Tech Insights Survey 2026](research/secondary/caregiver-tech-insights-2026.md), 272 US caregivers). The [synthetic AI-persona pilot](research/synthetic/summary.md) stays off the slides; mention it only if asked, and say it's AI-generated. `[Brackets]` still wait on usability tests. Never put a figure or quote in the pitch that we didn't collect or can't cite, and never present synthetic answers as real people.

## One-liner

> Kindred gives siblings caring for a parent one shared plan where every task has a named owner who claimed it, so appointments stop slipping and one sibling stops carrying it all.

Opener for the stage: *"Who's taking Dad on Thursday? Now everyone knows."*

## Short version

> When Mom needs care, one sibling ends up as the coordinator, and everyone else "helps" through a group chat. Tasks get buried, appointments get missed or doubled up, and "I do everything" turns into resentment. A 2026 survey of 272 US family caregivers found that 37% spend 11 or more hours a week just coordinating care. The root cause isn't that families don't care. A thumbs-up in a chat isn't a commitment: nobody can see who actually owns a task. Kindred turns care into tasks that people claim. You see who said yes, ask for cover in one tap when plans change, share it straight back to the family chat, and get reminders before anything slips. Helpers join free and only need to tap Accept. In usability testing, [X of 5] testers claimed a task and asked for cover without help.

## The 7-minute pitch

Each beat is mapped to a judging criterion, with a suggested time and speaker so that everyone presents. About 6:55 in total; the demo absorbs any overrun, and the competition beat is the first to cut.

| Beat | Speaker | Time | Criterion |
|---|---|---|---|
| Problem | 1 | 0:45 | Problem & Validation |
| Validation | 1 | 0:45 | Problem & Validation |
| Insight and design | 2 | 0:45 | Solution & Design |
| Live demo | 2 and 3 | 2:30 | Execution & Prototype |
| Business model and GTM | 4 | 1:00 | Viability & GTM |
| Competition | 4 | 0:20 | Viability & GTM |
| Ask and close | Everyone | 0:30 | Communication & Product Thinking |

### Problem (0:45)

- One sibling becomes the coordinator. Everyone else helps through a group chat.
- Tasks get buried, appointments get missed or doubled up, and nobody knows who said yes.
- The real cost is burnout and resentment between siblings, not just logistics.
- About 6.7 million Canadians give unpaid care to adults (Statistics Canada, 2022).

### Validation (0:45)

- **Published research:** a 2026 survey of 272 US family caregivers (Caregiver Action Network) found 37% spend 11+ hours a week just coordinating care, nearly 1 in 3 say care feels fragmented, and 26% say coordinating appointments, medications and family communication is where technology could help most.
- 90% already use at least one digital tool for caregiving, so families will use an app if it's easy.
- What caregivers in that survey need, and what we built in response:

| Caregivers said (2026 US survey) | We built |
|---|---|
| Appointments and medications take the most time | Reminders before every appointment and due task |
| There's little or no backup when they can't make it | Ask for cover in one tap, shared to the family chat |
| Information is scattered across too many systems | A weekly summary of who did what |

- If asked what we did ourselves: our synthetic pilot (AI personas answering our questions, not real people) pointed the same way. Say clearly that it's AI-generated.

- Quote, from a real caregiver in the CAN survey: *"The most stressful part of caregiving is trying to coordinate everything at once, appointments, medications, and daily care, while still managing my own responsibilities."*

### Insight and design (0:45)

- Insight: a group chat records what was *said*. Kindred records who *claimed* each task.
- Design choices, each with a reason:
  - **Claim, don't assign.** Ownership is visible and agreed to.
  - **Helpers just tap Accept**, because "my brother won't use another app." 23% of caregivers would rather use text or email than download an app (CAN 2026).
  - **Work with WhatsApp and Google Calendar, not against them.** Families already live there.
  - **Not clinical**, so no medical advice.
- Show wireframes next to the finished screens to show the design iterations.

### Live demo (2:30)

- The core loop on two phones: create a recurring task → a sibling claims it → the owner asks for cover → share the request to the family chat → someone else takes it → mark it done with an update.
- 10-second close: the weekly summary ("what happened / what's next") and the Free/Busy calendar check.
- On screen: a QR code and "Try the demo", so judges can join a sample Care Circle on their own phones with no account.

### Business model and GTM (1:00)

- **Pricing:** the coordinator pays per circle, and helpers are always free. Founding families pay $5/month, locked in, with a 30-day money-back guarantee. After that: $7/month or $70/year. In the CAN survey, 28% would pay $11–25/month for a tool that reduces stress, so we start below that. If asked: only 12% would pay out of pocket and 32% expect tools to be free, which is why helpers are free and founding families get a money-back guarantee.
- **Market (Canada, by circle):** about 420K circles of working adults sharing a parent's care, about $35M a year. 3-year target: about 8,400 circles (2% of that), about $700K ARR. Assumes 3 caregivers per circle, 60% of working caregivers sharing care with family, and $84 per circle per year.
- **First users:** founder-led in Canadian caregiver communities (Facebook groups, r/AgingParents, r/caregivers), where coordinators ask for help in a crisis. Lead with a free "who does what" care roster template, and set up the first 20 circles by hand. A trusted organization's recommendation is the #1 reason caregivers adopt a tool (131 of 272, CAN 2026), which is why we ask for introductions to elder-care organizations.
- **Two-week test, $0:** continue if 5+ circles have 3+ members each and 2+ families pay; change course if fewer than 3 of 30 conversations lead to a trial.

### Competition (0:20)

- Group chats and calendars show *when* something happens, not *who agreed*.
- Care apps such as CircleCare, Lotsa Helping Hands and CaringBridge expect families to leave their chat.
- Kindred works alongside the chat and adds a weekly summary that none of them offer.

### Ask and close (0:30)

- Next: 10–20 founding families from November to January, measured by one number: weekly circles where helpers, not just the coordinator, complete tasks.
- Ask the room: introductions to caregiver groups and elder-care organizations, such as Family Caregivers of BC or Alzheimer Society chapters.
- Closing line: *"Stop being the only one who remembers."*

## Before Demo Day

- Fill the usability `[brackets]` once tests run. Problem & Validation is 20% of the score: always say the figures come from a published US survey, not our own research.
- Show the weekly summary in the demo, not just on a slide: it's our clearest point of difference.
- Don't claim contribution tracking over time: the weekly summary names who did what each week, but nothing tallies it over time. Be ready if a judge asks about CircleCare.
- Add the demo URL and QR code to the slides.
- Prepare for judges' questions with [judge-qa.md](pitch/judge-qa.md). The deck's appendix (slides 13–21) has a backup slide for each theme.
