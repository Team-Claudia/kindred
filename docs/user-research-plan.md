# Kindred — User Research Plan

Draft 2. Research runs October 5–14, 2026.

## Objectives

| # | Objective | Answered by |
|---|---|---|
| 1 | **Validate the problem:** people struggle with caregiving specifically in task coordination and keeping information aligned | Survey, interviews |
| 2 | **Gauge interest:** would caregivers pay for this? | Survey, interviews, usability test |
| 3 | **Test usability:** can people complete the core tasks without help and tell who owns each task? | Usability test |

## Assumptions

- Most of our users have trouble coordinating with siblings: poor time management, scheduling conflicts, different levels of coordination skill.
- There has to be a key coordinator in the family when it comes to caregiving.
- Kindred suits busy professionals who are working and also caring for family.

## Overview

| Method | Objectives | Who | Size |
|---|---|---|---|
| Survey | 1, 2 | Adults helping care for a family member | 30+ responses |
| Interviews | 1, 2 | People caring (now or before) for a family member, with 1+ siblings | Up to 4 |
| Usability test | 2, 3 | Invited testers who help, or could help, a parent | 5 |

## 1. Survey

**Format:** Google Form, under 5 minutes, multiple choice only.
**Recruiting:** the productBC buildathon group, and our family and friends.

| # | Question | Purpose | Options |
|---|---|---|---|
| 1 | Who do you help care for? | Context | Parent / in-law / other relative / other |
| 2 | What best describes your current status? | Context | Employed full-time / employed part-time / business owner / retired / other |
| 3 | How many siblings do you have in your immediate family? | Context; identify core users | Just me / 2 / 3–4 / 5+ |
| 4 | How many people share their care, including you? | Context; identify core users | Just me / 2 / 3–4 / 5+ |
| 5 | Who does most of the organizing and coordinating? | Context; identify core users | Me / shared evenly / someone else |
| 6 | How do you coordinate care today? (pick all) | Context | Group chat / calls / shared calendar / notes / other |
| 7 | In the last 3 months, have any of these happened to you? (pick all) | Validate the problem: do target users have coordination issues? | Missed appointment / missed medication / task done twice / disagreement over who does what / none |
| 8 | On a scale of 1–5, how stressful is it when events like those in question 7 happen? | Validate the problem: how painful coordination issues are | 1 (not at all) – 5 (very) |
| 9 | How often does your family argue over caregiving responsibilities? | Validate the problem: how often coordination issues happen | Every day / weekly / every two weeks / monthly / every two months / every six months / yearly / rarely or never |
| 10 | How do you keep information aligned with the others sharing care? | Validate the problem: how target users share information | Group chat or messaging app / phone call / shared online note / other |
| 11 | On a scale of 1–5, how hard is it to keep information aligned with the others sharing care? | Validate the problem: how painful information alignment is | 1 (not at all) – 5 (very hard) |
| 12 | What are the main information alignment issues for you? | Validate the problem: pinpoint the issues | Changes in medication / changes in health condition / changes in appointments / other / none |
| 13 | Would you pay for a task-coordination app for your family with AI summaries that help you catch up on care, spot gaps and suggest what's next? How much would you pay? | Price range | $1–10/month / $10–20/month / $20–30/month / $30+/month |

## 2. Interviews

**Who:** 4 people currently or previously caring for a family member, shared with at least one sibling. Preferably someone who is working.
**Format:** 20–30 minutes, video or phone. Recruit from survey opt-ins and personal networks.
**Recruiting:** the productBC buildathon group, and our family and friends.

| # | Question |
|---|---|
| 1 | Screening: are you a caregiver, and do you share responsibilities with someone else? |
| 2 | Tell us about the person you care for. |
| 3 | What's your current status? Are you working, retired or studying? |
| 4 | How many people share this care with you? How do you split responsibility between you? (If possible, also ask about the others' employment.) |
| 5 | Is there a main caregiver, or does everyone split the tasks fairly evenly? |
| 6 | Tell me about a time something slipped through the cracks. (To avoid leading, only offer examples later if nothing comes up: missed appointments, misunderstandings, a missed change in medication or condition.) |
| 7 | How did it get resolved? What would help you avoid something like that happening again? |
| 8 | How has caregiving affected your relationship with the other caregivers? |
| 9 | How do you assign tasks to different caregivers? |
| 10 | What happens when someone can't make it to their caregiving duty? What do you do now? |
| 11 | How do you share a new update with the others in your care circle? |
| 12 | After an appointment, how does everyone find out what happened? |
| 13 | Is it easy or difficult to share a medical update in the family? Why? |
| 14 | If you could fix one thing about how your family coordinates, what would it be? |
| 15 | Imagine a magic phone app that solves all your caregiving problems. How would it help you, and why? |
| 16 | How much would you pay for an app that helps with task coordination and keeping everyone aligned, with AI summaries that keep you up to date? ($1–10 / $10–20 / $20–30 / $30+ per month) |

## 3. Usability test

**Who:** at least 4 sessions, 1-on-1 or 1-on-2, with one participant acting as the coordinator who leads the tasks.
**Format:** 15 minutes, in person or on a video call, using the Kindred demo. Encourage testers to think aloud. Afterwards, leave 5 minutes for the post-test survey, then ask follow-up questions to check their feedback.
**Recruiting:** the productBC buildathon group, and our family and friends. Team members can also be testers.

**Moderator intro:** "Let's pretend we're siblings in the same family. Person A is the main coordinator, and Person B and I are siblings helping with the care. Let's work through these scenarios."

| # | Scenario | Who | Success |
|---|---|---|---|
| 1 | Create several tasks: pick up medicines, take Mom to senior care, cook dinner for Mom, buy groceries for Mom's place, take Mom to see her grandchild | A and B | Creates them and assigns each to one of the siblings |
| 2 | Create a task to take Mom to a doctor's appointment | A (coordinator) | Creates it and assigns it to a sibling (the tester) |
| 3 | Accept or claim a task | B (the tester sibling) | Taps Accept |
| 4 | Ask for cover | A and B | Requests cover and shares it to the chat |
| 5 | Check your calendar, mark your task as done, and add an update | A and B | Marks it done and adds an update |
| 6 | Add an update about Mom's condition | A and B | Posts it |

### Post-test survey

To find where to improve next.

- How can we address you? (The moderator notes age and demographic.)
- In your own words, what is Kindred for?
- What was your first impression of the app?
- On a scale of 1–5, how easy was adding tasks and assigning them to people? (5 = very easy, 1 = difficult)
  - If you could change one thing about this, what would it be?
- On a scale of 1–5, how easy was asking for cover?
  - If you could change one thing about this, what would it be?
- On a scale of 1–5, how easy were the calendar features?
  - If you could change one thing about this, what would it be?

## Findings
