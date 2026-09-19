// Server-side descriptor for the native same-device mobile engine.
// Android/iOS automation does NOT execute here. A packaged mobile app uses
// the shared bridge contract in mobile/shared/bridge-contract.js and drives
// an embedded WebView/WKWebView locally on the phone.
class MobileBridgeEngine {
  constructor(platform) {
    this.platform = platform;
  }

  get id() { return `${this.platform}-native-webview`; }
  get sameDevice() { return true; }
  get capabilities() {
    return {
      textFields: true,
      dropdowns: true,
      fileUpload: 'native-handoff',
      screenshots: 'native',
      persistentSession: true,
      captchaManualHandoff: true,
    };
  }

  status() { return { open: false, delegatedToNativeApp: true }; }

  async launch() {
    const error = new Error(
      `The ${this.platform} automation engine must be run inside the installed ${this.platform} app so automation happens on that same device.`
    );
    error.code = 'NATIVE_APP_REQUIRED';
    throw error;
  }
}

module.exports = MobileBridgeEngine;
