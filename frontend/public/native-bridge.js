/*
 * Same-device mobile automation bridge contract.
 *
 * The management UI calls window.EVisaNative. Android/iOS implementations
 * provide these methods from the local native app. No PC or VPS is involved.
 */
(function (global) {
  const unavailable = async () => {
    throw new Error('Native eVisa bridge is not available. Install/open the native eVisa Assistant app.');
  };

  global.EVisa = {
    isNative: () => !!global.EVisaNative,
    platform: () => global.EVisaNative?.platform || 'web',
    openPortal: (options) => global.EVisaNative?.openPortal?.(options) ?? unavailable(),
    closePortal: () => global.EVisaNative?.closePortal?.() ?? unavailable(),
    runApplicant: (payload) => global.EVisaNative?.runApplicant?.(payload) ?? unavailable(),
    stopAutomation: () => global.EVisaNative?.stopAutomation?.() ?? unavailable(),
    chooseAssignedDocument: (request) => global.EVisaNative?.chooseAssignedDocument?.(request) ?? unavailable(),
  };
})(window);
