const { clickRadioById } = require("./helpers");

async function run(page) {
  await clickRadioById(page, "portOfEntry");

  const button = page.locator("input[type='submit'][value='Continue']");
  await button.waitFor({ timeout: 12000 });
  try {
    await button.click();
  } catch {
    await button.click({ force: true });
  }
  await page.waitForTimeout(1800);

  return { page: 8, completed: true, message: "Biometric method selected. Manual review required." };
}

module.exports = { run };
