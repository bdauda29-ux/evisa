if (!globalThis.__EVISA_DEVICE_CONTENT__) {
  globalThis.__EVISA_DEVICE_CONTENT__ = true;
  let cancelTimer = null;

  function stopCancelWatch() {
    if (cancelTimer) clearInterval(cancelTimer);
    cancelTimer = null;
  }

  function stopPortalAutomation(reason = 'Automation stopped.') {
    try { globalThis.EVisaPortalAutomation?.stop?.(); } catch (_) {}
    stopCancelWatch();
    console.info('[eVisa Device] ' + reason);
  }

  function startCancelWatch() {
    stopCancelWatch();
    cancelTimer = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'EVISA_CHECK_CANCEL' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.cancelled) stopPortalAutomation('Stopped from dashboard.');
      });
    }, 750);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'EVISA_STOP_JOB') {
      stopPortalAutomation(msg.reason || 'Automation stopped.');
      sendResponse({ ok: true, stopped: true });
      return;
    }

    if (msg?.type !== 'EVISA_START_JOB') return;
    const applicant = msg.job?.applicant;
    if (!applicant) { sendResponse({ ok: false, error: 'Applicant payload missing' }); return; }
    try {
      globalThis.EVisaPortalAutomation?.start(applicant);
      startCancelWatch();
      sendResponse({ ok: true, step: globalThis.EVisaPortalAutomation?.detectStep?.() || 0 });
    } catch (e) { sendResponse({ ok: false, error: e?.message || String(e) }); }
  });
}
