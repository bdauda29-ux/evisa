const fs = require("fs");
const path = require("path");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

function splitDate(value) {
  const text = String(value || "").trim();

  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return { year: match[1], month: match[2], day: match[3] };

  match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    return {
      year: match[3],
      month: String(match[2]).padStart(2, "0"),
      day: String(match[1]).padStart(2, "0"),
    };
  }

  throw new Error(`Date "${value}" must use DD/MM/YYYY`);
}

async function closeDropdown(page) {
  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  } catch {}
}

async function waitForOverlay(page) {
  try {
    await page
      .locator(".ngx-overlay.foreground-closing,.ngx-overlay,.loading-overlay,.spinner-overlay")
      .first()
      .waitFor({ state: "hidden", timeout: 15000 });
  } catch {}
}

// Selects a Material `mat-select` option by exact normalized text match.
async function chooseMatOption(page, dropdownLocator, desiredValue, label) {
  if (!desiredValue) throw new Error(`No value supplied for ${label}`);

  await closeDropdown(page);
  await waitForOverlay(page);
  await dropdownLocator.scrollIntoViewIfNeeded();

  try {
    await dropdownLocator.click();
  } catch {
    await dropdownLocator.click({ force: true });
  }

  const optionLocator = page.locator("mat-option,.mat-option,.mat-mdc-option,[role='option']");
  await optionLocator.first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(350);

  const count = await optionLocator.count();
  const wanted = normalize(desiredValue);
  const available = [];
  let matchIndex = -1;

  for (let i = 0; i < count; i++) {
    const el = optionLocator.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const text = (await el.innerText().catch(() => "")).trim();
    if (!text) continue;
    available.push(text);
    if (normalize(text) === wanted) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    await closeDropdown(page);
    throw new Error(`"${desiredValue}" was not found in ${label}. Available: ${available.join(" | ")}`);
  }

  const selected = optionLocator.nth(matchIndex);
  try {
    await selected.click();
  } catch {
    await selected.click({ force: true });
  }

  await page.waitForTimeout(650);
}

async function dropdownAfterLabel(page, labelText) {
  const label = normalize(labelText).replace(/'/g, "\\'");
  const xpaths = [
    `(//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${label}')]/ancestor::*[.//mat-select or .//select][1]//mat-select[1])`,
    `(//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${label}')]/ancestor::*[.//mat-select or .//select][1]//select[1])`,
    `(//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${label}')]/following::mat-select[1])`,
    `(//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${label}')]/following::select[1])`,
  ];

  for (const xp of xpaths) {
    const locator = page.locator(`xpath=${xp}`);
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const el = locator.nth(i);
      if (await el.isVisible().catch(() => false)) return el;
    }
  }

  throw new Error(`${labelText} dropdown was not found`);
}

async function inputAfterLabel(page, labelText) {
  const label = normalize(labelText).replace(/'/g, "\\'");
  const xp = `(//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${label}')]/following::input[not(@type='hidden') and not(@type='radio') and not(@type='file')][1])`;
  const locator = page.locator(`xpath=${xp}`).first();
  await locator.waitFor({ timeout: 12000 });
  return locator;
}

async function fillInput(page, labelText, value) {
  if (value === undefined || value === null || String(value).trim() === "") return;
  const input = await inputAfterLabel(page, labelText);
  await input.scrollIntoViewIfNeeded();
  try {
    await input.fill("");
  } catch {}
  await input.fill(String(value));
}

async function selectByLabel(page, labelText, value) {
  if (!value) return;
  const dropdown = await dropdownAfterLabel(page, labelText);
  const tagName = await dropdown.evaluate((el) => el.tagName.toLowerCase());

  if (tagName === "select") {
    const options = dropdown.locator("option");
    const count = await options.count();
    const wanted = normalize(value);
    const available = [];
    let matchIndex = -1;

    for (let i = 0; i < count; i++) {
      const text = (await options.nth(i).innerText()).trim();
      if (!text) continue;
      available.push(text);
      const normalizedText = normalize(text);
      if (normalizedText === wanted || normalizedText.includes(wanted) || wanted.includes(normalizedText)) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex === -1) {
      throw new Error(`"${value}" was not found in ${labelText}. Available: ${available.join(" | ")}`);
    }

    const optionValue = await options.nth(matchIndex).getAttribute("value");
    await dropdown.selectOption(optionValue !== null ? optionValue : { index: matchIndex });
    await page.waitForTimeout(500);
    return;
  }

  await chooseMatOption(page, dropdown, value, labelText);
}

async function clickButton(page, text) {
  await closeDropdown(page);
  await waitForOverlay(page);
  const escaped = text.replace(/'/g, "\\'");

  const xpaths = [
    `//button[normalize-space()='${escaped}']`,
    `//button[.//span[normalize-space()='${escaped}']]`,
    `//button[contains(normalize-space(.),'${escaped}')]`,
    `//input[@type='submit' and contains(@value,'${escaped}')]`,
    `//a[contains(normalize-space(.),'${escaped}')]`,
    `//*[@role='button' and contains(normalize-space(.),'${escaped}')]`,
  ];

  for (const xp of xpaths) {
    const locator = page.locator(`xpath=${xp}`);
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const el = locator.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      await el.scrollIntoViewIfNeeded();
      try {
        await el.click();
      } catch {
        await el.click({ force: true });
      }
      await page.waitForTimeout(1500);
      return;
    }
  }

  throw new Error(`${text} button was not found`);
}

async function clickSubmitContinue(page) {
  const locator = page.locator("input[type='submit'][value='Continue']");
  await locator.waitFor({ timeout: 12000 });
  await locator.scrollIntoViewIfNeeded();
  try {
    await locator.click();
  } catch {
    await locator.click({ force: true });
  }
  await page.waitForTimeout(1800);
}

async function clickRadioById(page, id) {
  const locator = page.locator(`#${id}`);
  await locator.waitFor({ timeout: 12000 });
  try {
    await locator.click();
  } catch {
    await locator.click({ force: true });
  }
  await page.waitForTimeout(200);
}

async function uploadFilesInOrder(page, projectRoot, applicationId, filenames) {
  const applicantFolder = path.join(projectRoot, "documents", applicationId);

  for (const filename of filenames) {
    const filePath = path.join(applicantFolder, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required document was not found: ${filePath}`);
    }
  }

  const fileInputs = page.locator("input[type='file']");
  const count = await fileInputs.count();
  if (count < filenames.length) {
    throw new Error(`Expected ${filenames.length} document upload inputs but found ${count}`);
  }

  for (let index = 0; index < filenames.length; index++) {
    const input = fileInputs.nth(index);
    const filePath = path.join(applicantFolder, filenames[index]);
    await input.setInputFiles(filePath);
    await page.waitForTimeout(900);
  }
}

// Auto-detects which of the portal's 8 pages is currently open in the
// browser, so a run can resume from wherever the applicant's session
// actually is instead of the person having to remember/guess a page
// number. The portal's step panel always renders a "Step N: <name>"
// heading (see e.g. "Step 5: Supporting Documents"), so reading that text
// straight off the page is far more reliable than trying to infer position
// from the stepper's checkmark icons, which vary by visa category.
async function detectCurrentPage(page) {
  const text = await page.locator("body").innerText().catch(() => "");
  const match = text.match(/Step\s+(\d)\s*[:.]/i);
  const n = match ? Number(match[1]) : NaN;
  if (n >= 1 && n <= 8) return n;
  throw new Error(
    "Could not auto-detect the current page from the browser. Make sure the applicant's page is open, or choose a specific starting page instead."
  );
}

async function saveScreenshot(page, projectRoot, applicantId, pageName) {
  const folder = path.join(projectRoot, "screenshots");
  fs.mkdirSync(folder, { recursive: true });
  const filePath = path.join(folder, `${applicantId || "applicant"}-${pageName}.png`);
  await page.screenshot({ path: filePath }).catch(() => {});
  return filePath;
}

module.exports = {
  fs,
  path,
  normalize,
  splitDate,
  closeDropdown,
  waitForOverlay,
  chooseMatOption,
  dropdownAfterLabel,
  inputAfterLabel,
  fillInput,
  selectByLabel,
  clickButton,
  clickSubmitContinue,
  clickRadioById,
  uploadFilesInOrder,
  detectCurrentPage,
  saveScreenshot,
};
