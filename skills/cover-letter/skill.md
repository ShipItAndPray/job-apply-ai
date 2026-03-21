---
name: cover-letter
description: Generate job-specific cover letters with links and proof points. Use when the user says "cover letter", "write cover letter", "generate cover letter", or "cover letter for [company]". Produces .txt and .docx files.
---

# Cover Letter Generation Skill

Generates job-specific, professional cover letters for the applicant.

## When To Write a Cover Letter

**Most companies don't care.** Only write one if:
- The application form has a **required** cover letter upload field
- It's a **dream company** where standing out matters
- The user specifically asks for one

**Skip for:** Most Greenhouse apps, most Lever apps, any form that doesn't ask.

## Tone & Style

- **Casual and human** — like you're writing to a friend who works there, not a formal letter
- **Confident but chill** — state facts, don't oversell. "I built X" not "I am deeply passionate about leveraging my extensive experience to..."
- **Short** — 2-3 paragraphs max. Recruiters skim. Get to the point fast.
- **Sound like a person** — use contractions, casual connectors ("honestly", "turns out", "basically"), first person
- **No corporate fluff** — no "Dear Hiring Manager", no "I am writing to express my interest", no "I would be thrilled to"
- **Never use**: "leverage", "synergy", "passionate about", "thrilled to", "eager to", "I believe I would be a great fit"
- **Do use**: specific numbers, company names, honest self-assessment, casual tone

## Links to Include (from config/profile.json)

Pull all relevant links from the applicant's profile:
- LinkedIn URL
- Portfolio / patent / GitHub / GitLab links
- Any relevant award or achievement URLs

## Letter Structure

### 1. Opening (Job-Specific)

Detect job type from JD and use matching opener:

| JD Type | Detection | Opening |
|---------|-----------|---------|
| Payments/Fintech | payment, billing, transaction, fintech, credit | Lead with transaction processing experience and relevant fintech employers |
| E-commerce | commerce, ecommerce, marketplace, storefront | Lead with marketplace/platform backend experience |
| Healthcare | health, medical, clinical, patient | Bridge from engineering principles: regulatory compliance, data integrity, high availability |
| Distributed Systems | distributed, kafka, event-driven, streaming | Lead with event-driven architecture experience and event volumes |
| Platform/Infra | platform, infrastructure, framework, developer experience | Lead with shared libraries/services adopted by many teams |
| AI/ML | ai, ml, llm, agentic, machine learning | Lead with AI-augmented development practices |
| High Scale | scale, high-throughput, high-volume | Lead with scaling metrics from past work |
| Generic | (default) | Lead with years of experience and most impressive employers |

### 2. Tech Stack Match (If JD Mentions Technologies)

Format: "Your stack mentions [their techs] — [connection to my experience]"

Match their specific technologies to the applicant's real experience from `config/profile.json`.

### 3. Proof Points (Pick 2-4 Based on Job Type)

Draw from the applicant's most impressive achievements:
- **Scale metrics**: Systems serving millions of users, processing high transaction volumes
- **Platform impact**: Shared libraries/services adopted across many teams
- **Awards/Recognition**: Any CEO/leadership awards, patents, major recognitions
- **Reliability**: Significant incident reduction through monitoring/alerting improvements
- **AI/Innovation**: Modern tooling, AI-augmented development, cutting-edge integrations

### 4. Closer (Keep It Short)

Something like:
- "Happy to chat more about any of this — I think there's a good fit here."
- "Would love to talk more about what you're building."
- "Let me know if you'd like to dig into any of this."

NOT: "I would welcome the opportunity to connect and discuss how I can contribute to your esteemed organization."

### 5. Links Footer

```
- LinkedIn: [url from profile]
- Portfolio/Patent: [url from profile]
- GitHub/GitLab: [url from profile]

[Preferred Name]
[email] | [phone]
```

Sign off with preferred name, not full formal name — casual.

## DOCX Formatting

### Header
```
[Full Name] (large bold)
[email]  |  [phone] (medium, muted color)
[LinkedIn]  |  [Portfolio]  |  [GitHub] (clickable hyperlinks)
─────────────────────────────── (bottom border)
[Current Date] (medium, muted color)
```

### Body
- **"Dear Hiring Manager,"** — medium size, spacing after
- **Body paragraphs** — medium size, spacing after
- **Bullet points (•)** — medium size, indented, spacing after
- **Bullets with URLs** — URL portion as clickable hyperlink
- **"Best regards,"** — spacing before
- **Name** — bold
- **Link labels** — bold label + clickable URL

### Page
- Margins: ~0.625 inches all sides
- All hyperlinks: colored, underlined, clickable

## Rules

- **Every cover letter must reference the specific role and company by name**
- **Tech stack match paragraph only if JD mentions specific technologies**
- **Key credential links always included** (patents, major awards)
- **Never say "you should hire me"** — let the achievements speak
- **Never mention salary, visa status, or relocation** in cover letter
- **Generate both .txt and .docx** for every cover letter
- **File naming**: `[FirstName]_[LastName]_Cover_Letter.txt` and `.docx`
- **Save to**: `data/resumes/{company-slug}-{jobId}/` (same folder as the resume)
