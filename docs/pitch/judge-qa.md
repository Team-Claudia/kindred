# Kindred — Judge Q&A prep

Likely questions after the Demo Day pitch, with drafted answers. Questions are grouped by the lens a judge is likely to bring (see [the judges](https://productbc.ca/build-a-thon/#judges)). The matching backup slides are in the deck's appendix, slides 13–21.

## How to answer

- **Answer first, in about 20 seconds.** Then give one piece of evidence, then offer the appendix slide if it helps ("there's a backup slide on this").
- **Who takes what.** Speaker 1 takes research and the problem, Speaker 2 design and UX, Speakers 2 and 3 the product and technology, and Speaker 4 business, pricing and GTM. Anyone can say "Good question; [name] owns that."
- **Three rules:**
  1. Research figures come from a **published US survey**: say "a US survey found", never "we found".
  2. **Don't claim AI that isn't built.** Today's weekly summary is made from templates, with no AI.
  3. **The synthetic pilot is AI-generated**, so never describe it as caregivers we spoke to.
- **It's fine to say "we don't know yet"**, followed by how we'd find out. That's product thinking, which is 20% of the score.
- `[TEAM]` marks answers only the team can give. Fill them in before Saturday.

## The six toughest questions

1. **"Who did you actually talk to?"** → [Q1](#research-and-validation)
2. **"Why would anyone pay when WhatsApp is free?"** → [Q7](#business-pricing-and-market)
3. **"What stops CircleCare or WhatsApp from copying this?"** → [Q10](#business-pricing-and-market)
4. **"Will siblings really install another app?"** → [Q17](#product-ux-and-adoption)
5. **"Where's the AI?"** → [Q25](#technology-data-and-ai)
6. **"Is it safe to put my mom's care information in here?"** → [Q24](#technology-data-and-ai)

---

## Research and validation

*Lens: design, discovery and user validation.*

**Q1. Who did you talk to, and what did you learn?**
Our own survey didn't reach enough people in the time we had, so we're upfront about that. `[TEAM: if the Round 1 and 2 discovery interviews were with real people, lead with them: how many, who, and what they said. The original slide 4 findings — no calendar reminder led to a missed appointment; last-minute swaps had nowhere to go; one sibling carries more — came from those rounds.]` To check that the problem is bigger than our own circles, we used a 2026 survey of 272 US family caregivers. It found that 37% spend 11+ hours a week just coordinating care, and nearly 1 in 3 say care feels fragmented.
*Evidence:* [secondary research](../research/secondary/caregiver-tech-insights-2026.md). *Slide:* A1.

**Q2. That survey is American and not about siblings. Does it really apply?**
It confirms the coordination burden, not our sibling angle, and we say so. For Canada we use Statistics Canada: about 6.7 million Canadians give unpaid care to adults. The sibling question is exactly what our founding-family pilot tests first.
*Slide:* A1.

**Q3. What's your riskiest assumption, and how will you test it?**
That helpers, not just the coordinator, will actually claim tasks. If only the coordinator uses Kindred, it's a to-do list. That's why our one number is weekly circles where helpers complete tasks, and our two-week test needs 5+ circles with 3+ members each.
*Evidence:* [GTM plan §8.4 and §10](../gtm-plan.md). *Slide:* A8.

**Q4. What did you learn that changed the product?**
Three things. Missed appointments came down to no reminder, so we added reminders before every appointment and task. Last-minute swaps had nowhere to go, so we added one-tap "ask for cover", shared to the family chat. And because one sibling carries more, the weekly summary shows who did what. `[TEAM: confirm these came from the Round 1 and 2 interviews.]`
*Evidence:* [competitor analysis §3](../competitor-analysis.md).

**Q5. Did you run usability tests?**
`[TEAM: if any ran before Saturday, give the result: "X of Y testers claimed a task and asked for cover without help." If none ran, say so and point to the judges trying the demo on their own phones right now.]`

**Q6. You mentioned AI personas. What was that?** *(Only if it comes up.)*
Before talking to people, we ran our survey and interview questions through AI personas to find leading or confusing questions. It's AI-generated, so we don't count it as evidence. It pointed the same way as the published survey, but its pricing answers were too optimistic.
*Evidence:* [synthetic pilot](../research/synthetic/README.md).

## Business, pricing and market

*Lenses: investor, IP and pitching; product strategy.*

**Q7. Why would a family pay when WhatsApp is free?**
They keep WhatsApp. What they pay for is knowing who said yes, so the coordinator stops chasing people. Only the coordinator pays, $5 a month for founding families, and everyone they invite is free. In the US survey, 28% would pay $11–25 a month for a tool that reduces their stress, so we're below that.
*Slide:* A2.

**Q8. Most caregivers won't pay. Only 12% would pay out of pocket.**
That's the biggest risk, and we priced for it: a low founding price, a 30-day money-back guarantee, and helpers always free. We charge from day one so we learn quickly whether families value it. Later we'd look at employer caregiver benefits and partner-funded access.
*Slide:* A2.

**Q9. How big is this?**
In Canada, about 420,000 families of working adults share a parent's care, which is about $35M a year at $84 per family. Our three-year target is 2% of that, about 8,400 families or $700K a year. We count families, not people, because one coordinator pays for a circle of about three.
*Evidence:* [GTM plan §4](../gtm-plan.md); Statistics Canada 2022; CCCE *Caring in Canada* 2026. *Slide:* A3.

**Q10. What stops CircleCare, CaringBridge or WhatsApp from copying this?**
Honestly, there's no patent moat in a task app. Our edge is focus. Other care apps ask families to move into a new app; we work alongside the chat they already use, with tasks that someone claims and cover in one tap. On top of that comes distribution through trusted organizations, which is how caregivers choose tools. WhatsApp is built for chat, not task ownership, so it's unlikely to build care workflows.
*Evidence:* [competitor analysis](../competitor-analysis.md). *Slide:* A4.

**Q11. CircleCare has a free tier. Why don't you?**
We charge from day one on purpose: the fastest way to learn whether families value Kindred is to ask them to pay a little. The founding price is $5 a month with a 30-day money-back guarantee, and helpers are always free, so the cost of trying is low. If paying blocks trials, a free first circle is an easy change to test.
*Slide:* A2, A4.

**Q12. How will you get your first 100 families?**
Founder-led, in the Canadian caregiver communities where coordinators ask for help at a crisis point: Facebook groups and r/AgingParents. We lead with a free "who does what" roster template and set up the first 20 circles by hand. Each family brings 3–5 relatives. In parallel we'd approach elder-care organizations, because a trusted organization's recommendation is the #1 reason caregivers adopt a tool (131 of 272 in the US survey).
*Slide:* A8.

**Q13. What would make you stop or change course?**
Our two-week test sets the bar in advance. If fewer than 3 in 30 conversations lead to a trial, we change course. If 5+ circles have 3+ members each and 2+ families pay, we keep going.

**Q14. Is there any IP or legal risk? Liability if a task is missed?**
Kindred coordinates tasks; it never gives medical advice, and our terms say so. Care information stays in Canada, and we'd do a PIPEDA review before taking real families. On IP: we're building on open tools, and the brand is the main asset. `[TEAM: whether "Kindred" has been checked for trademark conflicts.]`

**Q15. Are you going to keep building this after the buildathon?** `[TEAM]`

## Product, UX and adoption

*Lenses: product-market fit and UX; design.*

**Q16. Who exactly is the customer?**
The coordinator: a working adult, often the sibling who lives closest, sharing a parent's care with one or more siblings. They feel the pain, so they pay. Everyone else is a helper, and we design so helpers barely need the app.

**Q17. Will siblings really install another app?**
They don't have to set much up. A request is shared into the family chat, they tap the link and tap Accept. Helpers join free. In the US survey, 23% would rather use text or email than download an app, which is why we work through the chat.
*Slide:* A5.

**Q18. What's the "aha" moment?**
The first time a sibling taps Accept and the coordinator's phone shows a name instead of a question mark. That's the moment the coordinator stops chasing.

**Q19. Why a web app (PWA) and not a native app?**
Speed and cost. The whole team could build in one web codebase, there was no app-store review, and judges can try it from a link. It installs to the Home Screen and gets push notifications. A native version later can reuse the same code.
*Evidence:* [ADR-002](../ADR.md).

**Q20. How does it work for less tech-comfortable relatives?**
One tap, yes or no, with plain language and large tap targets. Status is always shown as text as well as colour, and we're targeting WCAG 2.2 AA.
*Evidence:* PRD accessibility requirements.

**Q21. Why only two cover requests a month?**
Cover is for real changes of plan, not a way to hand everything back. A claim should mean something. Two is a prototype assumption we'll test; later the circle could set its own limit.
*Evidence:* PRD BR-01.

**Q22. What did you deliberately not build?**
Medical features (we're never clinical), in-app chat (families keep theirs), contribution tracking over time, and AI-written summaries. We focused on one loop: claim → ask for cover → someone else takes it → done.

**Q23. Could this be B2B: employers, insurers, care organizations?**
Possibly, later. Employers lose working caregivers' time, and in the US survey 64% think insurance should pay for caregiving tech. Our first job is proving families use it. A B2B2C channel through employer benefits or elder-care partners is a natural next experiment.

## Technology, data and AI

*Lens: engineering, ML and data platforms.*

**Q24. Is my mom's care information safe? Where does it live?**
In Canada: our database runs in Supabase's Canada (Central) region. Each family's data is walled off by database rules (row-level security), so you only ever see your own circle. For calendars, we only ask Google whether you're free or busy; we never see your event details. You can export or delete your account at any time.
*Evidence:* [ADR-003](../ADR.md), [architecture explained](../architecture-explained.md). *Slide:* A6.

**Q25. Where's the AI?**
Deliberately not in the prototype. The weekly summary is built from templates inside Kindred, so no care information is sent to an AI company and nothing can be misread as medical advice. In the US survey, 59% of caregivers already use AI for caregiving, so there's appetite. An opt-in AI summary is on our roadmap, with consent and with sources shown.
*Slide:* A6.

**Q26. How is it built?**
A React web app (PWA) on Vercel, with Supabase for the database, sign-in, live updates and scheduled jobs. Every state change goes through a database function, so the app can't bypass the rules. Google Calendar provides free/busy, and Web Push handles notifications.
*Slide:* A7.

**Q27. What if two siblings tap Accept at the same time?**
Only one wins. Each claim is a single database function that checks the task is still open and assigns it in one step, so the second person sees "already taken".
*Evidence:* [ADR state machine](../ADR.md). *Slide:* A7.

**Q28. How do you know it works? Testing?**
Every business rule has a database test (pgTAP), plus type checks, linting, unit tests and a build check on every change in CI.
*Slide:* A7.

**Q29. Will it scale?**
For the next stage, easily: it's standard Postgres, and a family generates very little data. The things that would need work at scale are notification delivery and calendar API limits, and both are managed services we can grow into.

**Q30. What data would you track to know it's working?**
The weekly share of circles where helpers, not just the coordinator, complete tasks. Behind that: care slots covered before they're due, tasks completed by non-coordinators, how often the coordinator has to chase people (asked at onboarding and week 4), and week-8 retention.
*Evidence:* [GTM plan §10](../gtm-plan.md). *Slide:* A8.

**Q31. iPhone push notifications are unreliable for web apps. Is that a problem?**
On iPhone, web push only works once Kindred is added to the Home Screen, so onboarding walks people through that step. Reminders and requests also show up in the in-app notification list and can be shared to the chat, so nothing depends on push alone.
