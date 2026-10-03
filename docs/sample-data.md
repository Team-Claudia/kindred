# Sample circle

This is the care circle that everyone who taps **Try the demo** joins (plan §8.5). It's written here so the team can review it (task T1) before task 4.2 puts it live. Comment on the PR with any changes: names, titles, notes, times or which states things are in.

Everyone and everything here is made up. The family's accounts can't be signed in to; they exist only so items have owners and authors.

All times are relative to the moment the circle is built (nightly, and whenever someone resets it), in Vancouver time, so the circle always looks current. "Today" means the day it was built.

## The family

The circle is **Mom's Care Circle**. Mom is **Margaret**, and the app calls her "Mom". The circle is on Vancouver time.

| Person | Role in Kindred | Joined | Mom is their… |
| --- | --- | --- | --- |
| **Maya Hart** | Admin (she started the circle) | 14 days ago | Parent |
| **Daniel Hart** | Member | 14 days ago | Parent |
| **Priya Hart** | Member | 13 days ago | Parent |

Visitors who tap Try the demo join as members alongside them.

## What's in it

16 items: 6 that nobody has taken yet, so visitors have plenty to claim, and at least one in every state. One is overdue.

| State | How many |
| --- | --- |
| Needs someone | 6 |
| Awaiting acceptance | 1 |
| Assigned | 3 (one overdue) |
| Needs coverage | 1 |
| Completed | 4 |
| Cancelled | 1 |

### The cardiology visit

**1. Cardiology — Dr. Patel** (appointment)
- **When:** 2 days ago, 10:30 to 11:30, at Harbourview Heart Clinic, 3rd floor.
- **State:** Completed by Daniel.
- **Who:** Maya added it 9 days ago and asked Daniel. He accepted the next morning, took Mom, and marked it done at noon.
- **Notes:** "Bring the list of current medications and the blood pressure log."
- **Update from Daniel**, linked to it, just after: "Dr. Patel says Mom's heart rhythm is stable. She's changing the dose of one prescription, so I've added a task to pick it up by Friday. Next check-up in three months."

**2. Pick up prescription by Friday** (task, follow-up to the cardiology visit)
- **When:** due the coming Friday at 5 pm (always 1 to 7 days away).
- **State:** Awaiting acceptance: Daniel asked Maya, and she hasn't answered yet.
- **Who:** Daniel added it 2 days ago, right after his update.
- **Notes:** at Cedar Street Pharmacy. "Dr. Patel changed the dose. The new prescription was sent over this morning."

### Drive Mom to physio (weekly)

Repeating items come later, so each week is its own item. Maya added the next four 13 days ago, all Westside Physiotherapy, 2 pm to 3 pm.

**3. Drive Mom to physio, last week** (6 days ago)
- **State:** Completed by Daniel, who took it the day Maya added it.
- **Update from Daniel**, linked to it: "Physio went well. Mom walked the whole hallway with just the cane, and the physio gave her two new exercises to do at home."

**4. Drive Mom to physio, tomorrow**
- **State:** Assigned to Daniel.
- **History:** Maya took it, then yesterday asked the family to cover it. Daniel tapped **I can do it**. This is **Maya's one coverage request this month**, so when she asks again she sees **"1 of 2 remaining"**. (If the circle is built on the 1st of a month, the request is dated midnight that day, so it still counts for this month.)

**5. Drive Mom to physio, next week** (in 8 days)
- **State:** Assigned to Maya. She took it when she added it. This is the appointment Maya owns for the coverage flow (plan §3).

**6. Drive Mom to physio, in two weeks** (in 15 days)
- **State:** Needs someone.

### Evening medication check (daily)

Again one item per day. Priya added five days' worth 3 days ago, each due at 7 pm. Notes on each: "Pill organizer is on the kitchen counter. Check the evening slot is empty."

**7. 2 days ago:** Completed by Priya at 7:15 pm.
**8. Yesterday:** Assigned to Priya, but never marked done, so it shows as **Overdue**.
**9. Today:** Needs someone. (After 7 pm it also shows as Overdue.)
**10. Tomorrow:** Needs someone.
**11. In 2 days:** Needs someone.

### Everything else

**12. Hearing aid fitting** (appointment)
- **When:** in 4 days, 11:00 to 11:45, at Lakeside Hearing Centre.
- **State:** Needs coverage. Priya added it for herself a week ago, then asked for coverage a few hours ago because of a work trip. Visitors can tap **I can do it**.
- **Notes:** "Bring her old hearing aids so they can compare."

**13. Eye exam** (appointment)
- **When:** was in 3 days, 3 pm, at Main Street Optometry.
- **State:** Cancelled. Maya added it 10 days ago and cancelled it 3 days ago when the clinic moved it to next month. Nobody had taken it.

**14. Fix the loose grab bar in the bathroom** (task)
- **When:** due in 5 days at noon.
- **State:** Needs someone. Daniel added it 4 days ago.
- **Notes:** "Screws are in the drawer under the sink. Needs a Phillips screwdriver."

**15. Call about home-care hours** (task)
- **When:** due in 3 days at noon.
- **State:** Needs someone. Maya added it last night.
- **Notes:** "Ask whether the morning visits can move to 9 am."

**16. Grocery run for Mom** (task)
- **When:** 12 days ago at noon.
- **State:** Completed by Daniel. Priya added it 13 days ago; Daniel took it an hour later and did it.

## Updates

Newest first:

1. **Daniel, 2 days ago**, on *Cardiology — Dr. Patel*: "Dr. Patel says Mom's heart rhythm is stable. She's changing the dose of one prescription, so I've added a task to pick it up by Friday. Next check-up in three months."
2. **Priya, 3 days ago**, not linked to an item: "Spent the afternoon with Mom. We did the crossword and she asked about everyone. She seems brighter this week."
3. **Daniel, 6 days ago**, on *Drive Mom to physio*: "Physio went well. Mom walked the whole hallway with just the cane, and the physio gave her two new exercises to do at home."

## For the build

- `build_sample_circle()` (migration `20261004007000_sample_circle.sql`) builds all of the above. Running it again deletes the sample circle and builds it fresh. Visitors who'd joined stay members, but anything they added or changed is undone.
- The fixed IDs are in plan §8.5. Changes to this page should be made to the function in the same PR (in a new migration once this one is merged).
- When Try the demo adds a visitor (task 4.2), it also gives them a few items of their own to accept. Those aren't listed here.
