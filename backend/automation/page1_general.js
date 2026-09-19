const { chooseMatOption, clickButton, waitForOverlay, clickSubmitContinue } = require("./helpers");

async function run(page, applicant) {
  await waitForOverlay(page);

  const dropdowns = page.locator("mat-select[role='combobox']");
  const count = await dropdowns.count();
  const visible = [];
  for (let i = 0; i < count; i++) {
    if (await dropdowns.nth(i).isVisible().catch(() => false)) visible.push(dropdowns.nth(i));
  }

  if (visible.length < 3) throw new Error("Page 1 dropdowns were not found");

  await chooseMatOption(page, visible[0], applicant.nationality, "Nationality");
  await chooseMatOption(page, visible[1], applicant.visa_category, "Class of Visa");
  await chooseMatOption(page, visible[2], applicant.passport_type || "Standard", "Passport Type");

  try {
    await clickButton(page, "Save & Continue");
  } catch {
    await clickButton(page, "Continue");
  }

  return { page: 1, completed: true };
}

module.exports = { run };
