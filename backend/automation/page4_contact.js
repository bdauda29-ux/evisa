const { chooseMatOption } = require("./helpers");

async function fillInputByName(page, name, value, required = true) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) throw new Error(`No value supplied for ${name}`);
    return;
  }
  const input = page.locator(`input[name='${name}']`);
  await input.waitFor({ timeout: 12000 });
  await input.scrollIntoViewIfNeeded();
  try {
    await input.fill("");
  } catch {}
  await input.fill(String(value));
}

async function selectState(page, value) {
  const dropdown = page.locator("mat-select[name='contactState']");
  await dropdown.waitFor({ timeout: 12000 });
  await chooseMatOption(page, dropdown, value, "State");
}

async function clickContinue(page) {
  const button = page.locator("input[type='submit'][value='Continue']");
  await button.waitFor({ timeout: 12000 });
  await button.scrollIntoViewIfNeeded();
  try {
    await button.click();
  } catch {
    await button.click({ force: true });
  }
  await page.waitForTimeout(1800);
}

async function run(page, applicant) {
  await fillInputByName(page, "contactName", applicant.contact_name);
  await fillInputByName(page, "contactPhone", applicant.contact_phone);
  await fillInputByName(page, "contactAddress", applicant.contact_address);
  await fillInputByName(page, "contactCity", applicant.contact_city);
  await selectState(page, applicant.contact_state);
  await fillInputByName(page, "contactEmail", applicant.contact_email);
  await fillInputByName(page, "contactPostalCode", applicant.postal_code, false);
  await clickContinue(page);

  return { page: 4, completed: true };
}

module.exports = { run };
