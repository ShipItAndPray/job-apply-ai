---
name: job-filters
description: Filter and clean job search results to remove bad matches. Use when the user says "filter jobs", "clean jobs", "remove bad jobs", "exclude jobs", or "job filters". LLM reads each job description intelligently — no regex, no scripts. Geared towards backend and devops roles.
---

# Job Filtering Skill

The LLM reads each job description and makes an intelligent decision about whether it's a good fit. No regex patterns. No hardcoded rules. Read the JD like a human would and decide.

## Who We're Filtering For

Read `config/profile.json` to understand the applicant's background. Key areas to consider:
- Their primary technology stack (languages, frameworks, cloud services, databases)
- Domain experience (fintech/payments, platform engineering, distributed systems, etc.)
- Seniority level and years of experience
- Visa/sponsorship requirements
- Location preferences

## Step 0 — Enrich with Full Job Descriptions First

**Before filtering, check if the input file has full descriptions.**

The weekly pull (`data/jobs/greenhouse-week.json`) may only contain title, location, URL, departments — NO descriptions. You MUST fetch full JDs before LLM filtering.

**Check if enriched file exists:**
```bash
ls -lh data/jobs/greenhouse-week-full.json 2>/dev/null || echo "NOT FOUND"
```

**If NOT found** — run the enrichment script first:
```bash
node scripts/pull-jd-content.cjs
```

**DO NOT filter without descriptions.** Title-only filtering misses critical sponsorship clauses, location details buried in the JD, and whether a "VP" role actually writes code.

## How To Filter

For each job:

1. **Read the full job description** from the `description` field
2. **Understand what this person would actually do day-to-day**
3. **Decide: keep or remove** based on the criteria below
4. **Score it** for prioritization

## Before ANYTHING — Check Already Applied

Cross-reference every job against the **master applied list** — `data/jobs.applied` — which contains ALL historically applied jobs. This is the authoritative dedup source.

Also check:
- `data/applications-log.json` — subset of submitted jobs (cross-check for safety)
- `data/resumes/*/answers.json` — jobs with existing applications

**Dedup by BOTH jobId AND company name.**

**Only skip jobs with `status: "submitted"` in applications-log.json.** Jobs with other statuses (error, validation_error, failed, needs_security_code) are NOT confirmed submissions — they should remain eligible for retry.

**This list grows as we work. Check EVERY time before generating a resume or applying.** Never duplicate an application.

## What To Keep

**The question: "Is this a software engineering role where someone writes code?"**

If yes → KEEP. Don't be strict about stack match. A Go backend role, a Rust systems role, a Python data pipeline role — keep them all. The applicant has extensive experience and can learn any stack.

Keep if the role involves writing code in ANY of these areas:
- Backend engineering in any language
- Platform / infrastructure / cloud engineering
- DevOps / SRE / reliability engineering
- Data engineering (pipelines, processing)
- ML infrastructure / ML platform engineering
- Payments / fintech / transaction systems
- Distributed systems / microservices
- Full-stack roles (even if frontend-heavy, if there's backend too)
- API design / services engineering
- Security engineering (building, not compliance)
- Mobile + backend roles
- Any engineering role where coding is a daily activity

**Don't filter based on language/stack mismatch.** A role asking for Go or Rust or Scala is still a good fit — just score it lower than a direct stack match. The ordering handles priority, not the filter.

## What To Remove

Remove if the JD makes it clear the role is:

**Not a coding role:**
- Product management, program management, project management
- Design (UX, UI, product design)
- Manual QA / test analysis (keep automation/SDET)
- IT support, help desk, system administration (non-engineering)
- Technical writing, documentation
- Sales, pre-sales, customer success
- Recruiting, HR, people ops
- Pure data analysis / business intelligence (no engineering)
- Compliance, risk analysis (non-engineering)

**IMPORTANT — Don't be fooled by titles:**
- "Vice President" in finance/fintech is often a senior IC engineering role (Goldman Sachs, JPMorgan, Citi, BofA, Deutsche Bank, etc. all use VP as a standard engineering level). **Read the JD** — if it mentions coding, system design, building services → KEEP.
- "Director of Engineering" could be hands-on at a startup. Read the JD.
- "Head of Backend" at a 20-person startup = IC who writes code. Read the JD.
- "Engineering Manager" might code 50%+ of the time. Read the JD.
- **The title is just a hint. The JD is the truth.** Always decide based on what the person will actually DO, not what the title says.

**Frontend-heavy with no meaningful backend:**
- Read the JD — if the day-to-day is React/Angular/Vue components, CSS, browser APIs, design systems, and there's NO mention of APIs, databases, server-side logic, or backend services → remove
- If it says "Full-Stack" but the JD is 90% frontend and 10% "calls APIs" → remove
- If the JD mentions both frontend AND backend meaningfully → keep

**Mobile-only with no backend:**
- Pure iOS (Swift/SwiftUI) or Android (Kotlin) UI work with no server-side component → remove
- Mobile + backend APIs / data pipelines → keep

**Too junior:**
- Intern, co-op, new grad, entry-level, associate (0-2 years)

**Sponsorship impossible:**
- JD explicitly says "no sponsorship", "must be US citizen", "clearance required", "ITAR", "TS/SCI"
- Read the actual text — don't assume based on company name alone
- **Defense contractors that typically require clearance** — remove outright: SpaceX, Anduril Industries, Palantir (government contracts), Lockheed Martin, Raytheon, Northrop Grumman, General Dynamics, Leidos, SAIC, MITRE, Booz Allen Hamilton. These roles almost universally require US citizenship or clearance and do not sponsor visas.

**Non-USA:**
- Role is based outside the United States with no remote option

**Management roles (not IC coding):**
- Engineering Manager, Manager of Engineering, Manager Engineering — remove unless JD explicitly states 50%+ coding
- "Head of [anything]" — always remove (VP-level management)
- Director of Engineering — remove unless at a tiny startup where JD clearly states hands-on coding
- Keep: Tech Lead, Staff Engineer, Principal Engineer, Lead Engineer — these are IC roles that write code

**Staffing agencies / aggregators:**
- Company is a staffing firm (Insight Global, Robert Half, TEKsystems, Revature, etc.) rather than the actual employer
- Job is reposted by an aggregator (Lensa, Jobgether, etc.)

## How To Score & Order (After Filtering)

**Scoring determines the ORDER we apply — not whether we apply.** Everything that passes the filters gets applied. Score decides what goes first.

**PREREQUISITE: The job MUST be a coding role.** Non-dev roles score 0 regardless of keyword matches.

For jobs that pass, score 0-100 based on:

### Score Boosters

**Technology match (cumulative, from JD text):**
- +5 per core technology matched (capped at +30)
- +25 bonus if the applicant's primary language + primary framework + primary messaging tech all appear

**Domain match:**
- +20: Domain aligns directly with applicant's primary domain experience
- +10: Domain aligns with secondary experience
- +5: General enterprise SaaS, B2B platforms

**Role & Company:**
- +15: "Backend" or "Platform" or "Infrastructure" or "DevOps" in title
- +10: Well-known tech company
- +10: Remote or local to applicant
- +10: Mentions building shared libraries/frameworks/platforms
- +5: Senior/Staff/Principal level
- +5: Mentions AI/ML infrastructure, MCP, agentic systems, LLM

**Penalties (subtract from score):**
- -100: Not a coding role (immediate removal)
- -20: Title suggests non-IC (Director, VP, Head of) AND JD confirms no coding
- -10: JD is vague/generic with no specific tech mentioned

### Tier Definitions — 10 Tiers of 100

**Organize all kept jobs into 10 tiers, 100 jobs per tier, ranked by score.** Apply Tier 1 first, then Tier 2, etc.

**Tier 1 (Rank 1-100) — Dream jobs. Use impress-resume with deep research.**
- Perfect stack match AND perfect domain match
- These get the most time per resume — full role-by-role rewrite

**Tier 2 (Rank 101-200) — Excellent fit. Use impress-resume.**
- Strong stack match + good domain match
- OR perfect stack match at a mid-tier company

**Tier 3 (Rank 201-300) — Strong fit. Use impress-resume, standard depth.**
- Good stack match (3+ core techs) + relevant domain

**Tier 4 (Rank 301-400) — Good fit. Use impress-resume.**
- Solid stack overlap (2-3 core techs)
- Backend role at a recognizable company

**Tier 5 (Rank 401-500) — Decent fit. Use impress-resume.**
- Backend in different language/stack but same patterns
- DevOps/SRE/infrastructure roles

**Tier 6 (Rank 501-600) — Worth applying. Use impress-resume.**
- Data engineering pipelines
- Full-stack roles where backend is primary

**Tier 7 (Rank 601-700) — Apply if time permits. Use base resume + keyword injection.**
- General backend roles, less tech overlap

**Tier 8 (Rank 701-800) — Lower priority. Use base resume + light edits.**
- General software engineering, tangential relevance

**Tier 9 (Rank 801-900) — Batch apply. Use base resume as-is.**
- Generic engineering roles, minimal overlap

**Tier 10 (Rank 901-1000) — Batch apply. Use base resume as-is.**
- Remaining dev roles, lowest relevance

**Total: 1,000 jobs across 10 tiers.** This is the realistic application target.

## Output

For each job, produce:
```json
{
  "id": 123,
  "title": "Senior Backend Engineer",
  "company": "Stripe",
  "url": "https://...",
  "decision": "keep",
  "score": 92,
  "tier": 1,
  "reason": "Java/Kafka payments backend at top fintech company — direct match"
}
```

Or if removed:
```json
{
  "id": 456,
  "title": "Senior React Developer",
  "company": "Acme",
  "url": "https://...",
  "decision": "remove",
  "reason": "JD is entirely React/Next.js frontend — no backend, no APIs, no server-side work"
}
```

Save all results to `data/jobs/filtered-ready.json`:
```json
{
  "filteredAt": "ISO timestamp",
  "stats": {
    "input": 3621,
    "kept": 1800,
    "removed": 1821,
    "byReason": {
      "already_applied": 252,
      "non_usa": 552,
      "no_sponsorship": 30,
      "not_developer_role": 150,
      "frontend_heavy": 200,
      "too_junior": 50,
      "staffing_agency": 45,
      "other": 42
    }
  },
  "jobs": [ ... kept jobs sorted by score ... ],
  "removed": [ ... removed jobs with reasons ... ]
}
```

Print summary after filtering:
```
Total input: X jobs
─────────────────────────
Kept:    X jobs (Tier 1: X | Tier 2: X | Tier 3: X)
Removed: X jobs
  Already applied:    X
  Non-USA:            X
  No sponsorship:     X
  Not developer role: X
  Frontend-heavy:     X
  Too junior:         X
  Staffing/aggregator: X
─────────────────────────
Ready to generate resumes and apply.
```

## Three-Pass LLM Filtering Pipeline

**ALL passes are LLM-based. No mechanical scripts. No regex filtering. The LLM reads every job and makes every decision.**

### Pass 1: LLM Bulk Triage (fast keep/remove)

**Purpose:** Reduce raw jobs to dev roles by reading each job.

For each job, the LLM:
1. **Reads the full job title, location, company, and description**
2. **Location check:** Is this job in the USA? "Remote" alone = keep. "Remote - India", "Remote-EMEA", any non-USA country = REMOVE.
3. **Already applied:** Cross-reference `data/applications-log.json` — only skip `status: "submitted"`.
4. **Role check:** Is this a coding role? Would this person write code daily? Non-dev = REMOVE.
5. **Sponsorship:** JD says "no sponsorship", "US citizen required", "clearance" = REMOVE.
6. **Staffing/clearance companies:** Known staffing agencies or defense contractors = REMOVE.
7. **Too junior:** Intern, co-op, new grad, entry-level = REMOVE.

**Output:** `data/jobs/pass1-pool.json` — dev roles in the USA

### Pass 2: LLM Scoring & Validation (full JD read)

**ACCURACY OVER SPEED AND COST. Always.**

The LLM reads the FULL job description of EVERY job from Pass 1. No shortcuts. No truncation. No regex scoring scripts.

For each job, the LLM MUST:
1. **Read the FULL job description** — every word, no truncation, no character limits
2. **Decide: is this a coding role?** — "Would this person write code daily?" Yes → keep. No → remove.
3. **Re-check location** — catch non-USA jobs that slipped through Pass 1
4. **Read for sponsorship blockers** — "no sponsorship", "US citizen", "clearance" buried in paragraph 5
5. **Score 0-100** based on tech stack match, domain match, company, seniority
6. **Write resume preparation notes** — what to emphasize, what to mirror, what angle to take

For each kept job, the LLM produces:
```json
{
  "id": 123,
  "title": "Senior Backend Engineer",
  "company": "stripe",
  "score": 92,
  "tier": 1,
  "keep": true,
  "reason": "Java/Kafka payments backend — direct stack match",
  "resumeStrategy": {
    "approach": "impress-resume",
    "leadWith": "most relevant prior role at most relevant company",
    "emphasize": ["key tech from JD", "relevant domain experience"],
    "mirrorLanguage": ["exact phrases from JD"],
    "deemphasize": ["less relevant experience"],
    "angleFromJD": "One sentence: what does this company actually want? Frame the resume around that."
  }
}
```

### Pass 3: LLM Final Ranking — Top 1,000 (curated)

**Purpose:** Narrow the validated pool to the **top 1,000 jobs**, ranked and grouped into 10 tiers of 100.

The LLM reviews the top ~1,500 from Pass 2. For EACH job, the LLM:
1. **Re-reads the full JD** — no cached scores from scripts, fresh LLM evaluation
2. **Re-checks location** — catch any remaining non-USA leaks
3. **Re-checks sponsorship** — look for hidden "no sponsorship" / "US citizen" / "clearance required" text
4. **De-duplicates** — same role reposted under different IDs at same company → keep only one
5. **Removes non-dev roles** that passed earlier passes
6. **Scores 0-100** — fresh LLM score based on full JD understanding
7. **Writes `resumeStrategy` notes** — leadWith, emphasize, mirrorLanguage, deemphasize, angleFromJD
8. **Ranks and assigns to tiers** — the LLM decides which tier each job belongs in

**Output:** `data/jobs/top-1000.json`

### LLM Pass Caching — Don't Duplicate Work

**File:** `data/jobs/llm-validated-ids.json`

- Once a job ID has been LLM-validated, **NEVER validate it again** — use the cached decision.
- On each LLM pass, only process NEW job IDs not in `llm-validated-ids.json`.
- The first full LLM pass is expensive (1-2 hours for large batches). Every subsequent pass is cheap (only new jobs since last pull).

### Parallel Subagents for ALL LLM Passes

Split jobs into chunks and launch parallel subagents:
- **Chunk size: 200 jobs**
- **NEVER truncate descriptions** — pass the FULL job description. Tech stack requirements are usually in the second half.
- Each subagent reads its chunk, makes keep/remove decisions, scores, assigns tiers, writes resume notes
- Results merged into `llm-validated-ids.json` and `top-1000.json`
- Launch 6-8 agents using `run_in_background: true`
- **Never sacrifice accuracy for speed**

## Application Priority Ordering

After filtering, sort jobs into 4 priority groups within each tier:

**P1** — Senior Software Engineer titles + applicant's primary stack match
**P2** — Senior Software Engineer titles, other stacks
**P3** — Applicant's primary stack + other titles (Staff, Principal, Platform, Backend, etc.)
**P4** — Everything else

Within each group: sort by `postedAt` date NEWEST FIRST, then by score descending. Older postings are deprioritized — companies may have already filled those roles.

Save the final list to `data/jobs/filtered-ready.json` with jobs in this priority order.

## Rules

1. **Read the JD** — don't just pattern match titles. Read and understand.
2. **Cast a wide net** — when in doubt, keep. Missing a good job is worse than applying to a mediocre one.
3. **Check already-applied EVERY time** — before resume generation AND before application
4. **Backend/devops focus** — but don't be so strict we miss good full-stack or platform roles
5. **Save removed jobs with reasons** — user can review and override
6. **Re-run before each batch** — new applications may have been submitted
7. **Never fabricate a JD** — if you can't read the JD, keep the job and note "JD not available"
