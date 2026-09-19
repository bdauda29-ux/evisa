const path = require("path");
const { chromium } = require("playwright");
const { DATA_DIR } = require("./db");

let context = null;
let launching = null;

const PROFILE_DIR = path.join(DATA_DIR, "browser-profile");

// Launches one persistent, headed browser context that the person can see
// and interact with directly (mirrors the desktop app's "applicant-owned
// browser session" idea) so they can log in, solve captchas, etc.
//
// channel: "chrome" tells Playwright to drive the actual Google Chrome
// installed on this machine rather than downloading and launching its own
// bundled "for testing" Chromium build. That's a real, full browser install
// (proper codecs, the person's usual rendering behavior) instead of the
// stripped-down automation binary Playwright uses by default.
async function ensureBrowser({ headless = false, channel = "chrome" } = {}) {
  if (context) return context;
  if (launching) return launching;

  const hosted = /^(1|true|yes)$/i.test(String(process.env.HOSTED_MODE || ""));
  const effectiveHeadless = hosted ? true : headless;
  const effectiveChannel = hosted ? undefined : channel;
  const launchOptions = {
    headless: effectiveHeadless,
    viewport: hosted ? { width: 1440, height: 1000 } : null,
    args: hosted
      ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      : ["--start-maximized"],
  };
  if (effectiveChannel) launchOptions.channel = effectiveChannel;

  launching = chromium
    .launchPersistentContext(PROFILE_DIR, launchOptions)
    .then((ctx) => {
      context = ctx;
      context.on("close", () => {
        context = null;
      });
      return ctx;
    })
    .catch((error) => {
      // Falls back to Playwright's bundled Chromium only if the system
      // doesn't have Google Chrome installed at all, so launching the
      // browser still works out of the box — but real Chrome is always
      // tried first.
      if (!hosted && channel && /executable doesn't exist|failed to find/i.test(String(error?.message || ""))) {
        return chromium
          .launchPersistentContext(PROFILE_DIR, { headless, viewport: null, args: ["--start-maximized"] })
          .then((ctx) => {
            context = ctx;
            context.on("close", () => {
              context = null;
            });
            return ctx;
          });
      }
      throw error;
    })
    .finally(() => {
      launching = null;
    });

  return launching;
}

function getBrowser() {
  return context;
}

async function closeBrowser() {
  if (context) {
    await context.close().catch(() => {});
    context = null;
  }
}

async function newPage() {
  const ctx = await ensureBrowser();
  const pages = ctx.pages();
  return pages.length ? pages[0] : ctx.newPage();
}

module.exports = { ensureBrowser, getBrowser, closeBrowser, newPage };
