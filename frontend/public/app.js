const API = "";
const socket = io();

function detectedPlatform() {
  if (window.EVisa?.isNative?.()) return window.EVisa.platform();
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "desktop";
}

const DEVICE_PLATFORM = detectedPlatform();
const IS_NATIVE_MOBILE = (DEVICE_PLATFORM === "android" || DEVICE_PLATFORM === "ios") && !!window.EVisa?.isNative?.();
const IS_MOBILE_WEB = (DEVICE_PLATFORM === "android" || DEVICE_PLATFORM === "ios") && !IS_NATIVE_MOBILE;

function platformHeaders() {
  return { "X-Evisa-Platform": DEVICE_PLATFORM };
}

async function loadServerMode() {
  try {
    const res = await fetch(`${API}/api/health`, { headers: platformHeaders() });
    const data = await res.json();
    HOSTED_SERVER = !!data.hosted;
  } catch { HOSTED_SERVER = false; }
}

let HOSTED_SERVER = false;
let applicants = [];
let selectedIds = new Set();
let clients = [];
let lookups = { countries: [], carriers: [], ports: [], flights: [], contacts: [], fixedLists: {}, documentLabelsByVisa: {}, passportPhotoPositionByVisa: {} };

async function loadLookups() {
  const res = await fetch(`${API}/api/lookups`);
  lookups = await res.json();
}

async function loadClients() {
  const res = await fetch(`${API}/api/clients`);
  clients = res.ok ? await res.json() : [];
  renderClients();
}

function renderClients() {
  const tbody = document.getElementById("clientRows");
  const empty = document.getElementById("clientEmptyState");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (empty) empty.style.display = clients.length ? "none" : "block";
  for (const client of clients) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${client.client_code || ""}</strong></td>
      <td>${client.client_name || ""}</td>
      <td><button class="btn btn-sm btn-danger btn-icon-only" data-client-delete="${client.client_code}" title="Delete client" aria-label="Delete client">🗑</button></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("[data-client-delete]").forEach((btn) => btn.addEventListener("click", async () => {
    const code = btn.dataset.clientDelete;
    if (!confirm(`Delete saved client ${code}?\n\nExisting applications will not be deleted.`)) return;
    const res = await fetch(`${API}/api/clients/${encodeURIComponent(code)}`, { method: "DELETE" });
    if (!res.ok) return alert("Could not delete client.");
    await loadClients();
  }));
}

function openClientModal() {
  modal.innerHTML = `
    <h2>Add Client</h2>
    <div class="modal-grid">
      <label class="field"><span>Client Code</span><input id="clientCode" maxlength="40" placeholder="e.g. ASA" /></label>
      <label class="field"><span>Client Name</span><input id="clientName" placeholder="Optional client/company name" /></label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancelClientBtn">Cancel</button>
      <button class="btn btn-primary" id="saveClientBtn">Save Client</button>
    </div>`;
  modal.querySelector("#cancelClientBtn").addEventListener("click", closeModal);
  modal.querySelector("#saveClientBtn").addEventListener("click", async () => {
    const client_code = modal.querySelector("#clientCode").value.trim();
    const client_name = modal.querySelector("#clientName").value.trim();
    if (!client_code) return alert("Client Code is required.");
    const res = await fetch(`${API}/api/clients`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({client_code, client_name})
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      return alert(err.error || "Could not save client.");
    }
    await loadClients();
    closeModal();
  });
  backdrop.classList.remove("hidden");
}

document.getElementById("addClientBtn")?.addEventListener("click", openClientModal);

const PAGE_NAMES = ["general", "biodata", "travel", "contact", "documents", "travel-history", "security", "biometrics"];
const PAGE_LABELS = ["1 General", "2 Biodata", "3 Travel", "4 Contact", "5 Docs", "6 History", "7 Security", "8 Biometrics"];

// ---------------- Tabs ----------------

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");
  });
});

// ---------------- CSV / SQLite persistence ----------------

function downloadFromApi(url) {
  const a = document.createElement("a"); a.href = url; a.style.display = "none";
  document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
}

document.getElementById("exportCsvBtn")?.addEventListener("click", () => downloadFromApi(`${API}/api/export/csv`));
document.getElementById("saveSqliteBtn")?.addEventListener("click", () => downloadFromApi(`${API}/api/database/download`));
document.getElementById("sqliteInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  if (!confirm(`Load ${file.name}? This replaces the active applicant database on the server.`)) { e.target.value=""; return; }
  const summary = document.getElementById("importSummary"); summary.textContent = "Loading SQLite…";
  const fd = new FormData(); fd.append("file", file);
  const res = await fetch(`${API}/api/database/load`, { method:"POST", body:fd });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) { summary.textContent = `SQLite load failed: ${data.error || res.status}`; e.target.value=""; return; }
  applicants = data.applicants || []; renderTable(); summary.textContent = `SQLite loaded — ${data.loaded} applicant(s). Autosave is active.`;
  e.target.value="";
});

// ---------------- Data loading ----------------

async function loadApplicants() {
  const res = await fetch(`${API}/api/applicants`);
  applicants = await res.json();
  renderTable();
  return applicants;
}

function statusPillClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "submitted") return "pill-done";
  if (["error", "errored", "failed"].includes(s)) return "pill-error";
  if (s === "in progress" || s === "processing") return "pill-progress";
  return "pill-ready";
}

function docCount(applicant) {
  let n = 0;
  for (let i = 1; i <= 7; i++) if (applicant[`upload_position_${i}`]) n++;
  return n;
}

function applicantTimestamp(applicant) {
  return applicant.updated_at || applicant.created_at || "";
}

function formatApplicantTimestamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

const queueSearchEl = document.getElementById("queueSearch");
const statusFilterEl = document.getElementById("statusFilter");
const visaFilterEl = document.getElementById("visaFilter");
const markSubmittedBtn = document.getElementById("markSubmittedBtn");

function syncQueueFilterOptions() {
  const refill = (select, values, allLabel) => {
    if (!select) return;
    const selected = select.value;
    select.innerHTML = `<option value="">${allLabel}</option>`;
    [...new Set(values.filter(Boolean).map((v) => String(v).trim()))]
      .sort((a, b) => a.localeCompare(b))
      .forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    if ([...select.options].some((o) => o.value === selected)) select.value = selected;
  };
  refill(statusFilterEl, applicants.map((a) => a.status || "Ready"), "All statuses");
  refill(visaFilterEl, applicants.map((a) => a.visa_category), "All visa types");
}

function applicantMatchesQueueFilters(applicant) {
  const q = String(queueSearchEl?.value || "").trim().toLowerCase();
  const status = String(statusFilterEl?.value || "").trim().toLowerCase();
  const visa = String(visaFilterEl?.value || "").trim().toLowerCase();
  if (status && String(applicant.status || "Ready").trim().toLowerCase() !== status) return false;
  if (visa && String(applicant.visa_category || "").trim().toLowerCase() !== visa) return false;
  if (!q) return true;
  const haystack = [
    applicant.application_id, applicant.title, applicant.first_name, applicant.surname,
    applicant.other_names, applicant.passport_number, applicant.nationality,
    applicant.visa_category, applicant.status
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

function updateQueueActionState() {
  const id = [...selectedIds][0] || "";
  const selected = applicants.find((a) => a.application_id === id);
  if (markSubmittedBtn) {
    markSubmittedBtn.disabled = !selected || String(selected.status || "").trim().toLowerCase() === "submitted";
  }
}

function renderTable() {
  const tbody = document.getElementById("applicantRows");
  const empty = document.getElementById("emptyState");
  tbody.innerHTML = "";

  if (!applicants.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  syncQueueFilterOptions();

  // Apply search/filter first. Active/error applications stay above submitted
  // applications; within both groups the most recent application is first.
  const displayedApplicants = applicants.filter(applicantMatchesQueueFilters).sort((a, b) => {
    const submittedRank = (item) =>
      String(item.status || "").trim().toLowerCase() === "submitted" ? 1 : 0;
    const groupDiff = submittedRank(a) - submittedRank(b);
    if (groupDiff) return groupDiff;
    const aTime = Date.parse(applicantTimestamp(a)) || 0;
    const bTime = Date.parse(applicantTimestamp(b)) || 0;
    return bTime - aTime;
  });

  for (const a of displayedApplicants) {
    const tr = document.createElement("tr");
    const rowStatus = String(a.status || "").trim().toLowerCase();
    if (rowStatus === "submitted") tr.classList.add("applicant-row-submitted");
    if (["error", "errored", "failed"].includes(rowStatus)) tr.classList.add("applicant-row-error");
    const name = [a.title, a.first_name, a.surname].filter(Boolean).join(" ");
    tr.innerHTML = `
      <td><input type="radio" name="applicantSelection" class="row-select" data-id="${a.application_id}" ${selectedIds.has(a.application_id) ? "checked" : ""}/></td>
      <td class="mono">${a.application_id}</td>
      <td>${name || "<span class=\"muted\">Unnamed</span>"}</td>
      <td>${a.visa_category || ""}</td>
      <td><span class="pill ${statusPillClass(a.status)}">${a.status || "Ready"}</span></td>
      <td class="applicant-timestamp">${formatApplicantTimestamp(applicantTimestamp(a))}</td>
      <td>${docCount(a)}/7</td>
      <td>
        <button class="btn btn-sm btn-ghost" data-action="assign" data-id="${a.application_id}">Docs</button>
        <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${a.application_id}">Edit</button>
        <button class="btn btn-sm btn-danger btn-icon-only" data-action="delete" data-id="${a.application_id}" title="Delete application" aria-label="Delete application">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll(".row-select").forEach((cb) => {
    cb.addEventListener("change", () => {
      selectedIds = cb.checked ? new Set([cb.dataset.id]) : new Set();
      updateQueueActionState();
    });
  });
  updateQueueActionState();

  tbody.querySelectorAll('[data-action="assign"]').forEach((btn) => {
    btn.addEventListener("click", () => openAssignModal(btn.dataset.id));
  });
  tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const applicant = applicants.find((a) => a.application_id === id);
      const name = [applicant?.title, applicant?.first_name, applicant?.surname].filter(Boolean).join(" ");
      if (!confirm(`Delete application ${id}${name ? ` — ${name}` : ""}?\n\nThis will remove the applicant from the queue and delete the applicant's uploaded document folder.`)) return;
      btn.disabled = true;
      const res = await fetch(`${API}/api/applicants/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Could not delete application");
        btn.disabled = false;
        return;
      }
      selectedIds.delete(id);
      appendLog(`[${id}] Application deleted from queue.`);
      await loadApplicants();
    });
  });
}

queueSearchEl?.addEventListener("input", renderTable);
statusFilterEl?.addEventListener("change", renderTable);
visaFilterEl?.addEventListener("change", renderTable);
document.getElementById("clearQueueFilters")?.addEventListener("click", () => {
  if (queueSearchEl) queueSearchEl.value = "";
  if (statusFilterEl) statusFilterEl.value = "";
  if (visaFilterEl) visaFilterEl.value = "";
  renderTable();
});

markSubmittedBtn?.addEventListener("click", async () => {
  const id = [...selectedIds][0];
  if (!id) return;
  const applicant = applicants.find((a) => a.application_id === id);
  if (!applicant || String(applicant.status || "").trim().toLowerCase() === "submitted") return;
  if (!confirm(`Mark ${id} as Submitted?`)) return;
  markSubmittedBtn.disabled = true;
  const res = await fetch(`${API}/api/applicants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application_id: id, status: "Submitted" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || "Could not mark application as Submitted");
    updateQueueActionState();
    return;
  }
  appendLog(`[${id}] Marked as Submitted manually.`);
  selectedIds.clear();
  await loadApplicants();
});

// ---------------- Import ----------------

document.getElementById("importInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);

  const summary = document.getElementById("importSummary");
  summary.textContent = "Importing…";

  const res = await fetch(`${API}/api/import`, { method: "POST", body: formData });
  const data = await res.json();
  if (data.error) {
    summary.textContent = `Import failed: ${data.error}`;
    return;
  }
  summary.textContent = `Imported ${data.imported}, skipped ${data.skipped}`;
  applicants = data.applicants;
  renderTable();
  e.target.value = "";
});

// ---------------- Modal helpers ----------------

const backdrop = document.getElementById("modalBackdrop");
const modal = document.getElementById("modal");

function closeModal() {
  backdrop.classList.add("hidden");
  modal.innerHTML = "";
}
backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) closeModal();
});

// [field, label, type] — same field set and dropdown typing as the desktop
// app's applicantFormFields, so "defined dropdowns" match exactly.
const APPLICANT_FIELDS = [
  ["application_id", "Application ID", "text"],
  ["nationality", "Nationality", "country"],
  ["visa_category", "Visa Category", "visa_category"],
  ["passport_type", "Passport Type", "passport_type"],
  ["title", "Title", "title"],
  ["surname", "Surname", "text"],
  ["first_name", "First Name", "text"],
  ["other_names", "Other Names", "text"],
  ["date_of_birth", "Date of Birth (DD/MM/YYYY)", "date"],
  ["place_of_birth", "Place of Birth", "text"],
  ["gender", "Gender", "gender"],
  ["marital_status", "Marital Status", "marital_status"],
  ["passport_number", "Passport Number", "text"],
  ["passport_expiry_date", "Passport Expiry (DD/MM/YYYY)", "date"],
  ["has_nigerian_passport", "Has Nigerian Passport", "has_nigerian_passport"],
  ["purpose_of_journey", "Purpose of Journey", "text"],
  ["travel_carrier", "Travel Carrier", "carrier"],
  ["flight_number", "Flight Number", "flight"],
  ["country_of_departure", "Country of Departure", "country"],
  ["departure_date", "Departure Date (DD/MM/YYYY)", "date"],
  ["arrival_date", "Arrival Date (DD/MM/YYYY)", "date"],
  ["arrival_channel", "Arrival Channel", "arrival_channel"],
  ["duration_of_stay", "Duration of Stay", "number"],
  ["port_of_entry", "Port of Entry", "port"],
  ["contact_name", "Contact Name", "contact"],
  ["contact_phone", "Contact Phone", "text"],
  ["contact_address", "Contact Address", "text"],
  ["contact_city", "Contact City", "text"],
  ["contact_state", "Contact State", "text"],
  ["contact_email", "Contact Email", "email"],
  ["postal_code", "Postal Code", "text"],
  ["status", "Status", "status"],
  ["notes", "Notes", "textarea"],
];

// Mirrors the desktop app's listForType(): fixed lists come straight from
// /api/lookups.fixedLists; a few types pull from the seeded lookup tables
// (optionally filtered, e.g. ports by arrival channel, flights by carrier).
function optionsForType(type, context = {}) {
  if (type === "country") return lookups.countries || [];
  if (type === "carrier") return lookups.carriers || [];
  if (type === "port") {
    const channel = context.arrivalChannel || "";
    return (lookups.ports || [])
      .filter((p) => !channel || p.arrival_channel === channel)
      .map((p) => p.port_name);
  }
  if (type === "flight") {
    const carrier = context.carrier || "";
    return (lookups.flights || [])
      .filter((f) => !carrier || f.carrier_name === carrier)
      .map((f) => f.flight_number);
  }
  if (type === "contact") return (lookups.contacts || []).map((c) => c.contact_name);
  return (lookups.fixedLists && lookups.fixedLists[type]) || [];
}

function ddmmyyyyToISO(value) {
  const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isoToDdmmyyyy(iso) {
  const match = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

// The portal requires travel dates at least 3 days out. "Global time" means
// this is anchored to UTC "now" rather than the browser's local clock, so
// the earliest selectable date is the same regardless of the applicant's or
// operator's timezone.
const MIN_TRAVEL_DATE_LEAD_DAYS = 3;
function minTravelDateISO() {
  const now = new Date();
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const min = new Date(utcToday + MIN_TRAVEL_DATE_LEAD_DAYS * 24 * 60 * 60 * 1000);
  const y = min.getUTCFullYear();
  const m = String(min.getUTCMonth() + 1).padStart(2, "0");
  const d = String(min.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createApplicantControl(field, labelText, type, value, context = {}) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  wrap.appendChild(label);

  let control;

  if (type === "date") {
    // Text input (dd/mm/yyyy, still editable directly or via Quick Fill) plus
    // a native date-picker input that writes back into it.
    const row = document.createElement("div");
    row.className = "date-control-row";
    control = document.createElement("input");
    control.type = "text";
    control.placeholder = "dd/mm/yyyy";
    control.value = value || "";

    const pickerInput = document.createElement("input");
    pickerInput.type = "date";
    pickerInput.className = "date-picker-input";
    pickerInput.title = "Pick a date";
    pickerInput.value = ddmmyyyyToISO(value);

    const pickerBtn = document.createElement("button");
    pickerBtn.type = "button";
    pickerBtn.className = "date-picker-btn";
    pickerBtn.title = "Pick a date";
    pickerBtn.setAttribute("aria-label", "Open calendar");
    pickerBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    pickerBtn.addEventListener("click", () => {
      if (pickerInput.showPicker) {
        try {
          pickerInput.showPicker();
          return;
        } catch {}
      }
      pickerInput.focus();
      pickerInput.click();
    });

    // Travel dates (departure/arrival) must clear the portal's minimum lead
    // time. Anchoring the picker's own min= to that date means the calendar
    // simply won't let anyone click an invalid day, instead of failing later
    // on the portal.
    const isTravelDate = field === "departure_date" || field === "arrival_date";
    let hint = null;
    if (isTravelDate) {
      const minISO = minTravelDateISO();
      pickerInput.min = minISO;
      if (!value) {
        control.value = isoToDdmmyyyy(minISO);
        pickerInput.value = minISO;
      }
      hint = document.createElement("span");
      hint.className = "date-hint";
      hint.textContent = `Earliest selectable: ${isoToDdmmyyyy(minISO)}`;
    }

    const validateTravelDate = () => {
      if (!isTravelDate) return;
      const iso = ddmmyyyyToISO(control.value);
      const minISO = minTravelDateISO();
      const invalid = !iso || iso < minISO;
      control.classList.toggle("input-invalid", invalid);
      if (hint) hint.classList.toggle("date-hint-error", invalid);
    };

    const applyFromPicker = () => {
      const iso = pickerInput.value;
      if (!iso) return;
      const [y, m, d] = iso.split("-");
      control.value = `${d}/${m}/${y}`;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    };
    pickerInput.addEventListener("change", applyFromPicker);

    // Typing/pasting a date directly still normalizes and keeps the picker in sync.
    control.addEventListener("change", () => {
      const normalized = normalizeFlexibleDate(control.value);
      if (normalized) control.value = normalized;
      pickerInput.value = ddmmyyyyToISO(control.value);
      validateTravelDate();
    });
    validateTravelDate();

    row.appendChild(control);
    row.appendChild(pickerBtn);
    row.appendChild(pickerInput);
    wrap.appendChild(row);
    if (hint) wrap.appendChild(hint);
    control.dataset.field = field;
    control.dataset.type = type;
    return wrap;
  }

  if (type === "textarea") {
    control = document.createElement("textarea");
    control.value = value || "";
  } else if (type === "contact" || type === "flight") {
    // Free-text with suggestions, like the desktop datalist fields, plus a
    // "+" to add a brand new contact for the contact type.
    const row = document.createElement("div");
    row.className = "contact-control-row";
    control = document.createElement("input");
    control.type = "text";
    control.value = value || "";
    const listId = `${type}-opts-${field}-${Math.random().toString(36).slice(2)}`;
    control.setAttribute("list", listId);
    const datalist = document.createElement("datalist");
    datalist.id = listId;
    for (const item of optionsForType(type, context)) {
      const opt = document.createElement("option");
      opt.value = item;
      datalist.appendChild(opt);
    }
    row.appendChild(control);
    if (type === "contact") {
      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn btn-sm btn-ghost";
      plus.textContent = "+";
      plus.title = "Add a new hotel / host address";
      plus.addEventListener("click", () => openAddContactModal(control));
      row.appendChild(plus);
    }
    row.appendChild(datalist);
    wrap.appendChild(row);
    control.dataset.field = field;
    control.dataset.type = type;
    return wrap;
  } else {
    const options = optionsForType(type, context);
    if (options.length) {
      control = document.createElement("select");
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Select…";
      control.appendChild(blank);
      for (const item of options) {
        const opt = document.createElement("option");
        opt.value = item;
        opt.textContent = item;
        control.appendChild(opt);
      }
      control.value = value || "";
    } else {
      control = document.createElement("input");
      control.type = type === "email" ? "email" : type === "number" ? "number" : type === "date" ? "text" : "text";
      if (type === "date") control.placeholder = "dd/mm/yyyy";
      control.value = value || "";
    }
  }

  control.dataset.field = field;
  control.dataset.type = type;
  wrap.appendChild(control);
  return wrap;
}

function openAddContactModal(targetInput) {
  const inner = document.createElement("div");
  inner.className = "modal-backdrop";
  inner.style.zIndex = "60";
  inner.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h2>Add Hotel / Host Address</h2>
      <div class="modal-grid">
        <div class="field"><label>Hotel / Host Name</label><input data-c="contact_name" /></div>
        <div class="field"><label>Phone</label><input data-c="contact_phone" /></div>
        <div class="field field-full"><label>Address</label><input data-c="contact_address" /></div>
        <div class="field"><label>City</label><input data-c="contact_city" /></div>
        <div class="field"><label>State</label><input data-c="contact_state" /></div>
        <div class="field field-full"><label>Email</label><input data-c="contact_email" /></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cancelContactBtn">Cancel</button>
        <button class="btn btn-primary" id="saveContactBtn">Save Hotel / Host</button>
      </div>
    </div>
  `;
  document.body.appendChild(inner);

  inner.querySelector("#cancelContactBtn").addEventListener("click", () => inner.remove());
  inner.addEventListener("click", (e) => {
    if (e.target === inner) inner.remove();
  });
  inner.querySelector("#saveContactBtn").addEventListener("click", async () => {
    const record = {};
    inner.querySelectorAll("[data-c]").forEach((input) => {
      record[input.dataset.c] = input.value;
    });
    if (!record.contact_name?.trim()) {
      alert("Contact name is required.");
      return;
    }
    const res = await fetch(`${API}/api/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...record, _is_new: isNew }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Could not save contact");
      return;
    }
    await loadLookups();
    if (targetInput) targetInput.value = record.contact_name;
    inner.remove();
  });
}

// ---------------- Quick Fill (paste-and-autofill) ----------------

const QUICK_FILL_AIRLINE_PREFIXES = {
  TK: "Turkish Airlines", QR: "Qatar Airways", ET: "Ethiopian Airlines",
  BA: "British Airways", LH: "Lufthansa", EK: "Emirates", KL: "KLM",
  AF: "Air France", MS: "EgyptAir", SN: "Brussels Airlines", WB: "RwandAir",
  KQ: "Kenya Airways", P4: "Air Peace", Q9: "Ibom Air", VM: "Max Air",
  W3: "Arik Air", N2: "Aero Contractors", AJ: "Azman Air", VS: "Virgin Atlantic",
  AT: "Royal Air Maroc", KP: "ASKY Airlines", HF: "Air Côte d’Ivoire", AW: "Africa World Airlines",
  SV: "Saudia", DL: "Delta Air Lines", UA: "United Airlines", SA: "South African Airways",
};

const QUICK_FILL_TITLES = {
  mr: "Mr.", mister: "Mr.", mrs: "Mrs.", missus: "Mrs.", miss: "Miss",
  ms: "Ms.", master: "Master", dr: "Doctor", doctor: "Doctor",
  prof: "Prof.", professor: "Prof.",
};

function normalizeTitle(value) {
  const key = String(value || "").trim().replace(/\.+$/, "").toLowerCase();
  return QUICK_FILL_TITLES[key] || "";
}

function formatDisplayDate(day, month, year) {
  const d = Number(day), m = Number(month), y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return "";
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const candidate = new Date(Date.UTC(y, m - 1, d));
  if (candidate.getUTCFullYear() !== y || candidate.getUTCMonth() !== m - 1 || candidate.getUTCDate() !== d) return "";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

const MONTH_NAME_MAP = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

// Accepts yyyy-mm-dd, dd/mm/yyyy, "2 Feb 1990", "February 2, 1990", etc. and
// always normalizes to the DD/MM/YYYY format the portal (and this form) uses.
function expandTwoDigitYear(yy) {
  const n = Number(yy);
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  const currentYearTwoDigits = new Date().getFullYear() % 100;
  // Same windowing convention used by spreadsheet apps: 00 up to ~10 years
  // past the current year's two digits rolls into the 2000s, everything
  // else is treated as 1900s. Keeps birth dates and near-term expiry dates
  // resolving to the century a person would actually expect.
  return n <= currentYearTwoDigits + 10 ? 2000 + n : 1900 + n;
}

function normalizeFlexibleDate(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  text = text.replace(/,/g, " ").replace(/\s+/g, " ").trim();

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return formatDisplayDate(Number(match[3]), Number(match[2]), Number(match[1]));

  match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (match) return formatDisplayDate(Number(match[1]), Number(match[2]), Number(match[3]));

  // dd-mm-yy / dd/mm/yy / dd.mm.yy — 2-digit year, e.g. 1-1-20
  match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2})$/);
  if (match) {
    const year = expandTwoDigitYear(match[3]);
    if (year === null) return "";
    return formatDisplayDate(Number(match[1]), Number(match[2]), year);
  }

  match = text.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]+)[\s\-/.]+(\d{4})$/);
  if (match) {
    const month = MONTH_NAME_MAP[match[2].toLowerCase()];
    if (!month) return "";
    return formatDisplayDate(Number(match[1]), month, Number(match[3]));
  }

  // 1-Jan-20 — month name with 2-digit year
  match = text.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]+)[\s\-/.]+(\d{2})$/);
  if (match) {
    const month = MONTH_NAME_MAP[match[2].toLowerCase()];
    if (!month) return "";
    const year = expandTwoDigitYear(match[3]);
    if (year === null) return "";
    return formatDisplayDate(Number(match[1]), month, year);
  }

  match = text.match(/^([A-Za-z]+)[\s\-/.]+(\d{1,2})[\s\-/.]+(\d{4})$/);
  if (match) {
    const month = MONTH_NAME_MAP[match[1].toLowerCase()];
    if (!month) return "";
    return formatDisplayDate(Number(match[2]), month, Number(match[3]));
  }

  return "";
}

function normalizeFlightNumber(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function detectCarrierFromFlightNumber(value) {
  const flightNumber = normalizeFlightNumber(value);
  if (!flightNumber) return "";

  const exact = (lookups.flights || []).find((f) => normalizeFlightNumber(f.flight_number) === flightNumber);
  if (exact?.carrier_name) return String(exact.carrier_name).trim();

  const prefixMatch = flightNumber.match(/^([A-Z0-9]{2})/);
  if (!prefixMatch) return "";
  const expected = QUICK_FILL_AIRLINE_PREFIXES[prefixMatch[1]] || "";
  if (!expected) return "";

  const saved = (lookups.carriers || []).find((carrier) => {
    const a = String(carrier || "").trim().toLowerCase();
    const b = expected.toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  });
  return saved || expected;
}

function contactMatchScore(contactName, query) {
  const name = String(contactName || "").trim().toLowerCase();
  const needle = String(query || "").trim().toLowerCase();
  if (!name || !needle) return -1;
  if (name === needle) return 1000;
  if (name.startsWith(needle)) return 900 - (name.length - needle.length);
  const word = name.split(/\s+/).find((part) => part.startsWith(needle));
  if (word) return 800 - (word.length - needle.length);
  const at = name.indexOf(needle);
  if (at >= 0) return 700 - at;

  let cursor = 0;
  for (const char of name) {
    if (char === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return 500 - (name.length - needle.length);
  }
  return -1;
}

function findContactMatches(query) {
  return (lookups.contacts || [])
    .map((contact) => ({ contact, score: contactMatchScore(contact.contact_name, query) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.contact.contact_name.localeCompare(b.contact.contact_name))
    .map((entry) => entry.contact);
}

function resolveCountryFromPrefix(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const needle = raw.toLowerCase();
  const countries = lookups.countries || [];
  const exact = countries.find((country) => String(country).toLowerCase() === needle);
  if (exact) return exact;
  if (needle.length < 3) return "";
  const matches = countries.filter((country) => String(country).toLowerCase().startsWith(needle));
  return matches.length === 1 ? matches[0] : "";
}

function buildQuickFillPanel(grid, fieldEl) {
  const panel = document.createElement("div");
  panel.className = "quick-fill-panel";
  panel.innerHTML = `
    <div class="quick-fill-heading">
      <h3>Quick Fill</h3>
      <p class="muted small">Enter or paste one value per line, then press Ctrl+Enter or Auto Fill Applicant Form.</p>
    </div>
    <textarea class="quick-fill-textarea" rows="11" spellcheck="false" placeholder="1. Title
2. Surname
3. First Name
4. Middle Name
5. Date of Birth
6. Place of Birth
7. Passport Number
8. Passport Expiry Date
9. Flight Number
10. Contact name or characters
11. Nationality (first 3+ letters accepted)"></textarea>
    <div class="quick-fill-actions">
      <button type="button" class="btn btn-primary btn-sm" id="quickFillApply">Auto Fill Applicant Form</button>
      <button type="button" class="btn btn-ghost btn-sm" id="quickFillClear">Clear</button>
      <select class="quick-contact-suggestion hidden" id="quickFillContactSuggestion" aria-label="Choose matching contact"></select>
      <span class="quick-fill-status muted small" id="quickFillStatus"></span>
    </div>
  `;
  grid.parentElement.insertBefore(panel, grid);

  const textarea = panel.querySelector(".quick-fill-textarea");
  const applyBtn = panel.querySelector("#quickFillApply");
  const clearBtn = panel.querySelector("#quickFillClear");
  const contactSuggestion = panel.querySelector("#quickFillContactSuggestion");
  const status = panel.querySelector("#quickFillStatus");

  const setField = (field, value) => {
    const el = fieldEl(field);
    if (!el) return;
    el.value = String(value || "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const resolveQuickContact = (query) => {
    contactSuggestion.replaceChildren();
    contactSuggestion.classList.add("hidden");
    const matches = findContactMatches(query);
    if (!matches.length) return null;
    if (matches.length === 1 || contactMatchScore(matches[0].contact_name, query) >= 900) {
      return matches[0];
    }
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Choose contact...";
    contactSuggestion.appendChild(blank);
    matches.slice(0, 10).forEach((contact, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = contact.contact_name;
      option._contact = contact;
      contactSuggestion.appendChild(option);
    });
    contactSuggestion.classList.remove("hidden");
    return null;
  };

  const applyContact = (contact) => {
    setField("contact_name", contact.contact_name);
    setField("contact_phone", contact.contact_phone);
    setField("contact_address", contact.contact_address);
    setField("contact_city", contact.contact_city);
    setField("contact_state", contact.contact_state);
    setField("contact_email", contact.contact_email);
  };

  const applyQuickFill = () => {
    const lines = String(textarea.value || "").split(/\r?\n/).map((l) => l.trim());
    while (lines.length < 11) lines.push("");
    const [titleValue, surnameValue, firstNameValue, middleNameValue, dobValue,
      birthPlaceValue, passportValue, expiryValue, flightValue, contactQuery, nationalityValue] = lines;

    const normalizedDob = dobValue ? normalizeFlexibleDate(dobValue) : "";
    const normalizedExpiry = expiryValue ? normalizeFlexibleDate(expiryValue) : "";
    const normalizedFlight = normalizeFlightNumber(flightValue);

    if (titleValue) setField("title", normalizeTitle(titleValue) || titleValue);
    if (surnameValue) {
      setField("surname", surnameValue);
      const applicationId = fieldEl("application_id");
      if (applicationId && !String(applicationId.value || "").trim()) {
        setField("application_id", surnameValue);
      }
    }
    if (firstNameValue) setField("first_name", firstNameValue);
    if (middleNameValue) setField("other_names", middleNameValue);
    if (dobValue) setField("date_of_birth", normalizedDob || dobValue);
    if (birthPlaceValue) setField("place_of_birth", birthPlaceValue);
    if (passportValue) setField("passport_number", passportValue.toUpperCase());
    if (expiryValue) setField("passport_expiry_date", normalizedExpiry || expiryValue);
    if (normalizedFlight) {
      setField("flight_number", normalizedFlight);
      const carrier = detectCarrierFromFlightNumber(normalizedFlight);
      if (carrier) setField("travel_carrier", carrier);
    }

    if (nationalityValue) {
      const nationality = resolveCountryFromPrefix(nationalityValue);
      if (nationality) {
        setField("nationality", nationality);
        setField("country_of_departure", nationality);
      }
    }

    if (contactQuery) {
      const matched = resolveQuickContact(contactQuery);
      if (matched) applyContact(matched);
    } else {
      contactSuggestion.classList.add("hidden");
    }

    const warnings = [];
    if (dobValue && !normalizedDob) warnings.push("Date of Birth format needs attention");
    if (expiryValue && !normalizedExpiry) warnings.push("Passport Expiry format needs attention");
    if (nationalityValue && !resolveCountryFromPrefix(nationalityValue)) warnings.push("Nationality is ambiguous or not recognized");
    status.textContent = warnings.length ? `Filled with warning: ${warnings.join("; ")}.` : "Applicant form filled successfully.";
    setTimeout(() => { status.textContent = ""; }, 4000);
  };

  applyBtn.addEventListener("click", applyQuickFill);
  clearBtn.addEventListener("click", () => {
    if (textarea.value && !confirm("Clear all Quick Fill text?")) return;
    textarea.value = "";
    contactSuggestion.classList.add("hidden");
    status.textContent = "";
    textarea.focus();
  });
  contactSuggestion.addEventListener("change", () => {
    const option = contactSuggestion.selectedOptions?.[0];
    if (option?._contact) {
      applyContact(option._contact);
      status.textContent = `Contact selected: ${option._contact.contact_name}`;
      contactSuggestion.classList.add("hidden");
    }
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      applyQuickFill();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      clearBtn.click();
    }
  });
}

function openEditModal(id) {
  const applicant = applicants.find((a) => a.application_id === id) || {};
  const isNew = !id;

  modal.innerHTML = `
    <h2>${isNew ? "Add Applicant" : `Edit ${id}`}</h2>
    <div class="modal-grid" id="fieldGrid"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">Save</button>
    </div>
  `;

  const grid = modal.querySelector("#fieldGrid");
  const context = {
    carrier: applicant.travel_carrier || "",
    arrivalChannel: applicant.arrival_channel || "",
  };

  for (const [key, label, type] of APPLICANT_FIELDS) {
    let initialValue = applicant[key] || "";
    if (key === "marital_status" && !initialValue) initialValue = "Single";
    if (key === "arrival_channel" && !initialValue) initialValue = "Air";
    if (key === "has_nigerian_passport" && !initialValue) initialValue = "No";
    if (key === "passport_type" && !initialValue) initialValue = "Standard";
    if (key === "gender" && !initialValue) initialValue = "Male";
    let control;
    if (key === "application_id" && isNew) {
      control = document.createElement("label");
      control.className = "field";
      const options = clients.map((c) =>
        `<option value="${String(c.client_code || "").replace(/"/g, "&quot;")}">${c.client_code}${c.client_name ? ` — ${c.client_name}` : ""}</option>`
      ).join("");
      control.innerHTML = `<span>Application ID / Client</span>
        <select data-field="application_id">
          <option value="">Select saved client…</option>${options}
        </select>
        <small class="muted">The serial number is added automatically when saved.</small>`;
    } else {
      control = createApplicantControl(key, label, type, initialValue, context);
      if (key === "application_id" && !isNew) {
        control.querySelector("input,select,textarea").disabled = true;
      }
    }
    grid.appendChild(control);
  }

  const fieldEl = (key) => grid.querySelector(`[data-field="${key}"]`);
  buildQuickFillPanel(grid, fieldEl);

  // Make incomplete required applicant fields immediately obvious. Optional
  // fields stay neutral; red clears as soon as a value is entered/selected.
  const optionalApplicantFields = new Set(["other_names", "postal_code", "notes", "status"]);
  const refreshRequiredHighlights = () => {
    for (const [key] of APPLICANT_FIELDS) {
      const el = fieldEl(key);
      if (!el) continue;
      const wrapper = el.closest(".field");
      if (!wrapper) continue;
      const empty = !optionalApplicantFields.has(key) && !String(el.value || "").trim();
      wrapper.classList.toggle("required-empty", empty);
    }
  };
  grid.addEventListener("input", refreshRequiredHighlights);
  grid.addEventListener("change", refreshRequiredHighlights);
  refreshRequiredHighlights();

  // ---- Cross-field defaults, mirrored from the desktop applicant editor ----

  // Title -> autoselect Gender
  fieldEl("title")?.addEventListener("change", (e) => {
    const gender = fieldEl("gender");
    if (!gender) return;
    if (["Mr.", "Master"].includes(e.target.value)) gender.value = "Male";
    if (["Mrs.", "Miss", "Ms."].includes(e.target.value)) gender.value = "Female";
  });

  // Nationality -> Country of Departure (always mirrors nationality when it
  // changes; this is one-way, so manually editing Country of Departure
  // afterwards never changes Nationality back).
  fieldEl("nationality")?.addEventListener("change", (e) => {
    const departureCountry = fieldEl("country_of_departure");
    if (departureCountry) departureCountry.value = e.target.value;
  });

  // Arrival Date mirrors Departure Date (read-only, like the desktop form)
  const departureDateInput = fieldEl("departure_date");
  const arrivalDateInput = fieldEl("arrival_date");
  const syncArrival = () => {
    if (!departureDateInput || !arrivalDateInput) return;
    arrivalDateInput.value = departureDateInput.value;
    arrivalDateInput.readOnly = true;
    // Lets arrival's own date-picker input and min-date hint/validation
    // (set up inside its own createApplicantControl closure) pick up the
    // mirrored value too, instead of only updating the visible text.
    arrivalDateInput.dispatchEvent(new Event("change", { bubbles: true }));
  };
  departureDateInput?.addEventListener("input", syncArrival);
  syncArrival();

  // Visa Category -> suggest Purpose of Journey
  const visaCategoryEl = fieldEl("visa_category");
  const purposeEl = fieldEl("purpose_of_journey");
  const suggestPurpose = () => {
    const code = String(visaCategoryEl?.value || "").trim().toUpperCase();
    let suggestion = "";
    if (code.startsWith("F4A") || code.startsWith("F4B")) suggestion = "BUSINESS";
    else if (code.startsWith("F5A")) suggestion = "TOUR";
    else if (code.startsWith("F6A")) suggestion = "VISITING";
    if (suggestion && purposeEl) purposeEl.value = suggestion;
  };
  visaCategoryEl?.addEventListener("change", suggestPurpose);

  // Arrival Channel -> filter Port of Entry options
  const arrivalChannelEl = fieldEl("arrival_channel");
  arrivalChannelEl?.addEventListener("change", () => {
    const portField = fieldEl("port_of_entry");
    if (!portField) return;
    const replacement = createApplicantControl(
      "port_of_entry",
      "Port of Entry",
      "port",
      "",
      { arrivalChannel: arrivalChannelEl.value }
    );
    portField.closest(".field").replaceWith(replacement);
  });

  // Travel Carrier -> filter Flight Number suggestions
  const carrierEl = fieldEl("travel_carrier");
  carrierEl?.addEventListener("change", () => {
    const flightField = fieldEl("flight_number");
    if (!flightField) return;
    const replacement = createApplicantControl(
      "flight_number",
      "Flight Number",
      "flight",
      flightField.value,
      { carrier: carrierEl.value }
    );
    flightField.closest(".field").replaceWith(replacement);
  });

  // Contact Name -> autofill contact address fields when it matches a saved contact
  fieldEl("contact_name")?.addEventListener("change", (e) => {
    const match = (lookups.contacts || []).find(
      (c) => c.contact_name.toLowerCase() === String(e.target.value || "").trim().toLowerCase()
    );
    if (!match) return;
    for (const key of ["contact_phone", "contact_address", "contact_city", "contact_state", "contact_email"]) {
      const el = fieldEl(key);
      if (el) el.value = match[key] || "";
    }
  });

  modal.querySelector("#cancelBtn").addEventListener("click", closeModal);
  modal.querySelector("#saveBtn").addEventListener("click", async () => {
    const record = {};
    grid.querySelectorAll("[data-field]").forEach((el) => {
      record[el.dataset.field] = el.value;
    });
    if (!record.application_id) {
      alert(isNew ? "Select a saved client for Application ID." : "Application ID is required.");
      return;
    }
    record._is_new = isNew;
    const res = await fetch(`${API}/api/applicants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Save failed");
      return;
    }
    // The backend may add the sequential -001/-002 suffix for a new application.
    const savedRecord = await res.json();
    const savedId = savedRecord.application_id || record.application_id;
    await loadApplicants();
    closeModal();
    await openAssignModal(savedId);
  });

  backdrop.classList.remove("hidden");
}

document.getElementById("addApplicantBtn").addEventListener("click", () => openEditModal(null));

// ---------------- Assign documents ----------------

// Mirrors the desktop app's maxUploadBytes(): PDFs may be up to 1.5MB,
// every other document type up to 1MB, matching the live portal's caps.
function maxUploadBytes(filename) {
  return String(filename || "").toLowerCase().endsWith(".pdf") ? 1.5 * 1024 * 1024 : 1024 * 1024;
}

// Mirrors the desktop app's labelsForVisa(): each visa category has its own
// ordered list of document labels (same order as document_rules.json /
// the portal's upload positions for that category). Unknown categories fall
// back to generic position labels, same as the desktop app.
function labelsForVisa(visaCategory) {
  const configured = (lookups.documentLabelsByVisa || {})[String(visaCategory || "").trim()];
  if (configured) return configured.map((label, i) => ({ position: i + 1, label }));
  return Array.from({ length: 7 }, (_, i) => ({ position: i + 1, label: `Portal Upload Position ${i + 1}` }));
}

function preferredFilenameForDocumentLabel(label, files) {
  const text = String(label || "").toLowerCase();
  const byLower = new Map(files.map((f) => [String(f.name || "").toLowerCase(), f.name]));

  const exact = (name) => byLower.get(String(name).toLowerCase()) || "";
  const firstExisting = (names) => {
    for (const name of names) {
      const hit = exact(name);
      if (hit) return hit;
    }
    return "";
  };

  if (/valid\s*passport/.test(text)) {
    return exact("ppt.pdf");
  }
  if (/cac/.test(text)) {
    return exact("cac.pdf");
  }
  if (/passport\s*(size\s*)?(photo|photograph)|(?:photo|photograph).*passport/.test(text)) {
    return firstExisting(["photo.jpg", "photo.jpeg", "photo.png"]);
  }
  if (/invitation/.test(text)) {
    return exact("app.pdf");
  }
  if (/return\s*ticket|ticket/.test(text)) {
    return exact("tk.pdf");
  }
  if (/hotel\s*reservation|hotel/.test(text)) {
    return exact("hotel.pdf");
  }
  if (/host|residency\s*permit|nigerian\s*passport.*host/.test(text)) {
    return exact("host.pdf");
  }
  if (/sufficient\s*funds|bank\s*statement|evidence.*funds/.test(text)) {
    return exact("bank.pdf");
  }
  return "";
}

function autoAssignKnownDocuments(labels, files, positions) {
  const alreadyAssigned = new Set(positions.filter(Boolean));
  let changed = false;

  for (const item of labels) {
    const index = item.position - 1;
    if (positions[index]) continue;

    const preferred = preferredFilenameForDocumentLabel(item.label, files);
    if (!preferred || alreadyAssigned.has(preferred)) continue;

    positions[index] = preferred;
    alreadyAssigned.add(preferred);
    changed = true;
  }
  return changed;
}

// ---------------- Photo crop editor (mirrors the desktop app's Cropper.js tool) ----------------

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

function isImageFile(filename) {
  const ext = String(filename || "").split(".").pop().toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function openCropEditor(applicantId, filename, onSaved) {
  const overlay = document.createElement("div");
  overlay.className = "modal-backdrop";
  overlay.style.zIndex = "70";
  overlay.innerHTML = `
    <div class="modal crop-modal">
      <h2>Crop Photograph — ${filename}</h2>
      <p class="muted small" id="cropNote">Position and crop the photograph. Saving will overwrite the original file with an exact 600 × 600 px image.</p>
      <div class="crop-stage"><img id="cropImage" alt="Document to crop" /></div>
      <div class="crop-mode-group">
        <label><input type="radio" name="cropMode" value="passport" checked /> Passport Photo (square, 600 × 600)</label>
        <label><input type="radio" name="cropMode" value="free" /> Free Crop</label>
      </div>
      <div class="crop-tools">
        <button type="button" class="btn btn-ghost btn-sm" id="cropRotateLeft">⟲ Rotate</button>
        <button type="button" class="btn btn-ghost btn-sm" id="cropRotateRight">⟳ Rotate</button>
        <button type="button" class="btn btn-ghost btn-sm" id="cropZoomIn">Zoom +</button>
        <button type="button" class="btn btn-ghost btn-sm" id="cropZoomOut">Zoom −</button>
        <button type="button" class="btn btn-ghost btn-sm" id="cropReset">Reset</button>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="cropCancelBtn">Cancel</button>
        <button type="button" class="btn btn-primary" id="cropSaveBtn">Save (Overwrite)</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const img = overlay.querySelector("#cropImage");
  const note = overlay.querySelector("#cropNote");
  let cropperInstance = null;
  let mode = "passport";

  function applyPassportCropBox() {
    if (!cropperInstance) return;
    cropperInstance.setAspectRatio(1);
    const container = cropperInstance.getContainerData();
    const size = Math.min(container.width * 0.72, container.height * 0.72, 450);
    cropperInstance.setCropBoxData({
      width: size,
      height: size,
      left: Math.max(0, (container.width - size) / 2),
      top: Math.max(0, (container.height - size) / 2),
    });
  }

  function initCropper() {
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
    cropperInstance = new Cropper(img, {
      viewMode: 1,
      dragMode: "move",
      autoCropArea: mode === "passport" ? 0.82 : 0.9,
      aspectRatio: mode === "passport" ? 1 : NaN,
      background: true,
      responsive: true,
      restore: false,
      checkOrientation: true,
      ready() {
        if (mode === "passport") applyPassportCropBox();
      },
    });
  }

  img.onload = initCropper;
  img.src = `${API}/api/applicants/${encodeURIComponent(applicantId)}/documents/${encodeURIComponent(filename)}/raw?t=${Date.now()}`;

  overlay.querySelectorAll('input[name="cropMode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      mode = e.target.value;
      note.textContent =
        mode === "passport"
          ? "Position and crop the photograph. Saving will overwrite the original file with an exact 600 × 600 px image."
          : "Free-crop this image, rotate or zoom as needed, then save to overwrite the original.";
      initCropper();
    });
  });

  overlay.querySelector("#cropRotateLeft").addEventListener("click", () => cropperInstance?.rotate(-90));
  overlay.querySelector("#cropRotateRight").addEventListener("click", () => cropperInstance?.rotate(90));
  overlay.querySelector("#cropZoomIn").addEventListener("click", () => cropperInstance?.zoom(0.1));
  overlay.querySelector("#cropZoomOut").addEventListener("click", () => cropperInstance?.zoom(-0.1));
  overlay.querySelector("#cropReset").addEventListener("click", () => {
    cropperInstance?.reset();
    if (mode === "passport") applyPassportCropBox();
  });

  function closeCropEditor() {
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
    overlay.remove();
  }

  overlay.querySelector("#cropCancelBtn").addEventListener("click", closeCropEditor);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeCropEditor();
  });

  overlay.querySelector("#cropSaveBtn").addEventListener("click", async () => {
    if (!cropperInstance) return;
    const saveBtn = overlay.querySelector("#cropSaveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const options =
        mode === "passport"
          ? { width: 600, height: 600, fillColor: "#ffffff", imageSmoothingEnabled: true, imageSmoothingQuality: "high" }
          : { maxWidth: 2200, maxHeight: 2200, fillColor: "#ffffff", imageSmoothingEnabled: true, imageSmoothingQuality: "high" };
      const canvas = cropperInstance.getCroppedCanvas(options);
      if (!canvas) throw new Error("The cropped image could not be generated.");
      const ext = String(filename).split(".").pop().toLowerCase();
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, 0.92);

      const res = await fetch(`${API}/api/applicants/${encodeURIComponent(applicantId)}/documents/${encodeURIComponent(filename)}/crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not save cropped image");
      }
      closeCropEditor();
      onSaved?.();
    } catch (error) {
      alert(error.message || "Could not save cropped image");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save (Overwrite)";
    }
  });
}

async function openAssignModal(id) {
  const applicant = applicants.find((a) => a.application_id === id) || {};
  const res = await fetch(`${API}/api/applicants/${encodeURIComponent(id)}/documents`);
  const data = await res.json();
  const positions = data.assignment?.upload_positions || [];
  const labels = labelsForVisa(applicant.visa_category);
  let currentFiles = data.files || [];

  modal.innerHTML = `
    <h2>Assign Documents — ${id}</h2>
    <p class="muted small">${applicant.visa_category || "No visa category set"}</p>
    <label class="file-btn btn btn-ghost" style="margin-bottom:10px;">
      Choose Folder…
      <input type="file" id="docFolderInput" webkitdirectory directory multiple hidden />
    </label>
    <div id="folderImportStatus" class="folder-picker hidden"></div>
    <h3 style="font-size:13px;margin:14px 0 6px;color:var(--muted);">Document positions for this visa type</h3>
    <p class="muted small" style="margin:0 0 8px;">Choose a folder once. Known filenames are assigned automatically; you can still change any dropdown manually. Press Tab to move to the next document field.</p>
    <div id="positionRows"></div>
    <div id="otherFilesSection"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancelBtn">Close</button>
      <button class="btn btn-danger" id="clearDocsBtn">Clear Documents</button>
      <button class="btn btn-primary" id="saveAssignBtn">Save Assignment</button>
    </div>
  `;

  function renderFiles(files, focusPosition = null) {
    currentFiles = files;

    // Automatically place conventionally named documents into the matching
    // visa-specific assignment slots. Existing/manual assignments are kept.
    autoAssignKnownDocuments(labels, files, positions);

    const positionRows = modal.querySelector("#positionRows");
    positionRows.innerHTML = "";
    for (const item of labels) {
      const i = item.position - 1;
      const row = document.createElement("div");
      row.className = "doc-position-row";
      const selectedElsewhere = new Set(positions.filter((f, idx) => idx !== i && f));
      const availableFiles = files.filter((f) => f.name === positions[i] || !selectedElsewhere.has(f.name));
      const options = ["<option value=\"\">— Leave blank —</option>"]
        .concat(
          availableFiles.map((f) => {
            const tooLarge = f.size > maxUploadBytes(f.name);
            return `<option value="${f.name}" ${positions[i] === f.name ? "selected" : ""} ${tooLarge ? "disabled" : ""}>${f.name} (${(f.size / 1024).toFixed(0)} KB)${tooLarge ? " — TOO LARGE" : ""}</option>`;
          })
        )
        .join("");
      const assigned = files.find((f) => f.name === positions[i]);
      const actions = assigned
        ? `<span class="doc-position-row-actions">
            ${isImageFile(assigned.name) ? `<button class="btn btn-sm btn-ghost" tabindex="-1" data-crop="${assigned.name}">Crop</button>` : ""}
            <button class="btn btn-sm btn-ghost" tabindex="-1" data-remove="${assigned.name}">Remove</button>
          </span>`
        : "";
      // The selects are deliberately the only Tab stops inside the assignment
      // grid. This gives a predictable keyboard flow: position 1 -> 2 -> 3...
      row.innerHTML = `<span><strong>${item.position}. ${item.label}</strong></span><span class="doc-position-row-select"><select data-pos="${i}" tabindex="${item.position}">${options}</select>${actions}</span>`;
      positionRows.appendChild(row);
    }

    positionRows.querySelectorAll("[data-pos]").forEach((select) => {
      select.addEventListener("change", () => {
        const idx = Number(select.dataset.pos);
        positions[idx] = select.value;
        // Rebuild availability so one file cannot be assigned twice, but
        // restore focus to the field the user just changed. Their next Tab
        // therefore goes to the following document position.
        renderFiles(files, idx);
      });
    });

    positionRows.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await fetch(`${API}/api/applicants/${encodeURIComponent(id)}/documents/${encodeURIComponent(btn.dataset.remove)}`, { method: "DELETE" });
        const removedName = btn.dataset.remove;
        for (let i = 0; i < positions.length; i += 1) {
          if (positions[i] === removedName) positions[i] = "";
        }
        refresh();
      });
    });

    positionRows.querySelectorAll("[data-crop]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openCropEditor(id, btn.dataset.crop, refresh);
      });
    });

    // Every uploaded file which is not assigned yet is shown immediately.
    const assignedNames = new Set(positions.filter(Boolean));
    const otherFiles = files.filter((f) => !assignedNames.has(f.name));
    const otherSection = modal.querySelector("#otherFilesSection");
    if (!otherFiles.length) {
      otherSection.innerHTML = "";
    } else {
      otherSection.innerHTML = `
        <h3 style="font-size:13px;margin:14px 0 6px;color:var(--muted);">Available files</h3>
        <div id="otherFileList"></div>
      `;
      const list = otherSection.querySelector("#otherFileList");
      list.innerHTML = otherFiles
        .map((f) => {
          const tooLarge = f.size > maxUploadBytes(f.name);
          return `
        <div class="doc-upload-row">
          <span>${f.name} <span class="muted">(${(f.size / 1024).toFixed(0)} KB)</span>${tooLarge ? ' <span class="pill pill-error">TOO LARGE</span>' : ""}</span>
          <span class="doc-upload-row-actions">
            ${isImageFile(f.name) ? `<button class="btn btn-sm btn-ghost" tabindex="-1" data-crop="${f.name}">Crop</button>` : ""}
            <button class="btn btn-sm btn-ghost" tabindex="-1" data-remove="${f.name}">Remove</button>
          </span>
        </div>`;
        })
        .join("");

      list.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await fetch(`${API}/api/applicants/${encodeURIComponent(id)}/documents/${encodeURIComponent(btn.dataset.remove)}`, { method: "DELETE" });
          refresh();
        });
      });

      list.querySelectorAll("[data-crop]").forEach((btn) => {
        btn.addEventListener("click", () => {
          openCropEditor(id, btn.dataset.crop, refresh);
        });
      });
    }

    if (focusPosition !== null) {
      requestAnimationFrame(() => {
        const target = positionRows.querySelector(`[data-pos="${focusPosition}"]`);
        target?.focus({ preventScroll: true });
      });
    }
  }

  async function refresh(focusPosition = null) {
    const r = await fetch(`${API}/api/applicants/${encodeURIComponent(id)}/documents`);
    const d = await r.json();
    renderFiles(d.files || [], focusPosition);
  }

  renderFiles(data.files || []);

  // Folder import is intentionally simple: choosing a folder immediately
  // uploads every valid new file from it. There is no second checkbox/select
  // screen. After upload, the files appear in Available files and in every
  // compatible assignment dropdown.
  const folderStatus = modal.querySelector("#folderImportStatus");
  modal.querySelector("#docFolderInput").addEventListener("change", async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;

    const seenNames = new Set();
    const existingNames = new Set(currentFiles.map((f) => f.name));
    const validNew = [];
    let duplicateCount = 0;
    let tooLargeCount = 0;

    for (const file of picked) {
      if (seenNames.has(file.name) || existingNames.has(file.name)) {
        duplicateCount += 1;
        continue;
      }
      seenNames.add(file.name);
      if (file.size > maxUploadBytes(file.name)) {
        tooLargeCount += 1;
        continue;
      }
      validNew.push(file);
    }

    folderStatus.classList.remove("hidden");
    if (!validNew.length) {
      folderStatus.innerHTML = `<p class="muted small" style="margin:0;">No new valid files to add.${duplicateCount ? ` ${duplicateCount} already listed.` : ""}${tooLargeCount ? ` ${tooLargeCount} too large.` : ""}</p>`;
      return;
    }

    folderStatus.innerHTML = `<p class="muted small" style="margin:0;">Adding ${validNew.length} file${validNew.length === 1 ? "" : "s"} from the selected folder…</p>`;
    try {
      // Backend accepts up to 40 files per request. Batch automatically so a
      // folder can contain 40 files (or more) without the whole import failing.
      const batchSize = 40;
      let added = 0;
      for (let start = 0; start < validNew.length; start += batchSize) {
        const batch = validNew.slice(start, start + batchSize);
        const formData = new FormData();
        batch.forEach((file) => formData.append("files", file));
        folderStatus.innerHTML = `<p class="muted small" style="margin:0;">Adding ${Math.min(start + batch.length, validNew.length)} of ${validNew.length} files from the selected folder…</p>`;
        const uploadRes = await fetch(`${API}/api/applicants/${encodeURIComponent(id)}/documents/upload`, { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error || "Could not add folder files");
        }
        added += batch.length;
      }
      await refresh(0);
      const uploadedNames = validNew.map((file) => file.name);
      appendLog(`[${id}] Uploaded ${added} document${added === 1 ? "" : "s"}: ${uploadedNames.join(", ")}`);
      folderStatus.innerHTML = `<p class="muted small" style="margin:0;">Added ${added} file${added === 1 ? "" : "s"}. They are listed below and ready to assign.${duplicateCount ? ` ${duplicateCount} already existed.` : ""}${tooLargeCount ? ` ${tooLargeCount} skipped as too large.` : ""}</p>`;
    } catch (error) {
      folderStatus.innerHTML = `<p class="small" style="margin:0;color:var(--danger);">${error.message || "Could not add folder files"}</p>`;
    }
  });

  modal.querySelector("#clearDocsBtn").addEventListener("click", async () => {
    if (!currentFiles.length) return;
    if (!confirm(`Clear all loaded documents for ${id}?`)) return;
    const clearRes = await fetch(`${API}/api/applicants/${encodeURIComponent(id)}/documents`, { method: "DELETE" });
    if (!clearRes.ok) {
      const err = await clearRes.json().catch(() => ({}));
      alert(err.error || "Could not clear documents");
      return;
    }
    positions.length = 0;
    currentFiles = [];
    renderFiles([]);
    folderStatus.classList.remove("hidden");
    folderStatus.innerHTML = `<p class="muted small" style="margin:0;">All loaded documents cleared.</p>`;
    appendLog(`[${id}] Cleared all loaded documents.`);
    await loadApplicants();
  });

  modal.querySelector("#cancelBtn").addEventListener("click", closeModal);
  modal.querySelector("#saveAssignBtn").addEventListener("click", async () => {
    const positionsOut = [];
    modal.querySelectorAll("[data-pos]").forEach((sel) => {
      positionsOut[Number(sel.dataset.pos)] = sel.value;
    });
    const saveRes = await fetch(`${API}/api/applicants/${encodeURIComponent(id)}/assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positions: positionsOut }),
    });
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}));
      alert(err.error || "Could not save document assignment");
      return;
    }

    await loadApplicants();

    // Step 3: immediately open the cropper for the document position whose
    // visa-specific label is the passport photograph. This follows the setup
    // flow: Applicant Form -> Document Assignment -> Crop Passport Photograph.
    const passportPhotoItem = labels.find((item) =>
      /passport\s*(size\s*)?(photo|photograph)|(?:photo|photograph).*passport/i.test(String(item.label || ""))
    );
    const passportPhotoName = passportPhotoItem ? positionsOut[passportPhotoItem.position - 1] : "";

    closeModal();
    if (passportPhotoName && isImageFile(passportPhotoName)) {
      openCropEditor(id, passportPhotoName, async () => {
        await loadApplicants();
      });
      return;
    }

    if (passportPhotoItem && !passportPhotoName) {
      alert(`Document assignment saved. To continue automatically to Crop Passport Photograph, assign an image to position ${passportPhotoItem.position}: ${passportPhotoItem.label}.`);
    } else if (passportPhotoName && !isImageFile(passportPhotoName)) {
      alert("Document assignment saved. The assigned passport photograph is not an image file, so the crop editor was not opened.");
    }
  });

  backdrop.classList.remove("hidden");
}

// ---------------- Browser / same-device engine ----------------

const browserStatus = document.getElementById("browserStatus");
const deviceStatus = document.getElementById("deviceStatus");
const launchBtn = document.getElementById("launchBrowserBtn");

function renderDeviceStatus() {
  const label = DEVICE_PLATFORM === "ios" ? "iPhone/iPad" : DEVICE_PLATFORM === "android" ? "Android" : "Desktop";
  deviceStatus.textContent = `Device: ${label}`;
  deviceStatus.className = "pill pill-done";
}

async function refreshBrowserStatus() {
  renderDeviceStatus();

  if (HOSTED_SERVER && DEVICE_PLATFORM === "desktop") {
    browserStatus.textContent = "Automation: Chrome/Edge device extension";
    browserStatus.className = "pill pill-done";
    launchBtn.textContent = "Use Device Extension";
    return;
  }

  if (IS_MOBILE_WEB) {
    browserStatus.textContent = "Automation: native app required";
    browserStatus.className = "pill pill-error";
    launchBtn.textContent = "Install/Open Native App";
    return;
  }

  if (IS_NATIVE_MOBILE) {
    browserStatus.textContent = "Automation: same-device mobile";
    browserStatus.className = "pill pill-done";
    launchBtn.textContent = "Open eVisa Portal";
    return;
  }

  const res = await fetch(`${API}/api/browser/status?platform=${encodeURIComponent(DEVICE_PLATFORM)}`, { headers: platformHeaders() });
  const data = await res.json();
  browserStatus.textContent = data.open ? "Automation: browser open" : "Automation: browser closed";
  browserStatus.className = "pill " + (data.open ? "pill-done" : "pill-muted");
  launchBtn.textContent = data.open ? "Close Browser" : "Open Browser";
}

launchBtn.addEventListener("click", async () => {
  if (HOSTED_SERVER && DEVICE_PLATFORM === "desktop") {
    window.open("https://evisa.immigration.gov.ng/", "_blank", "noopener");
    appendLog("Opened the official eVisa portal. The Device Browser helper will attach automatically when an applicant is queued.");
    return;
  }
  if (IS_MOBILE_WEB) {
    alert("Same-device automation on Android/iPhone requires the installed eVisa Assistant mobile app. A normal browser cannot control the portal or protected file uploads on the same phone.");
    return;
  }

  if (IS_NATIVE_MOBILE) {
    try {
      await window.EVisa.openPortal({});
    } catch (error) {
      alert(error.message || String(error));
    }
    return;
  }

  const res = await fetch(`${API}/api/browser/status?platform=${encodeURIComponent(DEVICE_PLATFORM)}`, { headers: platformHeaders() });
  const { open } = await res.json();
  const actionRes = await fetch(`${API}/api/browser/${open ? "close" : "launch"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...platformHeaders() },
    body: JSON.stringify({ platform: DEVICE_PLATFORM }),
  });
  if (!actionRes.ok) {
    const error = await actionRes.json().catch(() => ({}));
    alert(error.error || "Could not open the automation browser.");
  }
  refreshBrowserStatus();
});

// ---------------- Automation run ----------------

const runBoard = document.getElementById("runBoard");
const runCards = new Map();

function ensureRunCard(id) {
  if (runCards.has(id)) return runCards.get(id);
  const el = document.createElement("div");
  el.className = "run-card";
  el.innerHTML = `
    <div class="run-card-head"><strong>${id}</strong><span class="muted small state-label">Waiting…</span></div>
    <div class="page-steps">
      ${PAGE_LABELS.map((label) => `<span class="step-chip" data-name="${label}">${label}</span>`).join("")}
    </div>
  `;
  runBoard.prepend(el);
  runCards.set(id, el);
  return el;
}

function setStepState(card, pageNumber, state) {
  const chip = card.querySelectorAll(".step-chip")[pageNumber - 1];
  if (!chip) return;
  chip.classList.remove("active", "ok", "fail");
  if (state) chip.classList.add(state);
}

document.getElementById("runSelectedBtn").addEventListener("click", async () => {
  const ids = Array.from(selectedIds);
  if (!ids.length) {
    alert("Select at least one applicant in the Queue tab first.");
    return;
  }
  if (IS_MOBILE_WEB) {
    alert("This browser view is management-only. To meet your same-device requirement, run applicants from the installed eVisa Assistant mobile app on this phone.");
    return;
  }
  const startPageRaw = document.getElementById("startPageSelect").value;
  const startPage = startPageRaw === "auto" ? "auto" : Number(startPageRaw);

  runBoard.innerHTML = "";
  runCards.clear();
  ids.forEach((id) => ensureRunCard(id));

  document.getElementById("runSelectedBtn").classList.add("hidden");
  document.getElementById("stopRunBtn").classList.remove("hidden");

  if (IS_NATIVE_MOBILE) {
    try {
      for (const id of ids) {
        const applicant = applicants.find((item) => item.application_id === id);
        if (!applicant) continue;
        await window.EVisa.runApplicant({ applicant, startPage });
      }
    } catch (error) {
      alert(error.message || String(error));
      document.getElementById("runSelectedBtn").classList.remove("hidden");
      document.getElementById("stopRunBtn").classList.add("hidden");
    }
    return;
  }

  if (HOSTED_SERVER && DEVICE_PLATFORM === "desktop") {
    const res = await fetch(`${API}/api/device/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...platformHeaders() },
      body: JSON.stringify({ applicationIds: ids, startPage }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not queue the applicant for the device extension.");
      document.getElementById("runSelectedBtn").classList.remove("hidden");
      document.getElementById("stopRunBtn").classList.add("hidden");
    } else {
      appendLog(`Queued ${ids.length} applicant(s). Opening the official eVisa portal automatically…`);
      window.open("https://evisa.immigration.gov.ng/", "_blank", "noopener");
    }
    return;
  }

  await fetch(`${API}/api/automation/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...platformHeaders() },
    body: JSON.stringify({ applicationIds: ids, startPage, platform: DEVICE_PLATFORM }),
  });
});

document.getElementById("stopRunBtn").addEventListener("click", async () => {
  const stopBtn = document.getElementById("stopRunBtn");
  stopBtn.disabled = true;
  const oldText = stopBtn.textContent;
  stopBtn.textContent = "Stopping…";
  try {
    if (HOSTED_SERVER && DEVICE_PLATFORM === "desktop") {
      const res = await fetch(`${API}/api/device/jobs/cancel`, { method: "POST", headers: platformHeaders() });
      if (!res.ok) throw new Error("Could not stop device automation.");
      appendLog("Stop requested. The Chrome/Edge device worker will abort the active applicant immediately.");
      return;
    }
    if (IS_NATIVE_MOBILE) {
      await window.EVisa.stopAutomation().catch(() => {});
      return;
    }
    const res = await fetch(`${API}/api/automation/stop`, { method: "POST", headers: platformHeaders() });
    if (!res.ok) throw new Error("Could not stop automation.");
  } catch (error) {
    alert(error.message || String(error));
  } finally {
    // automation:done normally hides this button. If the event is delayed,
    // keep it usable rather than leaving a disabled control on screen.
    setTimeout(() => {
      if (!stopBtn.classList.contains("hidden")) {
        stopBtn.disabled = false;
        stopBtn.textContent = oldText;
      }
    }, 1500);
  }
});

socket.on("automation:progress", (evt) => {
  const card = ensureRunCard(evt.applicationId);
  const label = card.querySelector(".state-label");

  if (evt.type === "applicant-start") {
    card.classList.add("state-progress");
    label.textContent = "In progress…";
  } else if (evt.type === "page-start") {
    setStepState(card, evt.page, "active");
    label.textContent = `Page ${evt.page} — ${evt.name}`;
  } else if (evt.type === "page-complete") {
    setStepState(card, evt.page, "ok");
  } else if (evt.type === "page-retry") {
    label.textContent = `Retrying page ${evt.page} (attempt ${evt.attempt})`;
  } else if (evt.type === "page-error") {
    setStepState(card, evt.page, "fail");
    card.classList.remove("state-progress");
    card.classList.add("state-error");
    label.textContent = `Error on page ${evt.page}: ${evt.error}`;
  } else if (evt.type === "applicant-complete") {
    card.classList.remove("state-progress");
    card.classList.add("state-done");
    label.textContent = "Submitted";
  } else if (evt.type === "applicant-error") {
    card.classList.remove("state-progress");
    card.classList.add("state-error");
    label.textContent = evt.error;
  } else if (evt.type === "cancelled") {
    label.textContent = "Cancelled";
  }

  const progressDetails = [];
  if (evt.message) progressDetails.push(evt.message);
  if (Array.isArray(evt.uploaded) && evt.uploaded.length) progressDetails.push(`Uploaded: ${evt.uploaded.join(", ")}`);
  if (evt.error && !progressDetails.includes(evt.error)) progressDetails.push(evt.error);
  appendLog(`[${evt.applicationId}] ${evt.type}${progressDetails.length ? " — " + progressDetails.join(" — ") : ""}`, evt.type.includes("error") ? "error" : "");
});

socket.on("automation:done", () => {
  document.getElementById("runSelectedBtn").classList.remove("hidden");
  document.getElementById("stopRunBtn").classList.add("hidden");
  loadApplicants();
});

socket.on("automation:log", (evt) => appendLog(evt.message, evt.level === "error" ? "error" : ""));

function appendLog(text, cls = "") {
  const list = document.getElementById("logList");
  const line = document.createElement("div");
  line.className = "log-line " + cls;
  const time = new Date().toLocaleTimeString();
  line.textContent = `${time}  ${text}`;
  list.prepend(line);
}

// ---------------- Init ----------------

(async () => {
  await loadServerMode();
  await Promise.all([loadLookups(), loadApplicants()]);
  await refreshBrowserStatus();
})();

loadClients().catch(() => {});
