# Synthetic persona responses

> **AI-generated. Not real participants.** Every answer in this folder was written by AI agents role-playing fictional caregivers. Use it only next to the real survey and interview results, never in their counts, and label it "synthetic" wherever it appears.

## Why

The research window in the [user research plan](../../user-research-plan.md) was short. These responses give the team a quick comparison set: where the real answers agree with the synthetic ones, and, more usefully, where they don't.

## Method

- **Questions:** the survey (§1, Q1–13) and interview guide (§2, Q1–16) from the research plan, asked word for word.
- **Personas:** 6 interview and 30 survey personas, written before any answers were made ([personas.md](personas.md)). The mix was set to push back on our assumptions: about a third have little or no coordination pain, some care alone, some have no main coordinator, and several would not pay.
- **Generation:** one AI agent per interview persona, and three agents answering 10 survey personas each. Agents were told to answer as the person would, not to please the researchers. Model: Claude Opus 5.5, October 14, 2026.
- **Checks:** every survey value is one of the plan's answer options, and every interview covers all 16 questions.

## Limits

- Synthetic answers reflect what the model has read about caregivers, not anyone's lived experience. They can't reveal problems we haven't already thought of.
- The answers follow the persona mix we chose, so the counts reflect our sampling, not the market.
- The price question forces a choice, so "$1–10/month" also covers people who wouldn't pay; see the `notes` column.

## Files

| File | What |
|---|---|
| [personas.md](personas.md) | The persona roster |
| [interviews.md](interviews.md) | 6 interview transcripts |
| [survey.csv](survey.csv) | 30 survey responses, one row per persona |
| [summary.md](summary.md) | Survey counts, interview themes, and what the answers say about the plan's assumptions |

### Survey columns

| Column | Question |
|---|---|
| `q1_care_for` | Who do you help care for? |
| `q2_status` | What best describes your current status? |
| `q3_siblings` | How many siblings do you have in your immediate family? |
| `q4_people_sharing` | How many people share their care, including you? |
| `q5_coordinator` | Who does most of the organizing and coordinating? |
| `q6_how_coordinate` | How do you coordinate care today? (multi, `;`-separated) |
| `q7_last_3_months` | In the last 3 months, have any of these happened to you? (multi) |
| `q8_stress` | How stressful is it when events like those in Q7 happen? (1–5) |
| `q9_argue_frequency` | How often does your family argue over caregiving responsibilities? |
| `q10_info_alignment` | How do you keep information aligned with the others sharing care? |
| `q11_alignment_difficulty` | How hard is it to keep information aligned? (1–5) |
| `q12_alignment_issues` | What are the main information alignment issues for you? (multi) |
| `q13_price` | Would you pay for a task-coordination app with AI summaries? How much? |
| `notes` | The persona's one-line comment, usually on price |
