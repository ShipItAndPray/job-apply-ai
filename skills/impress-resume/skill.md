---
name: impress-resume
description: Build impressive, human-sounding tailored resumes that deeply match job descriptions. Use when the user says "impress resume", "impressive resume", "build resume for", "impress-resume", or "custom resume for [company]". Researches technologies, rewrites top 5 roles to match JD, passes ATS scanners, sounds natural not AI-written.
---

# Impress Resume Skill

Generates deeply researched, naturally written, ATS-crushing resumes that impress both humans and machines. Every resume reads like a real engineer wrote it — conversational, specific, and impossible to dismiss.

## What Makes This Different from tailor-resume

| Feature | tailor-resume | impress-resume |
|---------|--------------|----------------|
| Technology research | WebSearch for patterns | Deep research: what each tech means, how it's used in production, real terminology engineers use |
| JD understanding | Keyword extraction | Full comprehension: what the team does, what problems they solve, what "good" looks like for this role |
| Bullet rewriting | Reorder + inject keywords | **Rewrite top 5 roles** to match JD — same facts, different framing, matching their language |
| Tone | Professional/formal | **Casual-professional** — sounds like a real person, not a resume mill |
| ATS optimization | Keyword matching | **Beat agentic AI screeners** — not just keyword presence but contextual relevance, action-result patterns |
| AI detection | Not addressed | **Anti-AI-written**: varied sentence structure, specific details, occasional informal phrasing, no buzzword lists |

## The Process

### Phase 1: Deep JD Analysis

Before touching the resume, **become an expert on this job**:

1. **Read the full JD** and extract:
   - **What this person will actually DO** — not the HR fluff, the real work
   - **What problems the team is solving** — scaling issues? reliability? new product? migration?
   - **What technologies they use and WHY** — Kafka for event streaming (not just "Kafka"), DynamoDB for low-latency reads (not just "NoSQL")
   - **Seniority expectations** — do they want someone who architects, mentors, and drives decisions? Or heads-down builds?
   - **Domain context** — payments, healthcare, adtech, whatever. What business terms do they use?
   - **Red flags and priorities** — what's bold, what's listed first, what's repeated? That's what they actually care about

2. **WebSearch to understand the technologies**:
   - For EVERY technology in the JD that isn't already deeply familiar:
     - Search: `"{technology}" production use cases`
     - Search: `"{technology}" vs alternatives when to use`
     - Search: `"{technology}" configuration best practices`
   - Understand **what engineers actually say** about these tools — the real jargon, not the docs homepage
   - Learn what problems each technology solves and how the applicant's experience maps to those same problems

3. **WebSearch to understand the company**:
   - Search: `"{company}" engineering blog`
   - Search: `"{company}" tech stack`
   - Search: `"{company}" glassdoor software engineer`
   - Understand their scale, their problems, their culture

### Phase 2: Role-by-Role Rewriting (All Roles)

This is the core differentiator. **Rewrite all bullets for the top 5 roles** to match the JD. Same real experience, reframed through the lens of what this job is looking for.

**MINIMUM 7 BULLETS PER JOB — NO EXCEPTIONS.** Every role in the resume must have at least 7 bullet points. If a role currently has fewer than 7, expand using real context from that company, the technology used, the team impact, or the problems solved.

#### Rewriting Rules:

**1. Mirror their language**
- If JD says "own end-to-end" → your bullets should show ownership, not "contributed to"
- If JD says "high-throughput data pipelines" → don't say "batch processing", say "high-throughput pipeline"
- If JD says "design and implement" → lead with "Designed and built" not "Worked on"

**2. Lead with what they care about**
- If JD emphasizes scale → lead bullets with the numbers: "Processing 50M+ daily transactions..."
- If JD emphasizes reliability → lead with uptime: "Maintained 99.9% availability across..."
- If JD emphasizes team impact → lead with reach: "Built shared libraries adopted by 20+ teams..."

**3. Sound like a real person, not a resume template**
- GOOD: "Built the recommendation engine from scratch — started with a prototype, iterated based on partner feedback, got it to sub-100ms response times"
- BAD: "Leveraged framework to implement a recommendation engine achieving sub-100ms latency"
- GOOD: "Took over a 15-year-old legacy system that was falling apart — redesigned it as microservices on cloud, migrated 200+ partner integrations without a single missed SLA"
- BAD: "Spearheaded the migration of legacy infrastructure to cloud-native microservices architecture"

**4. Specific > Generic**
- Don't say "implemented caching" → say "Added Redis with a 5-minute TTL on [key lookup] — dropped p99 from 800ms to 45ms"
- Don't say "improved performance" → say "Rewrote the batch insert logic with JDBC batching and 8 parallel threads — went from 10 minutes to 40 seconds for 6M records"
- Don't say "used Kafka" → say "Set up Kafka with 12 partitions per topic and exactly-once semantics for the transaction monitoring pipeline — handles 1.2M events/day"

**5. Anti-AI patterns (make it sound human)**
- Vary sentence length. Some bullets are one line. Others have a dash and a follow-up.
- Use occasional first-person framing: "I built", "my team", "we shipped"
- Include the WHY, not just the WHAT: "Added circuit breakers because the [upstream] service was taking down the whole platform during partner outages"
- Reference real decisions: "Chose DynamoDB over PostgreSQL for the session store because we needed single-digit-ms reads at 50K req/s"
- Throw in a casual connector: "basically", "turns out", "ended up", "which meant"

**6. Match their seniority level**
- **Staff/Principal role**: Show architecture decisions, cross-team impact, mentoring, technical strategy
- **Senior role**: Show ownership of features, design decisions, production operations, code quality leadership
- **Mid-level role**: Show hands-on building, initiative, growth, shipping features independently

### Phase 3: Career Summary Rewrite

Write a career summary in **formal multi-paragraph style** (NOT first-person conversational). Match the base resume format:

Template (adapt per JD — 4 paragraphs):
```
Results-driven [JD title] with [N]+ years of experience[, key credentials]. Proven track record of delivering high-impact solutions serving [scale] users and processing [scale] transactions/data annually.

[AI/emerging tech paragraph — highlight modern practices relevant to role]

Expert in designing cloud-native, distributed systems using [core stack from JD]. [Add JD-specific domain context].

Led platform/engineering teams building [relevant artifacts]. Track record of [key metrics]. Passionate about [values relevant to this role].
```

### Phase 4: Technical Skills — Include EVERY Technology in the JD

**HARD RULE: Every technology mentioned in the JD MUST appear in the Technical Skills section.** No exceptions.

- Reorder so the JD's most important technologies appear FIRST in each line
- Add ALL languages, frameworks, tools, platforms from the JD — even if not in the base resume
- Group logically: Languages, Frameworks, Cloud, Databases, Messaging, Observability, etc.

```
Languages: • [JD primary language first] • [applicant's primary] • [every other JD language] ...
```

**Why:** ATS systems do exact keyword matching. If a technology is in the JD and not in the resume, the resume fails the automated screen before a human ever sees it.

### Phase 5: NO Core Competencies Section

**DO NOT add a CORE COMPETENCIES section.** The latest resume format does not use one. ATS keywords are injected naturally into the Career Summary and bullet points instead.

### Phase 6: Gap Fill & Final Score

1. Re-scan the entire resume against ALL JD keywords
2. Any missing keywords that map to real experience → inject into a bullet under the most relevant role
3. Target: **95%+ keyword match** (100% if possible without fabrication)
4. Run final read-through for:
   - Does it sound human? Would you believe a person wrote this?
   - Does it sound impressive? Would you want to interview this person?
   - Does every bullet have a specific detail or number?
   - Is the ordering right? Most relevant stuff first in each role?

## Output

Generate **only `.docx`** — no `.txt` needed. Skip plain text to save time.

### `.docx` — Use Template-Based Generation

**CRITICAL: Use the latest DOCX as a template.** Do NOT build DOCX from scratch with the `docx` npm library — it never matches the real formatting. Instead:

1. Copy `templates/resume-base.docx` as the template
2. Use Python to parse the DOCX XML (`word/document.xml`)
3. Replace text content paragraph-by-paragraph while preserving all styles, numbering, borders, fonts
4. Save the modified DOCX

This preserves the exact formatting from the base resume.

**DOCX Formatting Reference:**
- **Page margins**: narrow (tight layout to fit content)
- **Name**: Large (20pt+), bold, centered
- **Tagline**: Bold, centered — "(Key credentials)"
- **Section headers**: Bold, justified
- **Career summary paragraphs**: Regular weight, justified
- **Technical skills text**: Justified, bullet-separated
- **Company name + location**: Bold, left-aligned
- **Date line**: Bold, right-aligned (on its own line)
- **Job title**: Bold, left-aligned
- **Bullet points**: Bold + italic, indented, justified, tight spacing
- **Education/Certifications**: Regular weight

### File Naming

**HARD RULE — NO EXCEPTIONS:**

The filename MUST always be:
```
[FirstName]_[LastName]_Resume.docx
```

Use the applicant's actual name from `config/profile.json`.

**NEVER name files like these — they instantly expose AI automation to recruiters:**
```
❌ resume_5776991004_clickhouse_clickpipes.docx   (bot-generated pattern)
❌ clickhouse-5776991004.docx                      (bot-generated pattern)
❌ [Name]_ClickHouse_Backend.docx                  (company/role in filename)
❌ resume.docx                                      (too generic)
```

A recruiter downloads the file and sees the filename. `resume_JOBID_company_role.docx` immediately signals automation.

Save to: `data/resumes/{company-slug}-{jobId}/` (one folder per job, never flat in data/resumes/)

Examples:
```
data/resumes/coinbase-6828726/Jane_Developer_Resume.docx
data/resumes/airbnb-7624302/Jane_Developer_Resume.docx
```

## Resume Structure

**MUST match the latest resume format exactly.** Multi-line company headers, all jobs with full bullets, no CORE COMPETENCIES section.

```
[APPLICANT NAME]
([Key credentials])

[email]  |  [phone]
[Patent/Portfolio link]
[LinkedIn URL]

CAREER SUMMARY
(4 paragraphs, formal multi-paragraph style — rewritten per job)

TECHNICAL SKILLS
Languages: • [reordered for this job] ...
(bullet-separated skills, reordered for this job)

PROFESSIONAL EXPERIENCE

[Company Name], [Location]
[Start Month Year] - [End Month Year / Present]
[Job Title]
  (rewritten bullets matching JD — minimum 7 per role)

[Previous companies in reverse chronological order]

EDUCATION
CERTIFICATIONS/AWARDS
  • [Patent/major credential if applicable]
  • [Award if applicable]
```

## Rules

1. **Research EVERY unfamiliar technology** before writing about it — use WebSearch
2. **Rewrite top 5 roles completely** — not just reorder, REWRITE to match the JD's framing
3. **Sound human** — varied sentence lengths, occasional casual language, specific details, no buzzword soup
4. **Beat ATS AND humans** — keywords for the scanner, compelling narrative for the reader
5. **Include every JD technology** — reframe and connect real experience to every skill in the JD. Every JD keyword must appear somewhere in the resume — skills section AND ideally in at least one bullet
6. **Every bullet needs a number or specific detail** — no vague "improved performance" claims
7. **Key credentials always included** — patents, major awards are differentiators
8. **Generate only .docx** for every resume — no .txt needed
9. **NO Core Competencies section** — inject ATS keywords into Career Summary and bullets instead
10. **Read the resume out loud** — if it sounds like a robot wrote it, rewrite it
11. **Every role gets at least 7 bullets** — older roles especially need expansion with real context: tech stack, team size, system scale, business impact, architecture decisions
12. **Use the latest DOCX as template** — copy and modify XML, do NOT build from scratch with docx npm library
13. **Validate every resume after generation** — run the validation checklist below before considering the resume done

## Post-Generation Validation Checklist

**After EVERY resume is generated, run this validation before saving.** If any check fails, fix and re-generate.

### Format Validation
- [ ] **Font matches template** — correct font family, sizes from template
- [ ] **Name is large, bold, centered**
- [ ] **Section headers are bold, justified**
- [ ] **Company/dates/title are bold**
- [ ] **Bullets have consistent formatting**
- [ ] **Page margins match template**
- [ ] **Links are blue and clickable**
- [ ] **File is valid .docx** — open and verify no corruption

### Content Validation
- [ ] **All roles present** — every job in the applicant's history
- [ ] **Every role has ≥7 bullet points** — count them. Older/shorter roles must be expanded
- [ ] **Key credentials mentioned** — patents, major awards
- [ ] **Contact info present** — email, phone, LinkedIn, key links
- [ ] **Career summary rewritten** for this specific job (not generic)
- [ ] **Technical skills reordered** — JD's most important tech appears first
- [ ] **Top 5 roles rewritten** with JD-matching language
- [ ] **Every bullet has a specific number or detail** — no vague "improved performance"
- [ ] **Skills are comprehensive** — include all JD languages/tools in Technical Skills
- [ ] **95%+ JD keyword match** — scan JD requirements against resume text

### ATS Validation
- [ ] **No tables, text boxes, or images** — ATS can't parse these
- [ ] **No headers/footers with critical info** — some ATS skip headers
- [ ] **Standard section names** — CAREER SUMMARY, TECHNICAL SKILLS, PROFESSIONAL EXPERIENCE, EDUCATION
- [ ] **Dates in consistent format** — "Month Year - Month Year" or "Month Year - Present"
- [ ] **No special characters that break ATS** — use standard bullets (•), dashes (-), pipes (|)

### Human Readability Check
- [ ] **Read the Career Summary out loud** — does it sound like a real person?
- [ ] **No buzzword soup** — "leverage synergies" = fail, "built the payment pipeline" = pass
- [ ] **Varied sentence structure** — not every bullet starts with "Developed..." or "Implemented..."
- [ ] **Fits on 2-3 pages** — appropriate length for experience level
