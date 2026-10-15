# Synthetic results: summary

> **Synthetic data.** 30 survey and 6 interview responses from AI personas. Not real participants. See [README](README.md). Read the counts as "what our persona mix produced", not as evidence about the market. Use them to compare against the real results.

## Survey (n = 30 synthetic)

| Question | Result |
|---|---|
| Q1 Who they care for | Parent 21 · In-law 4 · Other relative 3 · Other 2 |
| Q2 Status | Full-time 15 · Part-time 4 · Business owner 3 · Retired 5 · Other 3 |
| Q4 People sharing care | Just me 3 · 2 people 10 · 3–4 people 14 · 5+ 3 |
| Q5 Who coordinates | Me 15 · Shared evenly 6 · Someone else 9 |
| Q6 How they coordinate (multi) | Calls 22 · Group chat 20 · Notes 11 · Shared calendar 9 · Other 2 |
| Q7 In the last 3 months (multi) | Missed appointment 12 · Task done twice 12 · Disagreement over who does what 11 · Missed medication 7 · None 11 |
| Q8 Stress of those events (1–5) | 1: 5 · 2: 7 · 3: 6 · 4: 7 · 5: 5 |
| Q9 How often they argue | Weekly or more 6 · Every two weeks to monthly 7 · Less often 6 · Rarely or never 11 |
| Q10 How they keep information aligned | Group chat 17 · Phone call 8 · Shared online note 2 · Other 3 |
| Q11 How hard alignment is (1–5) | 1: 6 · 2: 7 · 3: 5 · 4: 7 · 5: 5 |
| Q12 Alignment issues (multi) | Health condition 17 · Appointments 17 · Medication 15 · Other 1 · None 6 |
| Q13 Price | $1–10 17 · $10–20 8 · $20–30 5 · $30+ 0 |

**Patterns worth checking in the real data**

- **The coordinators feel the pain.** 12 of the 15 "Me" coordinators had at least one incident in the last 3 months. Coordinators are also the only group picking $20–30: their answers were 6 at $10–20, 5 at $20–30 and 4 at $1–10. Of the 15 who don't coordinate, 13 picked $1–10.
- **Group chat users find alignment hardest.** 10 of the 12 who rated alignment 4 or 5 keep everyone aligned through a group chat. The group chat average is 3.6 out of 5.
- **$1–10 often means "no".** 10 of the 17 who picked $1–10 said in their note that they wouldn't really pay. The forced-choice price question hides this. In the real survey, consider adding "I wouldn't pay" as an option.
- Every respondent with no incidents chose $1–10.

## Interviews (n = 6 synthetic)

| Persona | Main person | Slip-up story | Price |
|---|---|---|---|
| I1 Priya, coordinator, Parkinson's | Herself | A brother took Mom to neurology; the dose timing changed and nobody passed it on (9 days) | $10–20, only if her brothers use it |
| I2 Marcus, helper, dementia | His sister | Forgot a hearing appointment buried in his texts | $1–10 split with his sister, or nothing for himself |
| I3 Linh, coordinator, stroke | Her mom (hands-on) | Blood-thinner change lost across English and Vietnamese and logged wrong in Notion (10 days) | $1–10; $10–20 if translation and the med list are accurate |
| I4 Denise, past coordinator, cancer | Herself | Steroid dose cut, but her brother never saw the binder (2 days) | $1–10 herself; $10–15 split five ways |
| I5 Raj, helper, heart failure | His wife | Diuretic change written on the fridge, but the pill organizer had already been filled (2 days) | Free, then maybe $1–10 |
| I6 Hannah, helper, frailty | Her mom | New dose collected while the old bottle was still in use; Nana took both (4–5 days) | About $5, more if split three ways |

### Themes

1. **What breaks is the information handoff after an appointment, not the scheduling.** In 5 of 6 interviews, a medication change was lost when someone other than the coordinator went to the appointment. Linh, Raj and Hannah each said scheduling and cover mostly work: "Please don't build me another calendar" (I3).
2. **"If I got hit by a bus…"** Everything lives in one person's head, a binder or a fridge sheet (I1, I2, I4, I5). Priya: "I'm the single point of failure." Raj: "Right now that's the fridge, which only helps people standing in my kitchen."
3. **Getting the family to adopt it is the real cost.** Coordinators expect the others won't install another app (I1, I2, I5, I6). Marcus: "If it texts me, sure. If I have to log in, I won't." Some want updates to arrive by text message, with no login.
4. **AI summaries are trusted only with the source shown.** When asked about price, four of six worried that a summary would get a dose or a doctor's note wrong (I1, I3, I4, I6). Marcus (I2) doesn't want "a robot telling me about my dad". They want to see the source note or transcript, and have someone confirm a med change before it counts.
5. **The fixes they already use are low-tech.** A short structured form ("Did meds change: yes or no", I1), a photo of the after-visit printout (I5), the coordinator joining by speakerphone (I3, I4), and a rule that med changes go in the group chat the same day (I1, I5).
6. **Privacy and dignity.** The people being cared for don't want everything shared (I1, I4, I5, I6), so coordinators filter what each person is told.
7. **Bad news goes by phone.** Denise wants an app to say "Denise will call you tonight", not to put "cancer has spread" on a sibling's phone at work.
8. **Price:** mostly $1–10. $10–20 depends on the whole family using it, and on splitting the cost between siblings. Four of six asked for a free family trial first.

## The plan's assumptions

| Assumption | What the synthetic answers suggest |
|---|---|
| Most users have trouble coordinating with siblings | **Partly.** 19 of 30 had an incident in the last 3 months, but our persona mix set this. In interviews, the trouble is passing on information, more than scheduling or splitting tasks. |
| There has to be a key coordinator | **Supported.** Only 6 of 30 share evenly, and all 6 interviews name one main person. |
| Kindred suits busy working professionals | **Mixed.** The pain follows the coordinator role, whatever their job. Retired and on-leave coordinators (I4, S16, S30) report some of the highest pain. |

## Using this next to the real results

- **Distrust any match that's too neat.** Five of six synthetic interviews tell almost the same medication-handoff story. That may be the model repeating itself rather than a real pattern. Count it only if real interviewees bring it up without prompting.
- **Disagreements are the most useful part.** If real users say scheduling *is* their main pain, or happily pay more, the real answers win.
- **Questions to add to real interviews:** Who would need to install it for it to work? Would you trust an AI summary of a doctor's visit, and what would make you trust it? Would you pay for it alone, or split the cost?
