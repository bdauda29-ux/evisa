const { clickRadioById } = require("./helpers");

const NO_IDS = ["convictionsNo", "chargesNo", "terrorismNo", "viewsNo"];

async function run(page) {
  for (const id of NO_IDS) await clickRadioById(page, id);

  const button = page.locator("input[type='submit'][value='Continue']");
  await button.waitFor({ timeout: 12000 });
  try {
    await button.click();
  } catch {
    await button.click({ force: true });
  }
  await page.waitForTimeout(1800);

  return { page: 7, completed: true };
}

module.exports = { run };
