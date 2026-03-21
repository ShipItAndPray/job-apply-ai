---
name: tailor-resume
description: ATS-optimize and tailor resumes for specific job descriptions. Use when the user says "tailor resume", "optimize resume", "ATS optimize", "make resume match", or "resume for [company]". Generates keyword-optimized resumes as .txt and .docx.
---

# Resume Tailoring Skill

Generates ATS-optimized, job-specific resumes with deeply researched, authentic bullet points.

## Strategy: Deep Research, Then Tailor

### Step 1: Analyze the Job Description — Roles & Responsibilities

Before touching the resume, **deeply understand what this job actually is**:

1. **Read the full JD** and identify:
   - **Core responsibilities** — What will this person do day-to-day?
   - **Key deliverables** — What outcomes are expected?
   - **Team context** — What team is this? Who do they collaborate with?
   - **Seniority signals** — Are they looking for someone who leads design reviews, mentors, owns architecture, or just implements?
   - **Domain knowledge** — What business domain? What industry-specific terms do they use?

2. **WebSearch** to understand the company and role deeper:
   - Search: `"{company name}" engineering blog` — learn their tech stack, architecture patterns, team structure
   - Search: `"{company name}" {role title} glassdoor` — understand what people in this role actually do there
   - Search: `"{technology}" production best practices` — learn how engineers actually work with each key technology
   - Search: `"{domain}" backend engineer responsibilities` — understand typical day-to-day for this type of role

3. **Map JD responsibilities to the applicant's experience**:
   - For each JD responsibility, find the closest matching work the applicant actually did
   - Use `config/profile.json` and `templates/resume-base.txt` as the source of truth for real experience
   - Connect each JD requirement to actual work done at real companies

### Step 2: Research the Technologies

For each technology mentioned in the JD:

1. **WebSearch** for real-world usage patterns (e.g., "Apache Flink real-world use cases", "Temporal workflow engine production patterns")
2. Understand **how engineers actually work** with these tools day-to-day — what problems they solve, what configurations they tune, what metrics they monitor
3. Learn the **real terminology** practitioners use — not marketing language, but the terms you'd hear in a standup or design review
4. Identify **realistic numbers** — throughput, latency, cluster sizes, event volumes, error rates — that match the scale of the applicant's actual employers

### Step 3: Extract JD Keywords

Scan the full job description for:
- **Technologies**: languages, frameworks, cloud services, databases, tools (200+ patterns)
- **Domain terms**: payments, fintech, compliance, fraud, healthcare, SaaS, etc.
- **Methodology terms**: scalability, high availability, performance optimization, etc.
- **Soft skills**: mentoring, leadership, cross-functional, system design, etc.
- **Responsibility verbs**: design, architect, build, own, lead, optimize, migrate, scale, mentor, drive

### Step 4: Score Against Base Resume

Check which JD keywords are already present in `templates/resume-base.txt`. Target: **100% keyword match**.

### Step 5: Build Tailored Resume

For **every role** in the applicant's history:
1. Score existing bullets by JD keyword matches, sort descending
2. **Research** any JD technologies not in the base resume
3. **Rewrite/adapt existing bullets** to mirror the JD's language
4. **Write 1-3 authentic augmentation bullets per role** that:
   - **Mirror the JD's responsibilities**
   - **Match the seniority level**
   - **Reflect the domain** — use the same business terminology the JD uses
   - Sound like real work done at that company
   - Include specific numbers (throughput, latency, user counts, percentages)
   - Use implementation-level detail (specific classes, configurations, patterns)
   - Never fabricate — but frame real experience through the lens of the JD's responsibilities and language

### Step 6: Generate Output

Both `.txt` and `.docx` formats with:
- CORE COMPETENCIES section mirroring JD keywords exactly
- Career summary variant matched to job type
- Bullets reordered by relevance within each role
- Augmentation bullets woven naturally into each role section

## Resume Structure (Order Matters for ATS)

```
[APPLICANT NAME]
([Key credentials, e.g., "Patent holder, Award winner"])
[email] | [phone] | [LinkedIn] | [Patent/Portfolio link]

CAREER SUMMARY (tailored to job type)

CORE COMPETENCIES (mirrors JD keywords exactly)
Technical: [keywords from JD that match experience]
Practices: [soft skills and methodologies from JD]

TECHNICAL SKILLS (comprehensive, always included)

PROFESSIONAL EXPERIENCE
  [Most recent role] | [Title] | [Dates]
  [Previous roles in reverse chronological order]

EDUCATION
CERTIFICATIONS & AWARDS
```

## Career Summary Variants (Pick Based on JD)

| JD Type | Detection Pattern | Summary Focus |
|---------|------------------|---------------|
| Payments/Fintech | payment, billing, transaction, fintech, credit | Transaction processing experience, relevant fintech companies |
| Distributed Systems | distributed, kafka, event-driven, streaming | High-throughput event processing, fault-tolerant microservices |
| Platform Engineering | platform, infrastructure, framework | Shared libraries adopted by many teams, incident reduction |
| Data Engineering | data engineer/platform/pipeline, etl, batch | High-volume record processing, batch pipelines |
| AI/ML | ai, ml, llm, agentic | AI-augmented development, MCP integrations, velocity increase |
| Generic/Other | (default) | Scale metrics, key companies, key achievements |

## Adapting Bullets to Match JD Roles & Responsibilities

The resume should read like the applicant already does what the JD is asking for. Mirror the JD's language:

### If JD emphasizes OWNERSHIP:
- JD says: "Own the end-to-end payment pipeline"
- Bullet: "Owned end-to-end [domain] processing pipeline from intake through final stage, managing [N]+ daily decisions with 99.9% uptime"

### If JD emphasizes ARCHITECTURE/DESIGN:
- JD says: "Design scalable distributed systems"
- Bullet: "Designed event-driven architecture with [tech] processing [N]M daily events for real-time [use case] with exactly-once semantics"

### If JD emphasizes TEAM LEADERSHIP:
- JD says: "Lead a team of 5-8 engineers"
- Bullet: "Led architecture reviews for [N] engineering squads, established microservice design templates and testing patterns that reduced new hire onboarding from [X] weeks to [Y] days"

### If JD emphasizes MIGRATION/MODERNIZATION:
- JD says: "Migrate legacy systems to cloud-native architecture"
- Bullet: "Designed event-driven microservices architecture replacing legacy system, migrating [N]+ partner integrations to cloud with modern messaging infrastructure"

### If JD emphasizes RELIABILITY/ON-CALL:
- JD says: "Ensure 99.99% availability, manage incident response"
- Bullet: "Reduced severity-one incidents by [N]% through distributed tracing, custom monitoring dashboards, and proactive alerting — maintained [N]% uptime serving [N]M+ users"

## Writing Authentic Bullets — Guidelines

### DO:
- "Configured Kafka consumer groups with 12 partitions and exactly-once semantics, processing 1.2M daily events with <200ms p99 latency"
- "Tuned PostgreSQL connection pooling via HikariCP (max-pool-size: 30, idle-timeout: 10min), reducing database connection wait times by 65%"
- "Built Terraform modules for VPC, ECS, and RDS provisioning with remote state in S3, enabling one-command environment standup"

### DON'T:
- "Worked with Kafka" (too vague)
- "Utilized Redis for caching purposes" (buzzword stuffing)
- "Responsible for maintaining the database" (passive, no detail)
- "Helped with the migration" (passive, no ownership)

## 100% Match Guarantee — Gap Fill Strategy

After all role-specific augmentation, run a final gap check:
1. **Re-score** the resume against all JD keywords
2. For any still-missing keywords:
   - Add to **CORE COMPETENCIES** line (ATS scanners check this first)
   - Inject a bullet under the most relevant role for any keyword that maps to real experience
3. This ensures every single JD keyword appears in the resume — both in a skills section AND in an experience bullet

## DOCX Formatting

- **Page margins**: Tight (0.375 - 0.625 inches all sides depending on template)
- **Name**: Large bold centered
- **Contact**: Centered below name
- **Section headers**: Bold with bottom border
- **Company/role lines**: Bold
- **Bullet points**: Indented, consistent font
- **Skills lines**: Label bold

## Key Files
- **Base resume**: `templates/resume-base.txt`
- **Profile**: `config/profile.json`
- **DOCX template**: `templates/resume-base.docx` (use as template for formatting)

## Rules

- **Research technologies before writing** — use WebSearch to understand real-world usage patterns
- **Every claim must be truthful** — we reorder, inject, and frame, but never fabricate
- **CORE COMPETENCIES mirrors JD exactly** — this is the #1 ATS score booster
- **All roles get augmentation** — not just the most recent ones
- **Include specific numbers** — throughput, latency, user counts, percentages
- **Implementation-level detail** — mention specific libraries, configurations, patterns
- **Always include key credentials** (patent, major awards) in certifications section
- **Generate both .txt and .docx** for every tailored resume
