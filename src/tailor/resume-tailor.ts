import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TailoringInput {
  jobId: string;
  jobDescription: string;
  companyName: string;
  jobTitle: string;
  baseResumePath: string; // path to templates/resume-base.txt
}

export interface TailoringOutput {
  resumeTxt: string;
  coverLetterTxt: string;
  matchScore: number; // 0-100
  matchAnalysis: string;
  keywordsFound: string[]; // Keywords from JD that match resume
  keywordsMissing: string[]; // Keywords from JD NOT in resume
  resumePath: string; // saved path
  coverLetterPath: string; // saved path
}

// ---------------------------------------------------------------------------
// Keyword dictionaries
// ---------------------------------------------------------------------------

const PROGRAMMING_LANGUAGES = [
  'java', 'python', 'typescript', 'javascript', 'go', 'golang', 'rust',
  'c++', 'c#', 'ruby', 'scala', 'kotlin', 'swift', 'php', 'r',
  'sql', 'bash', 'shell', 'perl', 'dart', 'elixir', 'haskell',
  'objective-c', 'lua', 'groovy', 'clojure',
];

const FRAMEWORKS = [
  'spring boot', 'spring', 'react', 'angular', 'vue', 'django', 'flask',
  'fastapi', 'express', 'nestjs', 'next.js', 'nextjs', 'nuxt', 'rails',
  'ruby on rails', 'asp.net', '.net', 'node.js', 'nodejs', 'spring cloud',
  'micronaut', 'quarkus', 'svelte', 'remix', 'gatsby', 'tailwind',
  'bootstrap', 'material ui', 'redux', 'graphql', 'grpc',
];

const TOOLS = [
  'kafka', 'redis', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  'jenkins', 'github actions', 'gitlab ci', 'circleci', 'datadog',
  'splunk', 'grafana', 'prometheus', 'elasticsearch', 'kibana', 'logstash',
  'rabbitmq', 'celery', 'airflow', 'spark', 'hadoop', 'flink',
  'snowflake', 'databricks', 'dbt', 'tableau', 'power bi', 'jira',
  'confluence', 'figma', 'postman', 'swagger', 'openapi', 'nginx',
  'envoy', 'istio', 'consul', 'vault', 'git', 'maven', 'gradle',
  'webpack', 'vite', 'npm', 'yarn', 'pnpm',
];

const CLOUD_SERVICES = [
  'aws', 'amazon web services', 'ec2', 's3', 'lambda', 'dynamodb',
  'rds', 'ecs', 'eks', 'fargate', 'cloudformation', 'cdk', 'sqs', 'sns',
  'kinesis', 'step functions', 'api gateway', 'cloudwatch', 'iam',
  'gcp', 'google cloud', 'bigquery', 'cloud run', 'gke', 'pub/sub',
  'cloud functions', 'cloud storage',
  'azure', 'azure devops', 'cosmos db', 'azure functions', 'aks',
  'blob storage',
];

const METHODOLOGIES = [
  'agile', 'scrum', 'kanban', 'ci/cd', 'cicd', 'tdd', 'bdd',
  'test-driven development', 'behavior-driven development',
  'devops', 'sre', 'site reliability', 'microservices', 'event-driven',
  'domain-driven design', 'ddd', 'cqrs', 'event sourcing',
  'continuous integration', 'continuous deployment', 'continuous delivery',
  'infrastructure as code', 'iac', 'gitops', 'trunk-based development',
  'pair programming', 'code review', 'mob programming',
  'lean', 'safe', 'xp', 'extreme programming',
];

const SOFT_SKILLS = [
  'leadership', 'mentoring', 'cross-functional', 'collaboration',
  'communication', 'problem-solving', 'critical thinking', 'teamwork',
  'stakeholder management', 'project management', 'product thinking',
  'customer-focused', 'data-driven', 'strategic thinking', 'ownership',
  'initiative', 'adaptability', 'time management', 'prioritization',
  'conflict resolution', 'empathy', 'emotional intelligence',
  'presentation', 'public speaking', 'technical writing',
  'influence', 'negotiation', 'decision-making',
];

const INDUSTRY_TERMS = [
  'fintech', 'payments', 'compliance', 'underwriting', 'lending',
  'insurance', 'healthcare', 'healthtech', 'edtech', 'e-commerce',
  'ecommerce', 'saas', 'b2b', 'b2c', 'marketplace', 'logistics',
  'supply chain', 'blockchain', 'crypto', 'defi', 'web3',
  'machine learning', 'ml', 'artificial intelligence', 'ai',
  'deep learning', 'nlp', 'natural language processing',
  'computer vision', 'data science', 'data engineering',
  'cybersecurity', 'security', 'identity', 'authentication',
  'authorization', 'oauth', 'sso', 'gdpr', 'hipaa', 'sox', 'pci',
  'real-time', 'low-latency', 'high-throughput', 'distributed systems',
  'scalability', 'reliability', 'observability', 'monitoring',
];

// Combine all keyword lists with their categories for structured extraction
const KEYWORD_CATEGORIES: Record<string, string[]> = {
  languages: PROGRAMMING_LANGUAGES,
  frameworks: FRAMEWORKS,
  tools: TOOLS,
  cloud: CLOUD_SERVICES,
  methodologies: METHODOLOGIES,
  softSkills: SOFT_SKILLS,
  industry: INDUSTRY_TERMS,
};

// ---------------------------------------------------------------------------
// Helper: normalize text for keyword matching
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.toLowerCase().replace(/['']/g, "'");
}

/**
 * Check whether a keyword appears in the given text. Uses word-boundary-aware
 * matching for short keywords to avoid false positives (e.g. "r" inside "react").
 */
function keywordPresent(keyword: string, normalizedText: string): boolean {
  if (keyword.length <= 2) {
    // For very short keywords (e.g. "r", "go", "ai", "ml"), require word boundaries
    const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
    return pattern.test(normalizedText);
  }
  return normalizedText.includes(keyword);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract keywords from a job description, categorized as required, preferred,
 * and technologies.
 *
 * "Required" keywords are those found near requirement-related language.
 * "Preferred" keywords are those found near nice-to-have language.
 * "Technologies" captures every technology/tool/language keyword found.
 */
export function extractKeywords(jobDescription: string): {
  required: string[];
  preferred: string[];
  technologies: string[];
} {
  const normalizedJD = normalize(jobDescription);

  // Split into rough sections to distinguish required vs preferred
  const requiredSectionPattern =
    /(?:requirements?|qualifications?|must have|minimum|basic|what you(?:'ll)? need)[\s\S]*?(?=(?:preferred|nice to have|bonus|benefits|about us|responsibilities|$))/gi;
  const preferredSectionPattern =
    /(?:preferred|nice to have|bonus|ideally|plus|desired)[\s\S]*?(?=(?:requirements?|qualifications?|benefits|about us|responsibilities|$))/gi;

  const requiredSections = (normalizedJD.match(requiredSectionPattern) || []).join(' ');
  const preferredSections = (normalizedJD.match(preferredSectionPattern) || []).join(' ');

  const allTechKeywords: string[] = [];
  const requiredKeywords: string[] = [];
  const preferredKeywords: string[] = [];

  // Scan every category for matches against the full JD
  const techCategories = ['languages', 'frameworks', 'tools', 'cloud'];

  for (const [category, words] of Object.entries(KEYWORD_CATEGORIES)) {
    for (const word of words) {
      if (!keywordPresent(word, normalizedJD)) continue;

      // It appears somewhere in the JD
      if (techCategories.includes(category)) {
        allTechKeywords.push(word);
      }

      if (requiredSections && keywordPresent(word, requiredSections)) {
        requiredKeywords.push(word);
      } else if (preferredSections && keywordPresent(word, preferredSections)) {
        preferredKeywords.push(word);
      } else {
        // Found in JD but not clearly in a required/preferred section — treat as required
        requiredKeywords.push(word);
      }
    }
  }

  return {
    required: [...new Set(requiredKeywords)],
    preferred: [...new Set(preferredKeywords)],
    technologies: [...new Set(allTechKeywords)],
  };
}

/**
 * Compare a resume against a job description and compute a match score.
 *
 * Score = (matched keywords / total JD keywords) * 100
 */
export function computeMatchScore(
  resumeText: string,
  jobDescription: string
): { score: number; matched: string[]; missing: string[] } {
  const normalizedResume = normalize(resumeText);
  const normalizedJD = normalize(jobDescription);

  // Collect every keyword that appears in the JD
  const jdKeywords: string[] = [];
  for (const words of Object.values(KEYWORD_CATEGORIES)) {
    for (const word of words) {
      if (keywordPresent(word, normalizedJD)) {
        jdKeywords.push(word);
      }
    }
  }

  const uniqueJDKeywords = [...new Set(jdKeywords)];

  if (uniqueJDKeywords.length === 0) {
    return { score: 0, matched: [], missing: [] };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of uniqueJDKeywords) {
    if (keywordPresent(keyword, normalizedResume)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = Math.round((matched.length / uniqueJDKeywords.length) * 100);

  return { score, matched, missing };
}

/**
 * Save tailored resume and cover letter to data/resumes/{jobId}/.
 * Creates directories as needed and returns the saved file paths.
 */
export function saveTailoredDocuments(
  jobId: string,
  resumeTxt: string,
  coverLetterTxt: string
): { resumePath: string; coverLetterPath: string } {
  const outputDir = path.resolve(__dirname, '../../data/resumes', jobId);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resumePath = path.join(outputDir, 'resume.txt');
  const coverLetterPath = path.join(outputDir, 'cover_letter.txt');

  fs.writeFileSync(resumePath, resumeTxt, 'utf-8');
  fs.writeFileSync(coverLetterPath, coverLetterTxt, 'utf-8');

  console.log(`[resume-tailor] Saved resume to ${resumePath}`);
  console.log(`[resume-tailor] Saved cover letter to ${coverLetterPath}`);

  return { resumePath, coverLetterPath };
}

/**
 * Generate a tailoring prompt that Claude (or another LLM) can use to
 * produce a tailored resume and cover letter.
 *
 * The prompt includes the base resume, the full job description, keyword
 * analysis, and specific instructions for how to tailor the content.
 */
export function generateTailoringPrompt(input: TailoringInput): string {
  // Read the base resume
  let baseResume: string;
  try {
    baseResume = fs.readFileSync(input.baseResumePath, 'utf-8');
  } catch {
    throw new Error(
      `Could not read base resume at ${input.baseResumePath}. ` +
        'Make sure templates/resume-base.txt exists.'
    );
  }

  // Run keyword extraction and match scoring
  const keywords = extractKeywords(input.jobDescription);
  const { score, matched, missing } = computeMatchScore(baseResume, input.jobDescription);

  const prompt = `You are an expert resume writer and career coach. Given the following job description for **${input.jobTitle}** at **${input.companyName}**, and the base resume below, create a tailored resume and cover letter.

---

## Job Description

${input.jobDescription}

---

## Base Resume

${baseResume}

---

## Keyword Analysis

- **Current match score:** ${score}/100
- **Keywords already in resume:** ${matched.join(', ') || 'none'}
- **Keywords missing from resume:** ${missing.join(', ') || 'none'}
- **Required keywords from JD:** ${keywords.required.join(', ') || 'none'}
- **Preferred keywords from JD:** ${keywords.preferred.join(', ') || 'none'}
- **Technologies mentioned in JD:** ${keywords.technologies.join(', ') || 'none'}

---

## Instructions

Create a tailored version of the resume that:

1. **Reorders bullet points** to highlight the most relevant experience first for this specific role.
2. **Adds missing keywords naturally** where they can be truthfully incorporated. Do NOT fabricate experience.
3. **Adjusts the career summary / professional profile** to mirror the language and priorities of the job description.
4. **Emphasizes quantified achievements** that are most relevant to this role.
5. **Keeps the resume to a maximum of 2 pages** — be concise and impactful.

Then generate a **cover letter** specific to this role that:

1. Opens with a compelling hook referencing the company or role specifically.
2. Highlights 2-3 of the strongest matching qualifications with concrete examples.
3. Addresses any potential gaps by reframing related experience.
4. Closes with enthusiasm and a clear call to action.
5. Is no longer than one page.

---

## Output Format

Return the output in the following format:

### TAILORED RESUME START ###
[The full tailored resume text here]
### TAILORED RESUME END ###

### COVER LETTER START ###
[The full cover letter text here]
### COVER LETTER END ###

### MATCH ANALYSIS ###
[A brief paragraph analyzing how well this candidate fits the role and any risks/gaps]
### MATCH ANALYSIS END ###
`;

  return prompt;
}

/**
 * Parse the output from an LLM that followed the generateTailoringPrompt format
 * and return a full TailoringOutput.
 */
export function parseTailoringResponse(
  input: TailoringInput,
  llmResponse: string
): TailoringOutput {
  // Extract sections from the LLM response
  const resumeMatch = llmResponse.match(
    /### TAILORED RESUME START ###\s*([\s\S]*?)\s*### TAILORED RESUME END ###/
  );
  const coverLetterMatch = llmResponse.match(
    /### COVER LETTER START ###\s*([\s\S]*?)\s*### COVER LETTER END ###/
  );
  const analysisMatch = llmResponse.match(
    /### MATCH ANALYSIS ###\s*([\s\S]*?)\s*### MATCH ANALYSIS END ###/
  );

  const resumeTxt = resumeMatch ? resumeMatch[1].trim() : llmResponse;
  const coverLetterTxt = coverLetterMatch ? coverLetterMatch[1].trim() : '';
  const matchAnalysis = analysisMatch ? analysisMatch[1].trim() : '';

  // Compute match score against the tailored resume
  const { score, matched, missing } = computeMatchScore(resumeTxt, input.jobDescription);

  // Save to disk
  const { resumePath, coverLetterPath } = saveTailoredDocuments(
    input.jobId,
    resumeTxt,
    coverLetterTxt
  );

  return {
    resumeTxt,
    coverLetterTxt,
    matchScore: score,
    matchAnalysis,
    keywordsFound: matched,
    keywordsMissing: missing,
    resumePath,
    coverLetterPath,
  };
}
