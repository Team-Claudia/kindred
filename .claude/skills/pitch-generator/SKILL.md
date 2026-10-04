---
name: pitch-generator
author: hytonylee
version: 0.1.0
tags: ['claude-skill', 'skillsmith', 'pitch writing', 'investor deck', 'elevator pitch']
category: productivity
description: 'Generate concise, targeted pitch drafts for products, projects, or ideas tailored to a target audience. Use when the user asks for a pitch, elevator pitch, tagline, or marketing summary'.
---

# Pitch Generator

## When to use

Use this skill when the user asks for a pitch for an idea, product, project, or concept—especially for fundraising, partnerships, or customer acquisition.

## Inputs to ask for (if missing)

- Audience: who are we pitching (investor, VC partner, customer, employer, internal leadership)?
- Audience level: generalist vs specialist (how much jargon/data is acceptable)?
- Goal: what should the audience do next (meet you, invest, pilot, buy, hire, refer)?
- Format: live pitch (more visuals/less words) vs emailed message (more words + appendices-ready detail).
- Tone: professional, friendly, bold, etc.
- **Stage**: what funding stage is the company at (pre-seed, seed, Series A, etc.)?
  - If pre-seed, also ask: Is this friends & family, angel, accelerator, or institutional pre-seed?
- Problem details (use the "1-sentence test" inputs):
  - Who is affected?
  - Root cause?
  - Impact (cost/risk/time/pain)?
- Value proposition details (use the "solution statement" inputs):
  - Who you help
  - What you do for them
  - Outcome they get
  - Alternative you displace (contrast)
- Proof / traction (use the strongest available evidence):
  - Tier 1: revenue / paying customers
  - Tier 2: signed commitments (LOIs, design partners, pilots)
  - Tier 3: usage/engagement metrics
  - Tier 4: qualitative proof (quotes, NPS, referrals)
  - Tier 5 (pre-seed only): problem validation evidence (customer discovery interviews, waitlist sign-ups, prototype demos)
- Why now (timing thesis): what has shifted that makes this the right moment?
- Market context (optional, only if the user has it):
  - TAM/SAM/SOM framing or a credible target/customer count within 3 years
- Competition / alternatives (who they compare you to, and are you additive or displacing?)
- Team (optional, only if relevant to the ask):
  - domain expertise, unfair advantage, why you/why now, execution history
- Ask or next step (especially if fundraising):
  - amount, structure, milestones, and timeline (or a concrete "next step" like "request a 30-min meeting")
- **Use of funds** (especially at pre-seed): how will the money be spent? Map to concrete milestones (e.g., "hire 2 engineers, ship MVP, run 50 customer pilots in 12 months").
- **Instrument type** (if fundraising and pre-seed/seed): SAFE, convertible note, or priced round? Include valuation cap and/or discount rate if known.

## Pre-seed stage guidance

When the user is pitching at the pre-seed stage, apply these adjustments throughout all output variants:

### What pre-seed investors are actually evaluating
At pre-seed, investors bet on founders more than products. They look for:
1. **Deep problem understanding** — evidence you've lived in the problem space, not just researched it.
2. **Founder-market fit** — unique expertise, passion, or lived experience that makes you the right person.
3. **Resilience signal** — indicators you can endure the long road ahead (prior execution, relevant grit).
4. **Clear use of funds** — a simple milestone roadmap, not a complex financial model. Show what the money buys: prototype, first hires, customer pilots, runway to seed.

### Pre-seed readiness signals to highlight
Weave the strongest applicable signals into the pitch:
- More than an idea: prototype, mockup, or MVP exists.
- Validated problem: customer discovery interviews conducted, specific pain confirmed.
- Compelling founder narrative: why you, why now, why this team.
- Clear plan for funds: concrete milestones the raise unlocks, with a timeline (typically 12-18 months of runway).

### Pitch priorities by pre-seed investor type
- **Friends & family**: emphasize personal conviction, simplicity, and what the money enables. Keep jargon minimal.
- **Angel investors / syndicates**: lead with founder credibility and problem depth. Angels value domain expertise and network effects.
- **Accelerators / incubators** (YC, Techstars, etc.): focus on team velocity, market insight, and coachability. Show you can move fast with guidance.
- **Institutional pre-seed VCs**: closest to a seed-style pitch — include market sizing, competitive landscape, and a credible path to seed.

### Pre-seed pitch anti-patterns to avoid
- Over-indexing on financial projections (a simple use-of-funds roadmap beats a 5-year DCF at this stage).
- Stacking too many SAFE/note terms without explaining dilution impact.
- Claiming traction you don't have — instead, reframe around problem validation and customer discovery.
- Pitching "the idea" without showing progress (investors want to see you've already started executing).

### Benchmark data (for calibrating asks and framing)
- Typical pre-seed raise: $250K–$1M (some smaller, some larger).
- Typical pre-seed company age: under 2 years from incorporation.
- Common instruments: SAFEs (most common) and convertible notes.
- Pre-seed goal: validate problem and solution, build initial product and team.
- Seed benchmark for context: $500K–$5M, working product with early traction, median dilution ~20%.
- Fundraising timeline: plan for several months from first conversation to close.
- Solo founders: possible but harder — 35% of startups are solo-founded, but solo founders are statistically less likely to raise VC. If solo, emphasize advisory network and planned co-founder search.

## Output format
Return 3 variants, each targeted to the audience and aligned to the workshop structure:

0. **Patterns used (when a benchmark deck is available)**
   - Briefly list 1-2 messaging patterns extracted from the local benchmark deck and how they are adapted for the user's context.
   - Keep this to 1-3 lines total.

1. **One-liner pitch**
   - Must answer the "three questions to answer cold" in plain language:
     - What do you do?
     - Who is it for?
     - Why does it matter now?
   - No jargon; quantify the benefit if possible.

2. **Short paragraph pitch**
   - Must follow the "story arc":
     - Tension (problem)
     - Insight (your unfair knowledge / root cause)
     - Resolution (your solution)
     - Proof (the strongest evidence tier you have)
   - Avoid hedging/filler; be direct and confident.
   - At pre-seed: lead with problem validation evidence and founder insight rather than revenue metrics.

3. **Slightly longer "investment-style" pitch (still concise)**
   - Mirror the "10 essential slides" at the level of messaging (not slide formatting):
     - Problem → Solution → Market → Business model → Traction (proof hierarchy) → GTM → Competition/alternatives → Team → Financials/metrics (only if the user has them) → Ask/next step
   - Include assumptions drivers if financials/market numbers are mentioned (avoid "hockey stick" without drivers).
   - At pre-seed: replace "Financials/metrics" with "Use of funds / milestone roadmap" and weight the Team and Problem sections more heavily. Include instrument type (SAFE/note) and target raise in the Ask.

## Style rules
- Clarity first: one sentence per core claim; define any necessary terms.
- Specificity wins conviction: name customers (ideally by role/segment), and quantify benefits.
- Contrast matters: explicitly name the alternative and why you're better (additive vs displacement).
- Evidence hierarchy: if you don't have Tier 1, use Tier 2/3/4/5 — don't omit proof entirely.
- Timing thesis: include "why now" as a concrete shift, not generic optimism.
- No hedging language: avoid "I think maybe," "sort of," "hopefully," "maybe we could…"
- At pre-seed: story over spreadsheet — a compelling narrative about founder-market fit and problem depth beats premature financial projections.

## Reference example (pitch deck benchmark)
- Use the well-known 2009 Airbnb fundraising deck as a quality benchmark for structure and clarity.
- First check local benchmark files in `.claude/skills/pitch-generator/benchmarks`.
- If one or more local benchmark decks exist there, use them as the primary reference instead of web sources.
- If needed, select the closest benchmark by audience/stage (for example: pre-seed investor deck vs enterprise sales deck).
- Apply what makes it effective:
  - concise problem framing
  - clear solution and differentiation
  - simple market and business model logic
  - concrete traction/validation signals
  - explicit, milestone-based ask
- When a local benchmark deck is available, extract 1-2 concrete messaging patterns from it before drafting (for example: opener style, problem framing pattern, traction phrasing, or ask structure).
- Use this as inspiration only; do not copy wording or claims. Adapt to the user's company, audience, stage, and available evidence.
- Prefer local files over external URLs for security and reliability.

## Live vs emailed guidance
- If the user requests a **live pitch**: keep drafts shorter, punchier, and optimized for delivery (fewer sentences; strong opening/closing; emphasis on one key metric).
- If the user requests an **email**: include extra context and appendices-ready detail (e.g., proof tier, market framing, and what you'd share next).
