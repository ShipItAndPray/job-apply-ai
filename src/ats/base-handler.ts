/**
 * Base ATS Form Handler
 *
 * Abstract base class providing common helpers for all ATS-specific handlers.
 * Each concrete handler implements the abstract methods for its ATS system.
 */

import { Page } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface ApplicationProfile {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedIn: string;
    github: string;
    website: string;
    location: {
      city: string;
      state: string;
      zip: string;
      country: string;
      willingToRelocate: boolean;
    };
  };
  authorization: {
    authorizedToWork: boolean;
    requiresSponsorship: boolean;
    visaStatus: string;
  };
  demographics: {
    veteranStatus: string;
    disabilityStatus: string;
    gender: string;
    race: string;
  };
  education: Array<{
    degree: string;
    field: string;
    school: string;
    location: string;
    graduationYear: number;
  }>;
  experience: {
    totalYears: number;
    currentTitle: string;
    currentCompany: string;
    desiredTitles: string[];
    desiredSalary: { min: number; max: number; currency: string };
    noticePeriod: string;
    primarySkills: string[];
    secondarySkills: string[];
  };
  workHistory: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    location: string;
  }>;
  documents: {
    resumeBasePath: string;
    resumeFormats: string[];
    coverLetterBase: string;
  };
  preferences: {
    jobTypes: string[];
    workModes: string[];
    industries: string[];
    excludeCompanies: string[];
    locations: string[];
  };
}

const SCREENSHOT_DIR = join(
  process.cwd(),
  'data',
  'screenshots'
);

export abstract class BaseATSHandler {
  protected constructor(
    protected page: Page,
    protected profile: ApplicationProfile
  ) {}

  /** Fill personal information fields (name, email, phone, etc.) */
  abstract fillPersonalInfo(): Promise<void>;

  /** Upload the resume file */
  abstract uploadResume(resumePath: string): Promise<void>;

  /** Upload a cover letter (optional -- not all ATS systems support this) */
  async uploadCoverLetter(_coverLetterPath: string): Promise<void> {
    // Default no-op; override in handlers that support cover letters
  }

  /** Fill any custom/additional questions on the form */
  abstract fillCustomQuestions(): Promise<void>;

  // ---------------------------------------------------------------------------
  // Common helper methods
  // ---------------------------------------------------------------------------

  /**
   * Try to fill an input field. Returns false if the element is not found.
   */
  protected async safeFill(
    selector: string,
    value: string
  ): Promise<boolean> {
    try {
      const el = this.page.locator(selector).first();
      if ((await el.count()) === 0) return false;
      await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await el.click({ timeout: 3000 });
      await el.fill(value, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to click an element. Returns false if the element is not found.
   */
  protected async safeClick(selector: string): Promise<boolean> {
    try {
      const el = this.page.locator(selector).first();
      if ((await el.count()) === 0) return false;
      await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await el.click({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to select a dropdown option. Returns false if the element is not found.
   */
  protected async safeSelect(
    selector: string,
    value: string
  ): Promise<boolean> {
    try {
      const el = this.page.locator(selector).first();
      if ((await el.count()) === 0) return false;
      await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await el.selectOption(value, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to upload a file via a file input. Returns false if the element is not found.
   */
  protected async safeUpload(
    selector: string,
    filePath: string
  ): Promise<boolean> {
    try {
      const el = this.page.locator(selector).first();
      if ((await el.count()) === 0) return false;
      await el.setInputFiles(filePath, { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for an element to appear, then fill it. Useful for dynamically loaded forms.
   */
  protected async waitAndFill(
    selector: string,
    value: string,
    timeout: number = 10000
  ): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout,
      });
      return await this.safeFill(selector, value);
    } catch {
      return false;
    }
  }

  /**
   * Take a screenshot and save it to data/screenshots/. Returns the file path.
   */
  protected async takeScreenshot(name: string): Promise<string> {
    if (!existsSync(SCREENSHOT_DIR)) {
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = join(SCREENSHOT_DIR, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  /**
   * Clear an input field before filling it. Useful when fields have pre-populated values.
   */
  protected async clearAndFill(
    selector: string,
    value: string
  ): Promise<boolean> {
    try {
      const el = this.page.locator(selector).first();
      if ((await el.count()) === 0) return false;
      await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await el.click({ timeout: 3000 });
      await el.fill('', { timeout: 3000 });
      await el.fill(value, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Log a message with the handler name prefix for debugging.
   */
  protected log(message: string): void {
    const handlerName = this.constructor.name;
    console.log(`[${handlerName}] ${message}`);
  }
}
