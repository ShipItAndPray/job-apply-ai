/**
 * Greenhouse ATS Form Handler
 *
 * Greenhouse uses a single-page application form, making it the simplest
 * ATS to automate. All fields are on one page with a single submit button.
 *
 * Selectors sourced from config/ats-selectors.json "greenhouse" entry.
 */

import { Page } from 'playwright';
import { BaseATSHandler, ApplicationProfile } from './base-handler.js';

// Greenhouse CSS selectors (from ats-selectors.json)
const SELECTORS = {
  firstName: '#first_name',
  lastName: '#last_name',
  email: '#email',
  phone: '#phone',
  resume: "input[type='file']#resume",
  coverLetter: "input[type='file']#cover_letter",
  linkedIn: "input[name*='linkedin' i]",
  submitButton: '#submit_app',
} as const;

export class GreenhouseHandler extends BaseATSHandler {
  constructor(page: Page, profile: ApplicationProfile) {
    super(page, profile);
  }

  /**
   * Fill personal info fields: first name, last name, email, phone, LinkedIn.
   */
  async fillPersonalInfo(): Promise<void> {
    this.log('Filling personal information...');

    const { personal } = this.profile;

    const results = {
      firstName: await this.safeFill(SELECTORS.firstName, personal.firstName),
      lastName: await this.safeFill(SELECTORS.lastName, personal.lastName),
      email: await this.safeFill(SELECTORS.email, personal.email),
      phone: await this.safeFill(SELECTORS.phone, personal.phone),
      linkedIn: await this.safeFill(SELECTORS.linkedIn, personal.linkedIn),
    };

    // Log which fields succeeded
    for (const [field, success] of Object.entries(results)) {
      if (!success) {
        this.log(`Warning: Could not fill "${field}" field`);
      }
    }

    // Try filling location if a location/city field exists
    if (personal.location.city) {
      await this.safeFill(
        "input[name*='location' i], input[name*='city' i]",
        `${personal.location.city}, ${personal.location.state}`
      );
    }

    this.log('Personal information filled.');
  }

  /**
   * Upload resume via the file input.
   */
  async uploadResume(resumePath: string): Promise<void> {
    this.log(`Uploading resume: ${resumePath}`);

    const uploaded = await this.safeUpload(SELECTORS.resume, resumePath);
    if (!uploaded) {
      // Fallback: try any file input on the page
      this.log('Primary resume selector not found, trying fallback...');
      const fallback = await this.safeUpload(
        "input[type='file']",
        resumePath
      );
      if (!fallback) {
        this.log('Error: Could not find a file upload input for resume');
      }
    }

    // Wait briefly for upload confirmation
    await this.page.waitForTimeout(1500);
    this.log('Resume upload complete.');
  }

  /**
   * Upload cover letter via the dedicated cover letter file input.
   */
  async uploadCoverLetter(coverLetterPath: string): Promise<void> {
    this.log(`Uploading cover letter: ${coverLetterPath}`);

    const uploaded = await this.safeUpload(
      SELECTORS.coverLetter,
      coverLetterPath
    );
    if (!uploaded) {
      this.log('Cover letter upload field not found (may not be required).');
      return;
    }

    await this.page.waitForTimeout(1000);
    this.log('Cover letter upload complete.');
  }

  /**
   * Scan for custom/additional questions and attempt to auto-fill them.
   *
   * Greenhouse custom questions typically appear as:
   * - Text inputs with descriptive labels
   * - Select dropdowns (work authorization, sponsorship, etc.)
   * - Textareas for free-form answers
   */
  async fillCustomQuestions(): Promise<void> {
    this.log('Scanning for custom questions...');

    // --- Work authorization questions ---
    await this.handleAuthorizationQuestions();

    // --- Salary / compensation questions ---
    await this.handleSalaryQuestions();

    // --- Years of experience ---
    await this.handleExperienceQuestions();

    // --- Gender / demographic questions ---
    await this.handleDemographicQuestions();

    // Take a screenshot after filling custom questions for review
    await this.takeScreenshot('greenhouse-custom-questions');

    this.log('Custom questions scan complete.');
  }

  // ---------------------------------------------------------------------------
  // Private helpers for custom question categories
  // ---------------------------------------------------------------------------

  private async handleAuthorizationQuestions(): Promise<void> {
    const { authorization } = this.profile;

    // Common authorization field patterns
    const authSelectors = [
      "select[name*='authorized' i]",
      "select[id*='authorized' i]",
      "select[name*='authorization' i]",
    ];

    for (const sel of authSelectors) {
      const yesNo = authorization.authorizedToWork ? 'Yes' : 'No';
      if (await this.safeSelect(sel, yesNo)) {
        this.log(`Filled authorization question: ${yesNo}`);
        break;
      }
    }

    // Sponsorship question
    const sponsorSelectors = [
      "select[name*='sponsor' i]",
      "select[id*='sponsor' i]",
    ];

    for (const sel of sponsorSelectors) {
      const yesNo = authorization.requiresSponsorship ? 'Yes' : 'No';
      if (await this.safeSelect(sel, yesNo)) {
        this.log(`Filled sponsorship question: ${yesNo}`);
        break;
      }
    }

    // Also try radio buttons / text inputs for these questions
    const authInputs = [
      "input[name*='authorized' i]",
      "input[name*='authorization' i]",
    ];
    for (const sel of authInputs) {
      const val = authorization.authorizedToWork ? 'Yes' : 'No';
      await this.safeFill(sel, val);
    }
  }

  private async handleSalaryQuestions(): Promise<void> {
    const { experience } = this.profile;

    const salarySelectors = [
      "input[name*='salary' i]",
      "input[name*='compensation' i]",
      "input[id*='salary' i]",
    ];

    for (const sel of salarySelectors) {
      if (await this.safeFill(sel, String(experience.desiredSalary.min))) {
        this.log(`Filled salary expectation: ${experience.desiredSalary.min}`);
        break;
      }
    }
  }

  private async handleExperienceQuestions(): Promise<void> {
    const { experience } = this.profile;

    const expSelectors = [
      "input[name*='years' i][name*='experience' i]",
      "input[name*='experience' i]",
      "select[name*='years' i]",
    ];

    for (const sel of expSelectors) {
      const filled =
        (await this.safeFill(sel, String(experience.totalYears))) ||
        (await this.safeSelect(sel, String(experience.totalYears)));
      if (filled) {
        this.log(`Filled years of experience: ${experience.totalYears}`);
        break;
      }
    }
  }

  private async handleDemographicQuestions(): Promise<void> {
    const { demographics } = this.profile;

    // Veteran status
    if (demographics.veteranStatus) {
      await this.safeSelect(
        "select[name*='veteran' i]",
        demographics.veteranStatus
      );
    }

    // Disability
    if (demographics.disabilityStatus) {
      await this.safeSelect(
        "select[name*='disability' i]",
        demographics.disabilityStatus
      );
    }

    // Gender
    if (demographics.gender) {
      await this.safeSelect(
        "select[name*='gender' i]",
        demographics.gender
      );
    }
  }
}
