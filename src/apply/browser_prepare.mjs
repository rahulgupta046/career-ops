import { chromium } from 'playwright';
import { consumeReviewToken, recordSubmission, savePreparation } from '../workbench.mjs';

const preparedSessions = new Map();
const DEFAULT_SAFE_AUTOFILL_FIELDS = new Set([
  'first_name',
  'last_name',
  'name',
  'email',
  'phone',
  'linkedin',
  'github',
  'website',
  'country',
  'city',
  'location',
]);

function cssString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function profileValue(profile, key, fallback = '') {
  if ((profile.unverified_fields || []).includes(key)) return '';
  return profile[key] || fallback;
}

function safeFields(options = {}) {
  return new Set(options.safeAutofillFields || options.safe_autofill_fields || [...DEFAULT_SAFE_AUTOFILL_FIELDS]);
}

function fieldDecisionFor(label, profile, options = {}) {
  const key = String(label || '').toLowerCase();
  const answers = profile.application_answers || {};
  const allowed = safeFields(options);
  let field = '';
  let value = '';

  if (/first/.test(key)) [field, value] = ['first_name', profileValue(profile, 'first_name')];
  else if (/last/.test(key)) [field, value] = ['last_name', profileValue(profile, 'last_name')];
  else if (/full.*name|name/.test(key)) [field, value] = ['name', profileValue(profile, 'name', [profile.first_name, profile.last_name].filter(Boolean).join(' '))];
  else if (/e-?mail/.test(key)) [field, value] = ['email', profileValue(profile, 'email')];
  else if (/phone|mobile/.test(key)) [field, value] = ['phone', profileValue(profile, 'phone')];
  else if (/linkedin/.test(key)) [field, value] = ['linkedin', profileValue(profile, 'linkedin')];
  else if (/github/.test(key)) [field, value] = ['github', profileValue(profile, 'github')];
  else if (/website|portfolio/.test(key)) [field, value] = ['website', profileValue(profile, 'website')];
  else if (/country/.test(key)) [field, value] = ['country', profileValue(profile, 'country')];
  else if (/city/.test(key)) [field, value] = ['city', profileValue(profile, 'city', profileValue(profile, 'location'))];
  else if (/location/.test(key)) [field, value] = ['location', profileValue(profile, 'location')];
  else if (/why.*(join|work|company|figma)|why.*role|interested/.test(key)) [field, value] = ['why_company', answers.why_company || ''];
  else if (/intend.*work|work.*location|from where/.test(key)) [field, value] = ['intended_work_location', answers.intended_work_location || profileValue(profile, 'location')];
  else if (/authorized|authorised|work authorization|work authorisation/.test(key)) [field, value] = ['work_authorized', profileValue(profile, 'work_authorized')];
  else if (/sponsor|sponsorship|visa/.test(key)) [field, value] = ['needs_sponsorship', profile.needs_sponsorship ? 'Yes' : 'No'];
  else if (/ever worked|worked for.*before|previously worked|employee or a contractor/.test(key)) [field, value] = ['previously_worked_at_company', profile.previously_worked_at_company || 'No'];
  else if (/years.*experience|professional experience/.test(key)) [field, value] = ['years_experience', profile.years_experience || ''];

  if (!field || !value) return { value: '', field, safe: false };
  return { value, field, safe: allowed.has(field) };
}

function fieldValueFor(label, profile, options = {}) {
  const decision = fieldDecisionFor(label, profile, options);
  return decision.safe ? decision.value : '';
}

async function fieldMeta(handle) {
  return handle.evaluate((el) => {
    const id = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '';
    const parentLabel = el.closest('label')?.textContent || '';
    const fieldset = el.closest('fieldset')?.innerText || '';
    const describedBy = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .map(idValue => document.getElementById(idValue)?.textContent || '')
      .join(' ');
    return [
      id,
      parentLabel,
      fieldset,
      describedBy,
      el.getAttribute('name'),
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }, { timeout: 3000 }).catch(() => '');
}

async function fillTextInputs(page, profile, options) {
  const handles = await page.locator('input:not([role="combobox"]):not([type="hidden"]):not([type="file"]):not([type="radio"]):not([type="checkbox"]), textarea').all();
  let filled = 0;

  for (const handle of handles) {
    const meta = await fieldMeta(handle);
    const value = fieldValueFor(meta, profile, options);
    if (!value) continue;
    await handle.fill(value).catch(() => {});
    filled += 1;
  }

  return filled;
}

async function fillById(page, id, value) {
  if (!value) return false;
  const field = page.locator(`#${cssString(id)}`).first();
  if (!(await field.isVisible({ timeout: 1000 }).catch(() => false))) return false;
  await field.fill(String(value)).catch(() => {});
  return true;
}

async function selectCombobox(box, page, value) {
  if (!value) return false;
  await box.click().catch(() => {});
  await box.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
  await box.fill(String(value)).catch(() => {});
  await page.waitForTimeout(500);
  const listboxId = await box.getAttribute('aria-controls').catch(() => '');
  const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const optionScope = listboxId
    ? page.locator(`#${cssString(listboxId)}`)
    : page.locator('body');
  const option = optionScope
    .getByRole('option')
    .filter({ hasText: new RegExp(escapedValue, 'i') })
    .first();
  if (await option.isVisible({ timeout: 1500 }).catch(() => false)) {
    await option.click().catch(() => {});
  } else {
    await box.press('ArrowDown').catch(() => {});
    await box.press('Enter').catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
  await box.press('Tab').catch(() => {});
  await page.waitForTimeout(300);
  return true;
}

async function selectComboboxById(page, id, value) {
  const box = page.locator(`#${cssString(id)}`).first();
  if (!(await box.isVisible({ timeout: 1000 }).catch(() => false))) return false;
  return selectCombobox(box, page, value);
}

async function fillKnownFields(page, profile, options) {
  let filled = 0;
  const fills = [
    ['first_name', profile.first_name],
    ['last_name', profile.last_name],
    ['email', profile.email],
    ['phone', profile.phone],
    ['question_13365383004', profile.linkedin],
    ['question_13365384004', profile.website || profile.github],
    ['question_13365389004', profile.first_name],
  ];

  for (const [id, value] of fills) {
    const meta = id.includes('question_') ? '' : id;
    if (meta && !safeFields(options).has(meta)) continue;
    if (await fillById(page, id, value)) filled += 1;
  }

  const combos = [
    ['country', profileValue(profile, 'country')],
    ['candidate-location', profileValue(profile, 'city', profileValue(profile, 'location'))],
  ];

  for (const [id, value] of combos) {
    if (await selectComboboxById(page, id, value)) filled += 1;
  }

  return filled;
}

async function chooseOptionByValue(page, field, value) {
  const wanted = String(value || '').trim().toLowerCase();
  if (!wanted) return false;

  const options = await field.locator('option').all();
  for (const option of options) {
    const label = await option.textContent().catch(() => '');
    const optionValue = await option.getAttribute('value').catch(() => '');
    if (
      String(label || '').trim().toLowerCase().includes(wanted)
      || String(optionValue || '').trim().toLowerCase().includes(wanted)
    ) {
      await field.selectOption(optionValue || { label: label || '' }).catch(() => {});
      return true;
    }
  }

  return false;
}

async function fillSelects(page, profile, options) {
  const selects = await page.locator('select').all();
  let filled = 0;
  for (const select of selects) {
    const meta = await fieldMeta(select);
    const value = fieldValueFor(meta, profile, options);
    if (!value) continue;
    if (await chooseOptionByValue(page, select, value)) filled += 1;
  }
  return filled;
}

async function fillComboboxes(page, profile, options) {
  const boxes = await page.locator('input[role="combobox"]').all();
  let filled = 0;

  for (const box of boxes) {
    const meta = await fieldMeta(box);
    const value = fieldValueFor(meta, profile, options);
    if (!value) continue;

    if (await selectCombobox(box, page, value)) filled += 1;
  }

  return filled;
}

async function fillRadiosAndCheckboxes(page, profile, options) {
  const fields = await page.locator('input[type="radio"], input[type="checkbox"]').all();
  const handledRadioNames = new Set();
  let filled = 0;

  for (const field of fields) {
    const type = String(await field.getAttribute('type') || '').toLowerCase();
    const name = await field.getAttribute('name') || '';
    const meta = await fieldMeta(field);
    const value = fieldValueFor(meta, profile, options);
    if (!value) continue;

    if (type === 'checkbox') {
      if (/yes|true|agree|authorized|authorised/i.test(value)) {
        await field.check().catch(() => {});
        filled += 1;
      }
      continue;
    }

    if (type === 'radio') {
      if (name && handledRadioNames.has(name)) continue;
      if (name) handledRadioNames.add(name);
      const selector = name
        ? `input[type="radio"][name="${cssString(name)}"]`
        : 'input[type="radio"]';
      const group = await page.locator(selector).all();
      const wanted = String(value).toLowerCase();

      for (const option of group) {
        const optionMeta = await fieldMeta(option);
        const optionValue = String(await option.getAttribute('value') || '').toLowerCase();
        if (optionMeta.toLowerCase().includes(wanted) || optionValue.includes(wanted)) {
          await option.check().catch(() => {});
          filled += 1;
          break;
        }
      }
    }
  }

  return filled;
}

async function openApplicationForm(page) {
  const beforeUrl = page.url();
  const candidates = [
    page.getByRole('link', { name: /apply|apply for this job|start application/i }).first(),
    page.getByRole('button', { name: /apply|apply for this job|start application/i }).first(),
  ];

  for (const candidate of candidates) {
    const visible = await candidate.isVisible({ timeout: 2500 }).catch(() => false);
    if (!visible) continue;
    await candidate.click().catch(() => {});
    await page.waitForTimeout(1500);
    return {
      clicked: true,
      from: beforeUrl,
      to: page.url(),
    };
  }

  return {
    clicked: false,
    from: beforeUrl,
    to: page.url(),
  };
}

async function uploadResume(page, resumePath) {
  if (!resumePath) return 0;
  const inputs = await page.locator('input[type="file"]').all();
  let uploaded = 0;
  for (const input of inputs) {
    await input.setInputFiles(resumePath).then(() => { uploaded += 1; }).catch(() => {});
  }
  return uploaded;
}

async function validateRequiredFields(page) {
  return page.evaluate(() => {
    const isVisible = (el) => {
      if (el.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
    };

    const labelFor = (el) => {
      const id = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '';
      const parentLabel = el.closest('label')?.textContent || '';
      return [
        id,
        parentLabel,
        el.getAttribute('name'),
        el.getAttribute('placeholder'),
        el.getAttribute('aria-label'),
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || el.tagName.toLowerCase();
    };

    const missing = [];
    const fields = Array.from(document.querySelectorAll('input, textarea, select'))
      .filter(isVisible)
      .filter(el => el.required || el.getAttribute('aria-required') === 'true');

    const radioGroups = new Set();

    for (const el of fields) {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || '').toLowerCase();

      if (type === 'hidden' || type === 'button' || type === 'submit') continue;

      if (type === 'radio') {
        const name = el.getAttribute('name') || labelFor(el);
        if (radioGroups.has(name)) continue;
        radioGroups.add(name);
        const group = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`));
        if (!group.some(item => item.checked)) missing.push(labelFor(el));
        continue;
      }

      if (type === 'checkbox' && !el.checked) {
        missing.push(labelFor(el));
        continue;
      }

      if (type === 'file') {
        if (!el.files || el.files.length === 0) missing.push(labelFor(el));
        continue;
      }

      if (tag === 'select') {
        if (!el.value) missing.push(labelFor(el));
        continue;
      }

      if (!String(el.value || '').trim()) missing.push(labelFor(el));
    }

    const pageText = document.body?.innerText?.toLowerCase() || '';
    const blockers = [];
    if (pageText.includes('captcha') || pageText.includes('recaptcha')) blockers.push('captcha');
    if (pageText.includes('sign in') || pageText.includes('log in')) blockers.push('login');

    return {
      ok: missing.length === 0 && blockers.length === 0,
      missing,
      blockers,
    };
  });
}

async function reviewRequiredFields(page, profile, options) {
  const fields = await page.locator('input:not([type="hidden"]):not([type="file"]), textarea, select').all();
  const labels = new Set();

  for (const field of fields) {
    const visible = await field.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) continue;
    const meta = await fieldMeta(field);
    const decision = fieldDecisionFor(meta, profile, options);
    if (decision.value && !decision.safe) labels.add(meta || decision.field);
  }

  return [...labels].slice(0, 25);
}

async function clickSubmitAndVerify(page) {
  const buttons = [
    page.getByRole('button', { name: /submit|send application|apply now|submit application/i }).first(),
    page.locator('input[type="submit"]').first(),
  ];

  for (const button of buttons) {
    const visible = await button.isVisible({ timeout: 2500 }).catch(() => false);
    if (!visible) continue;
    await button.click();
    await page.waitForTimeout(4000);
    const text = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    const url = page.url().toLowerCase();
    const confirmed = [
      'thank you',
      'application submitted',
      'application received',
      "we've received",
      'successfully submitted',
    ].some(signal => text.includes(signal) || url.includes(signal.replace(/\s+/g, '-')));

    return {
      clicked: true,
      confirmed,
      final_url: page.url(),
    };
  }

  return {
    clicked: false,
    confirmed: false,
    final_url: page.url(),
  };
}

async function prepareOne(page, job, profile, resumePath, options = {}) {
  await page.goto(job.job_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const applyEntry = await openApplicationForm(page);
  const knownFields = await fillKnownFields(page, profile, options);
  const textFields = await fillTextInputs(page, profile, options);
  const selectFields = await fillSelects(page, profile, options);
  const comboFields = await fillComboboxes(page, profile, options);
  const choiceFields = await fillRadiosAndCheckboxes(page, profile, options);
  const fileFields = await uploadResume(page, resumePath);
  const validation = await validateRequiredFields(page);
  const reviewRequired = await reviewRequiredFields(page, profile, options);
  const effectiveValidation = {
    ...validation,
    ok: validation.ok && reviewRequired.length === 0,
    blockers: reviewRequired.length ? [...validation.blockers, 'manual review required'] : validation.blockers,
    review_required: reviewRequired,
  };

  return {
    company: job.company,
    title: job.title,
    job_url: job.job_url,
    apply_entry_clicked: applyEntry.clicked,
    known_fields_filled: knownFields,
    text_fields_filled: textFields,
    select_fields_filled: selectFields,
    combobox_fields_filled: comboFields,
    choice_fields_filled: choiceFields,
    file_fields_uploaded: fileFields,
    validation: effectiveValidation,
    status: effectiveValidation.ok ? 'READY_TO_SUBMIT' : 'NEEDS_REVIEW',
  };
}

export async function prepareApplications(jobs, profile, resumePath, options = {}) {
  const browser = await chromium.launchPersistentContext('data/browser-profile', { headless: false });
  const results = [];

  for (const job of jobs) {
    const page = await browser.newPage();
    const result = await prepareOne(page, job, profile, resumePath, options);
    results.push(result);
    console.log(`${result.status}: ${job.company} - ${job.title}`);
    if (!result.validation.ok) {
      console.log(`Missing/blockers: ${[...result.validation.missing, ...result.validation.blockers].join('; ')}`);
    }
  }

  return { browser, results };
}

export async function submitApplications(jobs, profile, resumePath, options = {}) {
  const browser = await chromium.launchPersistentContext('data/browser-profile', { headless: false });
  const results = [];

  for (const job of jobs) {
    const page = await browser.newPage();
    const prepared = await prepareOne(page, job, profile, resumePath, options);
    if (!prepared.validation.ok) {
      console.log(`NOT_SUBMITTED: ${job.company} - ${job.title}`);
      console.log(`Missing/blockers: ${[...prepared.validation.missing, ...prepared.validation.blockers].join('; ')}`);
      results.push({ ...prepared, submitted: false, confirmed: false });
      continue;
    }

    const submission = await clickSubmitAndVerify(page);
    const submitted = submission.clicked && submission.confirmed;
    console.log(`${submitted ? 'APPLIED_CONFIRMED' : 'SUBMIT_UNCONFIRMED'}: ${job.company} - ${job.title}`);
    results.push({
      ...prepared,
      submitted,
      confirmed: submission.confirmed,
      final_url: submission.final_url,
    });
  }

  await browser.close();
  return results;
}

export async function prepareJob(job, profile, resumePath, options = {}) {
  const browser = await chromium.launchPersistentContext('data/browser-profile', { headless: false });
  const page = await browser.newPage();
  const result = await prepareOne(page, job, profile, resumePath, options);
  const reviewToken = savePreparation(job.id, result);
  preparedSessions.set(Number(job.id), { browser, page, result });
  return { ...result, review_token: reviewToken, browser };
}

export async function submitPreparedJob(job, profile, resumePath, reviewToken) {
  if (!consumeReviewToken(job.id, reviewToken)) throw new Error('A valid one-time review token from Prepare fields is required');
  const session = preparedSessions.get(Number(job.id));
  if (!session) throw new Error('Reviewed browser session is no longer open. Prepare the application again.');
  if (!session.result.validation.ok) throw new Error('Prepared form has unresolved blockers');
  const submission = await clickSubmitAndVerify(session.page);
  const result = { ...session.result, ...submission, submitted: submission.clicked && submission.confirmed };
  preparedSessions.delete(Number(job.id));
  await session.browser.close();
  recordSubmission(job.id, result);
  return result;
}
