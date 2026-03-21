/**
 * Generic ATS Form Handler (Fallback)
 *
 * Used when the ATS system is unrecognized. Scans all visible form fields
 * and matches labels/placeholders/names to profile data using keyword matching.
 *
 * This is a best-effort handler -- it will not catch every field but covers
 * the most common patterns across ATS systems.
 */

import { Page } from 'playwright';
import { BaseATSHandler, ApplicationProfile } from './base-handler.js';

/**
 * Mapping from keyword patterns (tested against label text, placeholder, name,
 * and id attributes) to a function that returns the value from the profile.
 */
type FieldMatcher = {
  patterns: RegExp[];
  getValue: (profile: ApplicationProfile) => string;
};

const FIELD_MATCHERS: FieldMatcher[] = [
  {
    patterns: [/first[\s_-]?name/i],
    getValue: (p) => p.personal.firstName,
  },
  {
    patterns: [/last[\s_-]?name/i, /surname/i, /family[\s_-]?name/i],
    getValue: (p) => p.personal.lastName,
  },
  {
    patterns: [/full[\s_-]?name/i, /^name$/i],
    getValue: (p) => `${p.personal.firstName} ${p.personal.lastName}`,
  },
  {
    patterns: [/e[\s_-]?mail/i],
    getValue: (p) => p.personal.email,
  },
  {
    patterns: [/phone/i, /mobile/i, /telephone/i, /cell/i],
    getValue: (p) => p.personal.phone,
  },
  {
    patterns: [/linkedin/i],
    getValue: (p) => p.personal.linkedIn,
  },
  {
    patterns: [/github/i],
    getValue: (p) => p.personal.github,
  },
  {
    patterns: [/website/i, /portfolio/i, /personal[\s_-]?url/i],
    getValue: (p) => p.personal.website,
  },
  {
    patterns: [/city/i],
    getValue: (p) => p.personal.location.city,
  },
  {
    patterns: [/state/i, /province/i],
    getValue: (p) => p.personal.location.state,
  },
  {
    patterns: [/zip/i, /postal/i],
    getValue: (p) => p.personal.location.zip,
  },
  {
    patterns: [/country/i],
    getValue: (p) => p.personal.location.country,
  },
  {
    patterns: [/current[\s_-]?title/i, /job[\s_-]?title/i, /position/i],
    getValue: (p) => p.experience.currentTitle,
  },
  {
    patterns: [/current[\s_-]?company/i, /current[\s_-]?employer/i, /company/i],
    getValue: (p) => p.experience.currentCompany,
  },
  {
    patterns: [/years[\s_-]?(?:of[\s_-]?)?experience/i, /total[\s_-]?experience/i],
    getValue: (p) => String(p.experience.totalYears),
  },
  {
    patterns: [/salary/i, /compensation/i, /desired[\s_-]?pay/i],
    getValue: (p) => String(p.experience.desiredSalary.min),
  },
  {
    patterns: [/school/i, /university/i, /college/i, /institution/i],
    getValue: (p) => p.education[0]?.school ?? '',
  },
  {
    patterns: [/degree/i],
    getValue: (p) => p.education[0]?.degree ?? '',
  },
  {
    patterns: [/field[\s_-]?of[\s_-]?study/i, /major/i],
    getValue: (p) => p.education[0]?.field ?? '',
  },
  {
    patterns: [/graduat/i, /grad[\s_-]?year/i],
    getValue: (p) => String(p.education[0]?.graduationYear ?? ''),
  },
  {
    patterns: [/notice[\s_-]?period/i, /start[\s_-]?date/i, /availability/i],
    getValue: (p) => p.experience.noticePeriod,
  },
];

/**
 * Mapping for select (dropdown) fields with yes/no type answers.
 */
type SelectMatcher = {
  patterns: RegExp[];
  getValue: (profile: ApplicationProfile) => string;
};

const SELECT_MATCHERS: SelectMatcher[] = [
  {
    patterns: [/authorized/i, /authorization/i, /legally/i, /eligible/i],
    getValue: (p) => (p.authorization.authorizedToWork ? 'Yes' : 'No'),
  },
  {
    patterns: [/sponsor/i, /visa/i],
    getValue: (p) => (p.authorization.requiresSponsorship ? 'Yes' : 'No'),
  },
  {
    patterns: [/relocat/i],
    getValue: (p) => (p.personal.location.willingToRelocate ? 'Yes' : 'No'),
  },
  {
    patterns: [/veteran/i],
    getValue: (p) => p.demographics.veteranStatus,
  },
  {
    patterns: [/disability/i, /handicap/i],
    getValue: (p) => p.demographics.disabilityStatus,
  },
  {
    patterns: [/gender/i, /sex/i],
    getValue: (p) => p.demographics.gender,
  },
  {
    patterns: [/race/i, /ethnicity/i],
    getValue: (p) => p.demographics.race,
  },
];

export class GenericHandler extends BaseATSHandler {
  constructor(page: Page, profile: ApplicationProfile) {
    super(page, profile);
  }

  /**
   * Scan all visible input fields and attempt to match them to profile data
   * by inspecting their label text, placeholder, name, and id attributes.
   */
  async fillPersonalInfo(): Promise<void> {
    this.log('Scanning form fields for personal info...');

    // Gather all visible text-like inputs on the page
    const inputs = this.page.locator(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], input:not([type])'
    );
    const count = await inputs.count();
    this.log(`Found ${count} text-like inputs on the page.`);

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);

      try {
        // Skip hidden or already-filled inputs
        if (!(await input.isVisible())) continue;
        const currentVal = await input.inputValue().catch(() => '');
        if (currentVal.trim().length > 0) continue;

        const descriptor = await this.getFieldDescriptor(input);
        if (!descriptor) continue;

        // Try to match against our field matchers
        for (const matcher of FIELD_MATCHERS) {
          const matchesPattern = matcher.patterns.some((p) =>
            p.test(descriptor)
          );
          if (matchesPattern) {
            const value = matcher.getValue(this.profile);
            if (value) {
              await input.fill(value, { timeout: 3000 }).catch(() => {});
              this.log(`Filled "${descriptor}" with value.`);
            }
            break;
          }
        }
      } catch {
        // Skip fields that cause errors
      }
    }

    // Also handle select (dropdown) fields
    await this.fillSelectFields();

    this.log('Personal info scan complete.');
  }

  /**
   * Upload resume by finding the first file input on the page.
   */
  async uploadResume(resumePath: string): Promise<void> {
    this.log(`Uploading resume: ${resumePath}`);

    // Try common resume-specific selectors first
    const resumeSelectors = [
      "input[type='file']#resume",
      "input[type='file'][name*='resume' i]",
      "input[type='file'][accept*='pdf']",
      "input[type='file']",
    ];

    for (const sel of resumeSelectors) {
      if (await this.safeUpload(sel, resumePath)) {
        this.log('Resume uploaded successfully.');
        await this.page.waitForTimeout(1500);
        return;
      }
    }

    this.log('Error: Could not find any file upload input for resume.');
  }

  /**
   * Upload cover letter by finding a secondary file input or one labeled
   * for cover letters.
   */
  async uploadCoverLetter(coverLetterPath: string): Promise<void> {
    this.log(`Uploading cover letter: ${coverLetterPath}`);

    const coverSelectors = [
      "input[type='file']#cover_letter",
      "input[type='file'][name*='cover' i]",
    ];

    for (const sel of coverSelectors) {
      if (await this.safeUpload(sel, coverLetterPath)) {
        this.log('Cover letter uploaded successfully.');
        await this.page.waitForTimeout(1000);
        return;
      }
    }

    // If there are multiple file inputs, the second one is often cover letter
    const fileInputs = this.page.locator("input[type='file']");
    const fileCount = await fileInputs.count();
    if (fileCount >= 2) {
      try {
        await fileInputs.nth(1).setInputFiles(coverLetterPath, { timeout: 5000 });
        this.log('Cover letter uploaded via second file input.');
        return;
      } catch {
        // Ignore
      }
    }

    this.log('No cover letter upload field found.');
  }

  /**
   * Best-effort fill of remaining custom question fields.
   * Re-scans all fields including textareas and any that were not matched
   * during fillPersonalInfo.
   */
  async fillCustomQuestions(): Promise<void> {
    this.log('Scanning for custom questions...');

    // Handle textareas (cover letter text, "why this role", etc.)
    await this.handleTextareas();

    // Handle any checkboxes (terms, acknowledgements)
    await this.handleCheckboxes();

    // Re-run select field matching in case new fields appeared
    await this.fillSelectFields();

    await this.takeScreenshot('generic-custom-questions');
    this.log('Custom questions scan complete.');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Get a combined text descriptor for a field by checking its associated
   * label, placeholder, name, id, and aria-label attributes.
   */
  private async getFieldDescriptor(
    element: import('playwright').Locator
  ): Promise<string | null> {
    try {
      const parts: string[] = [];

      const placeholder = await element.getAttribute('placeholder');
      if (placeholder) parts.push(placeholder);

      const name = await element.getAttribute('name');
      if (name) parts.push(name);

      const id = await element.getAttribute('id');
      if (id) parts.push(id);

      const ariaLabel = await element.getAttribute('aria-label');
      if (ariaLabel) parts.push(ariaLabel);

      // Try to find an associated label via the "id" -> label[for] relationship
      if (id) {
        const labelText = await this.page
          .locator(`label[for="${id}"]`)
          .first()
          .textContent()
          .catch(() => null);
        if (labelText) parts.push(labelText);
      }

      if (parts.length === 0) return null;
      return parts.join(' ');
    } catch {
      return null;
    }
  }

  /**
   * Fill select/dropdown fields using keyword matching on their labels.
   */
  private async fillSelectFields(): Promise<void> {
    const selects = this.page.locator('select');
    const count = await selects.count();

    for (let i = 0; i < count; i++) {
      const select = selects.nth(i);
      try {
        if (!(await select.isVisible())) continue;

        // Build a descriptor for the select
        const id = await select.getAttribute('id');
        const name = await select.getAttribute('name');
        const ariaLabel = await select.getAttribute('aria-label');
        let labelText = '';
        if (id) {
          labelText =
            (await this.page
              .locator(`label[for="${id}"]`)
              .first()
              .textContent()
              .catch(() => '')) ?? '';
        }
        const descriptor = [id, name, ariaLabel, labelText]
          .filter(Boolean)
          .join(' ');

        if (!descriptor) continue;

        for (const matcher of SELECT_MATCHERS) {
          const matchesPattern = matcher.patterns.some((p) =>
            p.test(descriptor)
          );
          if (matchesPattern) {
            const value = matcher.getValue(this.profile);
            if (value) {
              try {
                await select.selectOption(value, { timeout: 3000 });
                this.log(`Selected "${value}" for "${descriptor}"`);
              } catch {
                // Try selecting by label text if value match fails
                await select
                  .selectOption({ label: value }, { timeout: 3000 })
                  .catch(() => {});
              }
            }
            break;
          }
        }
      } catch {
        // Skip problematic selects
      }
    }
  }

  /**
   * Handle textareas -- typically "additional info" or "cover letter" fields.
   */
  private async handleTextareas(): Promise<void> {
    const textareas = this.page.locator('textarea');
    const count = await textareas.count();

    for (let i = 0; i < count; i++) {
      const textarea = textareas.nth(i);
      try {
        if (!(await textarea.isVisible())) continue;
        const currentVal = await textarea.inputValue().catch(() => '');
        if (currentVal.trim().length > 0) continue;

        // We leave textareas empty for manual review. Filling them with
        // generic text would likely hurt more than help. Log them instead.
        const id = await textarea.getAttribute('id');
        const name = await textarea.getAttribute('name');
        this.log(
          `Found empty textarea (id=${id}, name=${name}) -- skipping (needs manual input).`
        );
      } catch {
        // Skip
      }
    }
  }

  /**
   * Handle checkboxes -- check required terms/acknowledgement boxes.
   */
  private async handleCheckboxes(): Promise<void> {
    const checkboxes = this.page.locator("input[type='checkbox']");
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      try {
        if (!(await checkbox.isVisible())) continue;
        if (await checkbox.isChecked()) continue;

        // Check if it looks like a required terms/acknowledgement checkbox
        const id = await checkbox.getAttribute('id');
        const name = await checkbox.getAttribute('name');
        const descriptor = [id, name].filter(Boolean).join(' ');

        // Only auto-check terms/acknowledgement boxes
        if (
          /terms|acknowledge|agree|consent|confirm/i.test(descriptor)
        ) {
          await checkbox.check({ timeout: 3000 });
          this.log(`Checked checkbox: ${descriptor}`);
        }

        // Also check via label text
        if (id) {
          const labelText = await this.page
            .locator(`label[for="${id}"]`)
            .first()
            .textContent()
            .catch(() => '');
          if (
            labelText &&
            /terms|acknowledge|agree|consent|confirm/i.test(labelText)
          ) {
            await checkbox.check({ timeout: 3000 }).catch(() => {});
            this.log(`Checked checkbox (by label): ${labelText.trim()}`);
          }
        }
      } catch {
        // Skip
      }
    }
  }
}
