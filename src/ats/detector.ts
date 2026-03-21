/**
 * ATS Detection Module
 *
 * Detects which Applicant Tracking System a job application URL belongs to
 * based on URL patterns and optional DOM signatures.
 */

export type ATSSystem =
  | 'workday'
  | 'greenhouse'
  | 'lever'
  | 'icims'
  | 'smartrecruiters'
  | 'ashby'
  | 'unknown';

export interface ATSDetectionResult {
  system: ATSSystem;
  confidence: number; // 0-1
  applyUrl: string;
}

interface ATSPattern {
  system: ATSSystem;
  urlPatterns: RegExp[];
  confidence: number;
}

const ATS_PATTERNS: ATSPattern[] = [
  {
    system: 'workday',
    urlPatterns: [
      /myworkdayjobs\.com/i,
      /wd[1-5]\.myworkdayjobs\.com/i,
      /workday\.com\/job/i,
      /workday\.com\/.*\/job/i,
    ],
    confidence: 0.95,
  },
  {
    system: 'greenhouse',
    urlPatterns: [
      /boards\.greenhouse\.io/i,
      /job-boards\.greenhouse\.io/i,
      /greenhouse\.io\/.*\/jobs\//i,
    ],
    confidence: 0.95,
  },
  {
    system: 'lever',
    urlPatterns: [
      /jobs\.lever\.co/i,
      /lever\.co\/apply/i,
      /lever\.co\/.*\/apply/i,
    ],
    confidence: 0.95,
  },
  {
    system: 'icims',
    urlPatterns: [
      /\.icims\.com/i,
      /icims\.com/i,
    ],
    confidence: 0.90,
  },
  {
    system: 'smartrecruiters',
    urlPatterns: [
      /jobs\.smartrecruiters\.com/i,
      /smartrecruiters\.com/i,
    ],
    confidence: 0.90,
  },
  {
    system: 'ashby',
    urlPatterns: [
      /jobs\.ashbyhq\.com/i,
      /ashbyhq\.com/i,
    ],
    confidence: 0.90,
  },
];

/**
 * Detect which ATS system a URL belongs to based on URL pattern matching.
 */
export function detectATSFromUrl(url: string): ATSDetectionResult {
  const normalized = url.trim().toLowerCase();

  for (const pattern of ATS_PATTERNS) {
    for (const regex of pattern.urlPatterns) {
      if (regex.test(normalized)) {
        return {
          system: pattern.system,
          confidence: pattern.confidence,
          applyUrl: url,
        };
      }
    }
  }

  return {
    system: 'unknown',
    confidence: 0,
    applyUrl: url,
  };
}

/**
 * DOM-based ATS detection for when URL matching is inconclusive.
 * Inspects page content for known ATS fingerprints.
 *
 * Requires a Playwright Page object. Use this as a secondary detection
 * method when detectATSFromUrl returns 'unknown'.
 */
export async function detectATSFromDOM(
  page: import('playwright').Page,
  url: string
): Promise<ATSDetectionResult> {
  // First try URL-based detection
  const urlResult = detectATSFromUrl(url);
  if (urlResult.system !== 'unknown') {
    return urlResult;
  }

  // DOM signature checks
  const domSignatures: Array<{
    system: ATSSystem;
    check: () => Promise<boolean>;
    confidence: number;
  }> = [
    {
      system: 'workday',
      check: async () => {
        const hasWorkday = await page
          .locator('[data-automation-id="workday"]')
          .count();
        const hasWdFooter = await page
          .locator('text=Powered by Workday')
          .count();
        return hasWorkday > 0 || hasWdFooter > 0;
      },
      confidence: 0.85,
    },
    {
      system: 'greenhouse',
      check: async () => {
        const hasGhForm = await page.locator('#application_form').count();
        const hasGhFooter = await page
          .locator('text=Powered by Greenhouse')
          .count();
        return hasGhForm > 0 || hasGhFooter > 0;
      },
      confidence: 0.85,
    },
    {
      system: 'lever',
      check: async () => {
        const hasLeverForm = await page
          .locator('.lever-application-form')
          .count();
        const hasLeverFooter = await page
          .locator('text=Powered by Lever')
          .count();
        return hasLeverForm > 0 || hasLeverFooter > 0;
      },
      confidence: 0.85,
    },
    {
      system: 'icims',
      check: async () => {
        const hasIcims = await page.locator('.iCIMS_MainWrapper').count();
        return hasIcims > 0;
      },
      confidence: 0.80,
    },
    {
      system: 'smartrecruiters',
      check: async () => {
        const hasSR = await page
          .locator('[data-test="header-smartrecruiters"]')
          .count();
        const hasSRFooter = await page
          .locator('text=Powered by SmartRecruiters')
          .count();
        return hasSR > 0 || hasSRFooter > 0;
      },
      confidence: 0.80,
    },
    {
      system: 'ashby',
      check: async () => {
        const hasAshby = await page
          .locator('[data-testid="ashby-job-posting"]')
          .count();
        const hasAshbyFooter = await page
          .locator('text=Powered by Ashby')
          .count();
        return hasAshby > 0 || hasAshbyFooter > 0;
      },
      confidence: 0.80,
    },
  ];

  for (const sig of domSignatures) {
    try {
      const matched = await sig.check();
      if (matched) {
        return {
          system: sig.system,
          confidence: sig.confidence,
          applyUrl: url,
        };
      }
    } catch {
      // Element not found or page navigation issue; continue checking
    }
  }

  return {
    system: 'unknown',
    confidence: 0,
    applyUrl: url,
  };
}
