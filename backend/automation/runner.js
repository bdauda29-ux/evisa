const page1 = require("./page1_general");
const page2 = require("./page2_biodata");
const page3 = require("./page3_travel");
const page4 = require("./page4_contact");
const page5 = require("./page5_documents");
const page6 = require("./page6_travel_history");
const page7 = require("./page7_security");
const page8 = require("./page8_biometrics");
const { saveScreenshot } = require("./helpers");

const pages = [
  { number: 1, name: "general", module: page1 },
  { number: 2, name: "biodata", module: page2 },
  { number: 3, name: "travel", module: page3 },
  { number: 4, name: "contact", module: page4 },
  { number: 5, name: "documents", module: page5 },
  { number: 6, name: "travel-history", module: page6 },
  { number: 7, name: "security", module: page7 },
  { number: 8, name: "biometrics", module: page8 },
];

function isClosedWindow(error) {
  return /has been closed|target closed|target page, context or browser has been closed/i.test(String(error?.message || error));
}

async function safeScreenshot(page, projectRoot, id, label) {
  try {
    return await saveScreenshot(page, projectRoot, id, label);
  } catch {
    return "";
  }
}

// Runs the 8-page portal flow for one applicant against a live Playwright
// page. onProgress is called with structured events so the caller can
// forward them to the dashboard over Socket.IO.
async function runPages({ page, applicant, projectRoot, startPage = 1, onProgress = () => {} }) {
  const results = [];

  for (const pageDef of pages) {
    if (pageDef.number < startPage) continue;

    onProgress({ type: "page-start", page: pageDef.number, name: pageDef.name });
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await pageDef.module.run(page, applicant, projectRoot);
        const screenshotPath = await safeScreenshot(page, projectRoot, applicant.application_id, `page${pageDef.number}-${pageDef.name}-complete`);
        results.push({ ...result, name: pageDef.name, screenshotPath });
        onProgress({ type: "page-complete", page: pageDef.number, name: pageDef.name, screenshotPath, ...result });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (isClosedWindow(error)) break;

        onProgress({
          type: "page-retry",
          page: pageDef.number,
          name: pageDef.name,
          attempt,
          error: String(error?.message || error),
        });

        await page.waitForTimeout(1200);
      }
    }

    if (lastError) {
      const screenshotPath = await safeScreenshot(page, projectRoot, applicant.application_id, `page${pageDef.number}-${pageDef.name}-error`);
      onProgress({
        type: "page-error",
        page: pageDef.number,
        name: pageDef.name,
        error: String(lastError?.message || lastError),
        screenshotPath,
      });
      throw lastError;
    }
  }

  return results;
}

module.exports = { runPages, pages };
