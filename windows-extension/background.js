const DEFAULTS = {
  serverUrl: 'https://evisa-production.up.railway.app',
  portalUrl: 'https://evisa.immigration.gov.ng/',
  username: 'admin',
  password: '',
  enabled: true,
  deviceId: `windows-${Math.random().toString(36).slice(2, 9)}`
};

let activeJob = null;
let portalTabId = null;
let pollBusy = false;

function normalizeUrl(value) { return String(value || '').trim().replace(/\/+$/, ''); }
async function config() { return { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) }; }
function basicAuth(c) { return 'Basic ' + btoa(`${c.username || ''}:${c.password || ''}`); }

async function api(path, options = {}) {
  const c = await config();
  const res = await fetch(normalizeUrl(c.serverUrl) + path, {
    ...options,
    headers: { Authorization: basicAuth(c), ...(options.headers || {}) }
  });
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || String(data || `HTTP ${res.status}`));
  return data;
}

function isPortalUrl(url) { return /^https:\/\/(?:www\.)?evisa\.immigration\.gov\.ng\//i.test(String(url || '')); }

async function findOrOpenPortal() {
  if (portalTabId) {
    try { const t = await chrome.tabs.get(portalTabId); if (t && isPortalUrl(t.url)) return t; } catch (_) {}
  }
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let tab = tabs.find(t => isPortalUrl(t.url));
  if (!tab) {
    const c = await config();
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id && !/^chrome:\/\/|^edge:\/\/|^chrome-extension:\/\//i.test(String(active.url || ''))) {
      tab = await chrome.tabs.update(active.id, { url: c.portalUrl, active: true });
    } else {
      tab = await chrome.tabs.create({ url: c.portalUrl, active: true });
    }
  } else {
    await chrome.tabs.update(tab.id, { active: true });
  }
  portalTabId = tab.id;
  return tab;
}

async function injectAndStart(tabId) {
  if (!activeJob || !tabId) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['portal-automation.js', 'content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'EVISA_START_JOB', job: activeJob });
  } catch (e) {
    console.warn('eVisa injection waiting:', e?.message || e);
  }
}

async function claimNextJob() {
  if (pollBusy || activeJob) return;
  const c = await config();
  if (!c.enabled || !c.serverUrl || !c.password) return;
  pollBusy = true;
  try {
    const payload = await api(`/api/device/jobs/next?deviceId=${encodeURIComponent(c.deviceId)}`);
    if (!payload?.job || !payload?.applicant) return;
    activeJob = payload;
    await chrome.storage.session.set({ activeJob });
    const tab = await findOrOpenPortal();
    if (tab.status === 'complete') await injectAndStart(tab.id);
  } catch (e) {
    console.warn('Device worker poll:', e?.message || e);
  } finally { pollBusy = false; }
}

async function postEvent(payload) {
  if (!activeJob?.job?.id) return;
  try { await api(`/api/device/jobs/${encodeURIComponent(activeJob.job.id)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) { console.warn('Could not send event', e); }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer); let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(out);
}

async function activeJobStatus() {
  if (!activeJob?.job?.id) return { cancelled: false, status: null };
  try {
    const data = await api(`/api/device/jobs/${encodeURIComponent(activeJob.job.id)}/status`);
    return { cancelled: data?.status === 'cancelled', status: data?.status || null };
  } catch (e) {
    console.warn('Could not check device job status', e?.message || e);
    return { cancelled: false, status: null };
  }
}

async function stopActiveJobLocally(reason = 'Stopped from dashboard') {
  if (portalTabId) {
    try { await chrome.tabs.sendMessage(portalTabId, { type: 'EVISA_STOP_JOB', reason }); } catch (_) {}
  }
  activeJob = null;
  await chrome.storage.session.remove('activeJob');
}

async function getDocument(filename) {
  if (!activeJob?.applicant) throw new Error('No active applicant');
  const url = activeJob.applicant.document_urls?.[filename];
  if (!url) throw new Error(`No Railway document URL for ${filename}`);
  const c = await config();
  const res = await fetch(url, { headers: { Authorization: basicAuth(c) } });
  if (!res.ok) throw new Error(`Document download failed: HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  return { ok: true, name: filename, mime: res.headers.get('content-type') || '', base64: arrayBufferToBase64(buffer) };
}

async function showPortalInCurrentTab() {
  const c = await config();
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  let tab;
  if (active?.id && !/^chrome:\/\/|^edge:\/\/|^chrome-extension:\/\//i.test(String(active.url || ''))) {
    tab = await chrome.tabs.update(active.id, { url: c.portalUrl, active: true });
  } else {
    tab = await chrome.tabs.create({ url: c.portalUrl, active: true });
  }
  portalTabId = tab.id;
  return tab;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'EVISA_EVENT') {
    const evt = msg.payload || {};
    let type = 'automation-log';
    if (evt.step && /detected|autofilling|uploading|applying/i.test(evt.message || '')) type = 'page-start';
    if (evt.error) type = 'page-error';
    postEvent({ type, page: evt.step || 0, name: evt.step ? `page-${evt.step}` : '', message: evt.message || '', error: evt.error === true ? evt.message : (typeof evt.error === 'string' ? evt.error : '') });
    chrome.runtime.sendMessage({ type: 'EVISA_SIDE_STATUS', message: evt.message || (evt.step ? `Page ${evt.step}` : 'Automation update'), error: !!evt.error }).catch(() => {});
    sendResponse({ ok: true }); return;
  }
  if (msg?.type === 'EVISA_GET_DOCUMENT') {
    getDocument(msg.filename).then(sendResponse).catch(e => sendResponse({ ok: false, error: e?.message || String(e) }));
    return true;
  }
  if (msg?.type === 'EVISA_JOB_COMPLETE') {
    chrome.runtime.sendMessage({ type: 'EVISA_SIDE_STATUS', message: 'Applicant automation complete.', error: false }).catch(() => {});
    postEvent({ type: 'applicant-complete' }).finally(async () => {
      activeJob = null; await chrome.storage.session.remove('activeJob'); setTimeout(claimNextJob, 1000);
    });
    sendResponse({ ok: true }); return;
  }
  if (msg?.type === 'EVISA_CHECK_CANCEL') {
    activeJobStatus().then(async status => {
      if (status.cancelled) await stopActiveJobLocally('Stopped from dashboard');
      sendResponse({ ok: true, cancelled: status.cancelled, status: status.status });
    }).catch(e => sendResponse({ ok: false, cancelled: false, error: e?.message || String(e) }));
    return true;
  }
  if (msg?.type === 'EVISA_SHOW_PORTAL_CURRENT_TAB') {
    showPortalInCurrentTab().then(tab => sendResponse({ ok: true, tabId: tab.id })).catch(e => sendResponse({ ok: false, error: e?.message || String(e) })); return true;
  }
  if (msg?.type === 'EVISA_FORCE_STOP') {
    stopActiveJobLocally('Stopped from side panel').then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: e?.message || String(e) })); return true;
  }
  if (msg?.type === 'EVISA_GET_WORKER_STATE') {
    config().then(c => sendResponse({ ok: true, enabled: !!c.enabled, activeJob: activeJob?.job?.applicationId || null, portalTabId })).catch(e => sendResponse({ ok: false, error: e?.message || String(e) })); return true;
  }
  if (msg?.type === 'EVISA_POPUP_TEST') {
    api('/api/health').then(data => sendResponse({ ok: true, data })).catch(e => sendResponse({ ok: false, error: e?.message || String(e) })); return true;
  }
  if (msg?.type === 'EVISA_POPUP_POLL') { claimNextJob().then(() => sendResponse({ ok: true, active: !!activeJob })).catch(e => sendResponse({ ok: false, error: String(e) })); return true; }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!activeJob || changeInfo.status !== 'complete' || !isPortalUrl(tab.url)) return;
  portalTabId = tabId;
  setTimeout(() => injectAndStart(tabId), 500);
});
chrome.tabs.onRemoved.addListener(tabId => { if (tabId === portalTabId) portalTabId = null; });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'evisa-poll') claimNextJob(); });
chrome.runtime.onInstalled.addListener(async () => { await chrome.storage.local.set({ ...(await config()) }); chrome.alarms.create('evisa-poll', { periodInMinutes: 0.5 }); try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); } catch (_) {} });
chrome.runtime.onStartup.addListener(async () => { const saved = await chrome.storage.session.get('activeJob'); activeJob = saved.activeJob || null; chrome.alarms.create('evisa-poll', { periodInMinutes: 0.5 }); claimNextJob(); });
chrome.alarms.create('evisa-poll', { periodInMinutes: 0.5 });
try { chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); } catch (_) {}
claimNextJob();
// Fast foreground queue pickup. Chrome alarms remain the service-worker fallback.
setInterval(() => { claimNextJob().catch(() => {}); }, 2500);
