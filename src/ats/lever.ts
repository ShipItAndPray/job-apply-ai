/**
 * Lever ATS Form Handler
 *
 * Lever uses a single-page form similar to Greenhouse but with some differences:
 * - Uses a single "fullName" field instead of separate first/last name
 * - Resume upload uses a custom file upload widget
 * - Custom questions are rendered as additional card sections
 *
 * Selectors sourced from config/ats-selectors.json "lever" entry.
 */

import { Page } from 'playwright';
import { BaseATSHandler, ApplicationProfile } from './base-handler.js';

// Lever CSS selectors (from ats-selectors.json)
const SELECTORS = {
  fullName: "input[name='name']",
  email: "input[name='email']",
  phone: "input[name='phone']",
  resume: "input[type='file'].resume-upload",
  resumeFallback: "input[type='file']",
  linkedIn: "input[name*='linkedin' i]",
  website: "input[name*='website' i]",
  currentCompany: "input[name*='company' i]",
  submitButton: "button[type='submit']",
} as const;

export class LeverHandler extends BaseATSHandler {
  constructor(page: Page, profile: ApplicationProfile) {
    super(page, profile);
  }

  /**
   * Fill personal info. Lever uses a combined full name field.
   */
  async fillPersonalInfo(): Promise<void> {
    this.log('Filling personal information...');

    const { personal, experience } = this.profile;
    const fullName = `${personal.firstName} ${personal.lastName}`;

    const results = {
      fullName: await this.safeFill(SELECTORS.fullName, fullName),
      email: await this.safeFill(SELECTORS.email, personal.email),
      phone: await this.safeFill(SELECTORS.phone, personal.phone),
      linkedIn: await this.safeFill(SELECTORS.linkedIn, personal.linkedIn),
      website: personal.website
        ? await this.safeFill(SELECTORS.website, personal.website)
        : false,
      currentCompany: await this.safeFill(
        SELECTORS.currentCompany,
        experience.currentCompany
      ),
    };

    for (const [field, success] of Object.entries(results)) {
      if (!success && field !== 'website') {
        this.log(`Warning: Could not fill "${field}" field`);
      }
    }

    // Try location field if present
    if (personal.location.city) {
      await this.safeFill(
        "input[name*='location' i]",
        `${personal.location.city}, ${personal.location.state}`
      );
    }

    this.log('Personal information filled.');
  }

  /**
   * Upload resume. Lever sometimes uses a custom upload widget.
   */
  async uploadResume(resumePath: string): Promise<void> {
    this.log(`Uploading resume: ${resumePath}`);

    let uploaded = await this.safeUpload(SELECTORS.resume, resumePath);

    if (!uploaded) {
      this.log('Primary resume selector not found, trying fallback...');
      uploaded = await this.safeUpload(SELECTORS.resumeFallback, resumePath);
    }

    if (!uploaded) {
      // Some Lever forms use a drag-and-drop area with a hidden file input
      this.log('Trying hidden file input fallback...');
      try {
        const fileInput = this.page.locator("input[type='file']").first();
        if ((await fileInput.count()) > 0) {
          await fileInput.setInputFiles(resumePath, { timeout: 10000 });
          uploaded = true;
        }
      } catch {
        // Ignore
      }
    }

    if (!uploaded) {
      this.log('Error: Could not find a file upload input for resume');
    }

    await this.page.waitForTimeout(1500);
    this.log('Resume upload complete.');
  }

  /**
   * Lever does not typically have a separate cover letter upload field.
   * Some postings have a "cover letter" textarea instead. We attempt both.
   */
  async uploadCoverLetter(coverLetterPath: string): Promise<void> {
    this.log('Lever: Checking for cover letter field...');

    // Try a file upload first (rare on Lever)
    const uploaded = await this.safeUpload(
      "input[type='file'][name*='cover' i]",
      coverLetterPath
    );

    if (uploaded) {
      this.log('Cover letter uploaded via file input.');
      return;
    }

    // Try a textarea (more common on Lever)
    // We would need to read the cover letter file content for this
    this.log('No cover letter file input found on Lever form.');
  }

  /**
   * Scan Lever custom questions (additional info cards).
   *
   * Lever renders custom questions in card sections below the main fields.
   * Questions can be text inputs, selects, textareas, or checkboxes.
   */
  async fillCustomQuestions(): Promise<void> {
    this.log('Scanning for custom questions...');

    // --- Work authorization ---
    await this.handleAuthorizationQuestions();

    // --- Sponsorship ---
    await this.handleSponsorshipQuestions();

    // --- Years of experience ---
    await this.handleExperienceQuestions();

    // --- Salary expectations ---
    await this.handleSalaryQuestions();

    // --- How did you hear about us ---
    await this.handleSourceQuestions();

    // --- Demographic / EEO questions ---
    await this.handleDemographicQuestions();

    await this.takeScreenshot('lever-custom-questions');
    this.log('Custom questions scan complete.');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async handleAuthorizationQuestions(): Promise<void> {
    const { authorization } = this.profile;
    const yesNo = authorization.authorizedToWork ? 'Yes' : 'No';

    // Try select dropdowns
    const selectSelectors = [
      "select[name*='authorized' i]",
      "select[name*='authorization' i]",
      "select[name*='legally' i]",
    ];
    for (const sel of selectSelectors) {
      if (await this.safeSelect(sel, yesNo)) {
        this.log(`Filled authorization (select): ${yesNo}`);
        return;
      }
    }

    // Try text inputs
    const inputSelectors = [
      "input[name*='authorized' i]",
      "input[name*='authorization' i]",
    ];
    for (const sel of inputSelectors) {
      if (await this.safeFill(sel, yesNo)) {
        this.log(`Filled authorization (input): ${yesNo}`);
        return;
      }
    }
  }

  private async handleSponsorshipQuestions(): Promise<void> {
    const { authorization } = this.profile;
    const yesNo = authorization.requiresSponsorship ? 'Yes' : 'No';

    const selectors = [
      "select[name*='sponsor' i]",
      "input[name*='sponsor' i]",
    ];
    for (const sel of selectors) {
      const filled =
        (await this.safeSelect(sel, yesNo)) ||
        (await this.safeFill(sel, yesNo));
      if (filled) {
        this.log(`Filled sponsorship: ${yesNo}`);
        return;
      }
    }
  }

  private async handleExperienceQuestions(): Promise<void> {
    const { experience } = this.profile;
    const years = String(experience.totalYears);

    const selectors = [
      "input[name*='years' i]",
      "input[name*='experience' i]",
      "select[name*='years' i]",
      "select[name*='experience' i]",
    ];

    for (const sel of selectors) {
      const filled =
        (await this.safeFill(sel, years)) ||
        (await this.safeSelect(sel, years));
      if (filled) {
        this.log(`Filled years of experience: ${years}`);
        return;
      }
    }
  }

  private async handleSalaryQuestions(): Promise<void> {
    const { experience } = this.profile;

    const selectors = [
      "input[name*='salary' i]",
      "input[name*='compensation' i]",
    ];

    for (const sel of selectors) {
      if (await this.safeFill(sel, String(experience.desiredSalary.min))) {
        this.log(`Filled salary: ${experience.desiredSalary.min}`);
        return;
      }
    }
  }

  private async handleSourceQuestions(): Promise<void> {
    // "How did you hear about us" -- common on Lever
    const selectors = [
      "select[name*='hear' i]",
      "select[name*='source' i]",
      "input[name*='hear' i]",
    ];

    for (const sel of selectors) {
      const filled =
        (await this.safeSelect(sel, 'LinkedIn')) ||
        (await this.safeFill(sel, 'LinkedIn'));
      if (filled) {
        this.log('Filled referral source: LinkedIn');
        return;
      }
    }
  }

  private async handleDemographicQuestions(): Promise<void> {
    const { demographics } = this.profile;

    if (demographics.veteranStatus) {
      await this.safeSelect(
        "select[name*='veteran' i]",
        demographics.veteranStatus
      );
    }

    if (demographics.disabilityStatus) {
      await this.safeSelect(
        "select[name*='disability' i]",
        demographics.disabilityStatus
      );
    }

    if (demographics.gender) {
      await this.safeSelect(
        "select[name*='gender' i]",
        demographics.gender
      );
    }
  }
}
