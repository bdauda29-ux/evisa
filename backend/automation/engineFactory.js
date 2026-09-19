const DesktopPlaywrightEngine = require('./engines/desktopPlaywright');
const MobileBridgeEngine = require('./engines/mobileBridge');

function normalizePlatform(value) {
  const p = String(value || '').toLowerCase();
  if (p.includes('android')) return 'android';
  if (p.includes('iphone') || p.includes('ipad') || p.includes('ios')) return 'ios';
  return 'desktop';
}

function createEngine({ platform, projectRoot, emit }) {
  const normalized = normalizePlatform(platform);
  if (normalized === 'desktop') return new DesktopPlaywrightEngine({ projectRoot, emit });
  return new MobileBridgeEngine(normalized);
}

function capabilitiesFor(platform) {
  const engine = createEngine({ platform, projectRoot: '', emit: () => {} });
  return { platform: normalizePlatform(platform), engine: engine.id, sameDevice: engine.sameDevice, capabilities: engine.capabilities };
}

module.exports = { createEngine, capabilitiesFor, normalizePlatform };
