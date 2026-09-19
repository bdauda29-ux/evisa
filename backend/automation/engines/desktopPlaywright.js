const browserManager = require('../../browserManager');
const { runPages } = require('../runner');
const { detectCurrentPage } = require('../helpers');

class DesktopPlaywrightEngine {
  constructor({ projectRoot, emit }) {
    this.projectRoot = projectRoot;
    this.emit = emit || (() => {});
  }

  get id() { return 'desktop-playwright'; }
  get sameDevice() { return true; }
  get capabilities() {
    return {
      textFields: true,
      dropdowns: true,
      fileUpload: true,
      screenshots: true,
      persistentSession: true,
      captchaManualHandoff: true,
    };
  }

  async launch(options = {}) {
    await browserManager.ensureBrowser({ headless: !!options.headless });
    return { ok: true };
  }

  async close() {
    await browserManager.closeBrowser();
    return { ok: true };
  }

  status() {
    return { open: !!browserManager.getBrowser() };
  }

  async runApplicant({ applicant, startPage = 1, onProgress = () => {} }) {
    await browserManager.ensureBrowser();
    const ctx = browserManager.getBrowser();
    const page = ctx.pages()[0] || (await ctx.newPage());

    let resolvedStartPage = startPage;
    if (startPage === 'auto') {
      resolvedStartPage = await detectCurrentPage(page);
      this.emit('automation:log', {
        level: 'info',
        message: `[${applicant.application_id}] Auto-detected page ${resolvedStartPage}`,
      });
    }

    return runPages({
      page,
      applicant,
      projectRoot: this.projectRoot,
      startPage: resolvedStartPage,
      onProgress,
    });
  }
}

module.exports = DesktopPlaywrightEngine;
