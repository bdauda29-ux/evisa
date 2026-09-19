const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");

const db = require("./db");
const { parseWorkbook } = require("./importer");
const browserManager = require("./browserManager");
const { createEngine, capabilitiesFor, normalizePlatform } = require("./automation/engineFactory");
const { passportPhotoPosition } = require("./automation/page2_biodata");

const PROJECT_ROOT = db.DATA_DIR; // documents/, screenshots/ live alongside the DB
const DOCUMENTS_DIR = path.join(PROJECT_ROOT, "documents");
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "screenshots");
const CONFIG_DIR = path.join(__dirname, "config");
fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const app = express();
app.use(cors());

// Optional HTTP Basic protection for hosted deployments. Set APP_PASSWORD in
// Railway; APP_USERNAME defaults to admin. Local use remains unchanged when
// APP_PASSWORD is not set.
if (process.env.APP_PASSWORD) {
  const expectedUser = process.env.APP_USERNAME || "admin";
  const expectedPass = process.env.APP_PASSWORD;
  app.use((req, res, next) => {
    const header = String(req.headers.authorization || "");
    if (header.startsWith("Basic ")) {
      try {
        const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
        const split = decoded.indexOf(":");
        const user = split >= 0 ? decoded.slice(0, split) : decoded;
        const pass = split >= 0 ? decoded.slice(split + 1) : "";
        if (user === expectedUser && pass === expectedPass) return next();
      } catch {}
    }
    res.set("WWW-Authenticate", 'Basic realm="eVisa Assistant"');
    return res.status(401).send("Authentication required");
  });
}

app.use(express.json({ limit: "10mb" }));
const IS_HOSTED = /^(1|true|yes)$/i.test(String(process.env.HOSTED_MODE || ""));
app.get("/api/health", (req, res) => res.json({ ok: true, hosted: IS_HOSTED, automationMode: IS_HOSTED ? "device-extension" : "local-playwright", deviceJobs: true, build: "web-perfect-v1-csv-sqlite-autoportal" }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let automationCancelled = false;

// ---------- Clients / Application ID prefixes ----------

app.get("/api/clients", (req, res) => {
  res.json(db.listClients());
});

app.post("/api/clients", (req, res) => {
  try {
    const record = db.upsertClient(req.body || {});
    res.json(record);
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

app.delete("/api/clients/:code", (req, res) => {
  try {
    db.deleteClient(req.params.code);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

// ---------- Applicants ----------

app.get("/api/applicants", (req, res) => {
  res.json(db.listApplicants());
});

app.post("/api/applicants", (req, res) => {
  try {
    const incoming = { ...(req.body || {}) };
    const requestedId = String(incoming.application_id || "").trim();
    if (!requestedId) return res.status(400).json({ error: "Application ID is required" });

    // The frontend explicitly tells us whether this is a new record. New
    // applications ALWAYS receive the next sequential suffix, even when a
    // legacy unsuffixed ID with the same name already exists. Matching is
    // case-insensitive: ASA, asa and AsA all share one sequence family.
    const isNew = incoming._is_new === true || incoming._is_new === "true";
    delete incoming._is_new;
    if (isNew) {
      incoming.application_id = db.nextSequentialApplicationId(requestedId);
    } else {
      const existing = db.getApplicant(requestedId);
      if (!existing) {
        // Compatibility for imports/older clients that do not send _is_new.
        incoming.application_id = db.nextSequentialApplicationId(requestedId);
      } else {
        // Keep the stored spelling/casing when editing an existing applicant.
        incoming.application_id = existing.application_id;
      }
    }
    const record = db.upsertApplicant(incoming);
    res.json(record);
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

app.delete("/api/applicants/:id", (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Application ID is required" });
    db.deleteApplicant(id);
    const folder = path.join(DOCUMENTS_DIR, id);
    if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
    res.json({ ok: true, application_id: id });
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

const importUpload = multer({ storage: multer.memoryStorage() });
app.post("/api/import", importUpload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const records = parseWorkbook(req.file.buffer);
    const result = db.bulkImport(records);
    res.json({ ...result, applicants: db.listApplicants() });
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

// ---------- CSV / SQLite save & load ----------

app.get("/api/export/csv", (req, res) => {
  try {
    const XLSX = require("xlsx");
    const rows = db.listApplicants();
    const sheet = XLSX.utils.json_to_sheet(rows, { header: db.APPLICANT_COLUMNS });
    const csv = XLSX.utils.sheet_to_csv(sheet);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="eVisa_Applicants.csv"');
    res.send("\uFEFF" + csv);
  } catch (error) { res.status(500).json({ error: String(error.message || error) }); }
});

app.get("/api/database/download", (req, res) => {
  try {
    const data = db.databaseBuffer();
    res.setHeader("Content-Type", "application/vnd.sqlite3");
    res.setHeader("Content-Disposition", 'attachment; filename="eVisa_Applicants.sqlite"');
    res.send(data);
  } catch (error) { res.status(500).json({ error: String(error.message || error) }); }
});

const sqliteUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
app.post("/api/database/load", sqliteUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No SQLite file uploaded" });
    const applicants = await db.loadDatabaseBuffer(req.file.buffer);
    res.json({ ok: true, loaded: applicants.length, applicants });
  } catch (error) { res.status(400).json({ error: String(error.message || error) }); }
});

// ---------- Config (fixed answers / document rules, ported as-is) ----------

function readConfig(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file), "utf8"));
  } catch {
    return null;
  }
}

app.get("/api/config", (req, res) => {
  res.json({
    fixedAnswers: readConfig("fixed_answers.json"),
    documentRules: readConfig("document_rules.json"),
  });
});

// ---------- Lookups (defined dropdowns, ported from the desktop app) ----------

app.get("/api/lookups", (req, res) => {
  const dropdowns = readConfig("dropdowns.json") || {};
  res.json({
    countries: db.listCountries(),
    carriers: db.listCarriers(),
    ports: db.listPorts(),
    flights: db.listFlights(),
    contacts: db.listContacts(),
    fixedLists: dropdowns.fixedLists || {},
    documentLabelsByVisa: dropdowns.documentLabelsByVisa || {},
    passportPhotoPositionByVisa: dropdowns.passportPhotoPositionByVisa || {},
  });
});

app.post("/api/contacts", (req, res) => {
  try {
    if (!req.body?.contact_name?.trim()) {
      return res.status(400).json({ error: "Contact name is required" });
    }
    const record = db.upsertContact(req.body);
    res.json(record);
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

// ---------- Documents & assignment ----------

function applicantFolder(id) {
  const folder = path.join(DOCUMENTS_DIR, id);
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, applicantFolder(req.params.id)),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // portal caps are ~1-1.5MB; 2MB gives headroom for the check below
});

app.get("/api/applicants/:id/documents", (req, res) => {
  const folder = applicantFolder(req.params.id);
  const files = fs
    .readdirSync(folder)
    .filter((f) => f !== "assignment.json")
    .map((name) => {
      const stat = fs.statSync(path.join(folder, name));
      return { name, size: stat.size };
    });

  let assignment = { upload_positions: [] };
  const assignmentPath = path.join(folder, "assignment.json");
  if (fs.existsSync(assignmentPath)) {
    try {
      assignment = JSON.parse(fs.readFileSync(assignmentPath, "utf8"));
    } catch {}
  }

  res.json({ files, assignment });
});

app.post("/api/applicants/:id/documents/upload", docUpload.array("files", 40), (req, res) => {
  const folder = applicantFolder(req.params.id);
  const files = fs.readdirSync(folder).filter((f) => f !== "assignment.json");
  res.json({ files });
});

app.delete("/api/applicants/:id/documents", (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const folder = applicantFolder(id);
    for (const name of fs.readdirSync(folder)) {
      const target = path.join(folder, name);
      if (fs.statSync(target).isFile()) fs.unlinkSync(target);
    }
    const update = { application_id: id };
    for (let i = 1; i <= 7; i++) update[`upload_position_${i}`] = "";
    db.upsertApplicant(update);
    res.json({ ok: true, files: [], assignment: { upload_positions: [] } });
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

app.delete("/api/applicants/:id/documents/:filename", (req, res) => {
  const folder = applicantFolder(req.params.id);
  const filePath = path.join(folder, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// Serves an uploaded document's raw bytes so the browser-side crop editor
// can load it into an <img> element.
app.get("/api/applicants/:id/documents/:filename/raw", (req, res) => {
  const folder = applicantFolder(req.params.id);
  const safeName = path.basename(String(req.params.filename || ""));
  const filePath = path.join(folder, safeName);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

// Overwrites an uploaded document with a cropped version (data URL from the
// browser-side Cropper.js editor), mirroring the desktop app's crop tool.
app.post("/api/applicants/:id/documents/:filename/crop", (req, res) => {
  try {
    const folder = applicantFolder(req.params.id);
    const safeName = path.basename(String(req.params.filename || ""));
    const filePath = path.join(folder, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });

    const dataUrl = String(req.body?.dataUrl || "");
    const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
    if (!match) return res.status(400).json({ error: "Invalid image data" });

    const buffer = Buffer.from(match[2], "base64");
    fs.writeFileSync(filePath, buffer);
    const stat = fs.statSync(filePath);
    res.json({ name: safeName, size: stat.size });
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

app.post("/api/applicants/:id/assignment", (req, res) => {
  const { positions } = req.body; // array of up to 7 filenames, blank for unused
  const folder = applicantFolder(req.params.id);
  const assignment = { upload_positions: positions, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(folder, "assignment.json"), JSON.stringify(assignment, null, 2));

  const update = { application_id: req.params.id };
  for (let i = 0; i < 7; i++) update[`upload_position_${i + 1}`] = positions[i] || "";
  const record = db.upsertApplicant(update);

  res.json({ ok: true, assignment, applicant: record });
});

// ---------- Platform / same-device automation capabilities ----------

app.get("/api/platform", (req, res) => {
  const requested = req.query.platform || req.get("x-evisa-platform") || req.get("user-agent") || "desktop";
  res.json(capabilitiesFor(requested));
});

function requestPlatform(req) {
  return normalizePlatform(req.body?.platform || req.get("x-evisa-platform") || req.get("user-agent") || "desktop");
}

// ---------- Browser session ----------

app.post("/api/browser/launch", async (req, res) => {
  if (IS_HOSTED) {
    return res.status(409).json({ error: "Hosted mode uses the Chrome/Edge Device Browser extension instead of Railway Chromium.", code: "DEVICE_EXTENSION_REQUIRED" });
  }
  try {
    const platform = requestPlatform(req);
    const engine = createEngine({ platform, projectRoot: PROJECT_ROOT, emit: (event, payload) => io.emit(event, payload) });
    await engine.launch({ headless: !!req.body?.headless });
    res.json({ ok: true, platform, engine: engine.id, sameDevice: engine.sameDevice });
  } catch (error) {
    res.status(error.code === "NATIVE_APP_REQUIRED" ? 409 : 500).json({
      error: String(error.message || error),
      code: error.code || "BROWSER_LAUNCH_FAILED",
    });
  }
});

app.post("/api/browser/close", async (req, res) => {
  await browserManager.closeBrowser();
  res.json({ ok: true });
});

app.get("/api/browser/status", (req, res) => {
  if (IS_HOSTED) return res.json({ open: false, platform: "desktop", deviceExtensionRequired: true, automationMode: "device-extension" });
  const platform = normalizePlatform(req.query.platform || req.get("x-evisa-platform") || req.get("user-agent") || "desktop");
  if (platform !== "desktop") {
    return res.json({ open: false, platform, delegatedToNativeApp: true });
  }
  res.json({ open: !!browserManager.getBrowser(), platform });
});

// ---------- Hosted device-browser job queue ----------

const DEVICE_JOBS_PATH = path.join(PROJECT_ROOT, "device-jobs.json");
let deviceJobs = [];
try {
  if (fs.existsSync(DEVICE_JOBS_PATH)) deviceJobs = JSON.parse(fs.readFileSync(DEVICE_JOBS_PATH, "utf8"));
  if (!Array.isArray(deviceJobs)) deviceJobs = [];
} catch { deviceJobs = []; }

function saveDeviceJobs() {
  try { fs.writeFileSync(DEVICE_JOBS_PATH, JSON.stringify(deviceJobs.slice(-250), null, 2)); } catch {}
}

function publicBase(req) {
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  return `${proto}://${req.get("host")}`;
}

function devicePayload(req, record) {
  const applicant = buildApplicantPayload(record);
  const base = publicBase(req);
  applicant.document_urls = {};
  for (let i = 1; i <= 7; i++) {
    const name = applicant[`upload_position_${i}`] || "";
    if (name) applicant.document_urls[name] = `${base}/api/applicants/${encodeURIComponent(record.application_id)}/documents/${encodeURIComponent(name)}/raw`;
  }
  return applicant;
}

app.post("/api/device/jobs", (req, res) => {
  const { applicationIds, startPage = "auto" } = req.body || {};
  if (!Array.isArray(applicationIds) || !applicationIds.length) return res.status(400).json({ error: "applicationIds is required" });
  const created = [];
  for (const applicationId of applicationIds) {
    if (!db.getApplicant(applicationId)) continue;
    const job = { id: crypto.randomUUID(), applicationId, startPage, status: "queued", deviceId: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    deviceJobs.push(job); created.push(job);
    db.upsertApplicant({ application_id: applicationId, status: "Queued for Device" });
    io.emit("automation:progress", { applicationId, type: "applicant-start", deviceQueued: true });
  }
  saveDeviceJobs();
  res.json({ ok: true, jobs: created });
});

app.get("/api/device/jobs/next", (req, res) => {
  const deviceId = String(req.query.deviceId || "windows-browser");
  let job = deviceJobs.find(j => j.status === "running" && j.deviceId === deviceId);
  if (!job) job = deviceJobs.find(j => j.status === "queued");
  if (!job) return res.status(204).end();
  const record = db.getApplicant(job.applicationId);
  if (!record) { job.status = "error"; job.error = "Applicant not found"; saveDeviceJobs(); return res.status(404).json({ error: job.error }); }
  job.status = "running"; job.deviceId = deviceId; job.updatedAt = new Date().toISOString(); saveDeviceJobs();
  res.json({ job, applicant: devicePayload(req, record) });
});

app.get("/api/device/jobs/:jobId/status", (req, res) => {
  const job = deviceJobs.find(j => j.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ id: job.id, status: job.status, applicationId: job.applicationId, updatedAt: job.updatedAt });
});

app.post("/api/device/jobs/:jobId/events", (req, res) => {
  const job = deviceJobs.find(j => j.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const evt = req.body || {};
  // Once the dashboard cancels a device job, ignore any late automation
  // completion/error messages from the browser tab. Cancel must win.
  if (job.status === "cancelled" && evt.type !== "cancelled") {
    return res.json({ ok: true, job, ignored: true });
  }
  job.updatedAt = new Date().toISOString();
  if (evt.type === "page-error" || evt.type === "applicant-error") { job.status = "error"; job.error = String(evt.error || evt.message || "Device automation error"); db.upsertApplicant({ application_id: job.applicationId, status: "Error", notes: job.error }); }
  if (evt.type === "applicant-complete") { job.status = "complete"; db.upsertApplicant({ application_id: job.applicationId, status: "Ready for Review" }); }
  if (evt.type === "cancelled") job.status = "cancelled";
  saveDeviceJobs();
  io.emit("automation:progress", { applicationId: job.applicationId, ...evt });
  if (["applicant-complete","applicant-error","cancelled"].includes(evt.type)) io.emit("automation:done", { device: true, jobId: job.id });
  res.json({ ok: true, job });
});

app.post("/api/device/jobs/cancel", (req, res) => {
  let count = 0;
  for (const job of deviceJobs) if (["queued","running"].includes(job.status)) { job.status = "cancelled"; job.updatedAt = new Date().toISOString(); count++; io.emit("automation:progress", { applicationId: job.applicationId, type: "cancelled" }); }
  saveDeviceJobs(); io.emit("automation:done", { device: true, cancelled: count }); res.json({ ok: true, cancelled: count });
});

// ---------- Automation ----------

function buildApplicantPayload(record) {
  const upload_positions = [];
  for (let i = 1; i <= 7; i++) upload_positions.push(record[`upload_position_${i}`] || "");
  return { ...record, upload_positions };
}

app.post("/api/automation/run", async (req, res) => {
  const { applicationIds, startPage = 1 } = req.body;
  if (!Array.isArray(applicationIds) || !applicationIds.length) {
    return res.status(400).json({ error: "applicationIds is required" });
  }
  const autoDetectStartPage = startPage === "auto";

  automationCancelled = false;
  res.json({ ok: true, started: applicationIds.length });

  const platform = requestPlatform(req);
  const engine = createEngine({ platform, projectRoot: PROJECT_ROOT, emit: (event, payload) => io.emit(event, payload) });

  try {
    await engine.launch();
  } catch (error) {
    io.emit("automation:log", { level: "error", message: error.message || String(error) });
    io.emit("automation:done", { error: error.message || String(error), code: error.code || "ENGINE_LAUNCH_FAILED" });
    return;
  }

  for (const id of applicationIds) {
    if (automationCancelled) {
      io.emit("automation:progress", { applicationId: id, type: "cancelled" });
      break;
    }

    const record = db.getApplicant(id);
    if (!record) {
      io.emit("automation:progress", { applicationId: id, type: "page-error", error: "Applicant not found" });
      continue;
    }

    const applicant = buildApplicantPayload(record);
    io.emit("automation:progress", { applicationId: id, type: "applicant-start" });

    try {
      await engine.runApplicant({
        applicant,
        startPage: autoDetectStartPage ? "auto" : startPage,
        onProgress: (event) => io.emit("automation:progress", { applicationId: id, ...event }),
      });

      db.upsertApplicant({ application_id: id, status: "Submitted" });
      io.emit("automation:progress", { applicationId: id, type: "applicant-complete" });
    } catch (error) {
      db.upsertApplicant({ application_id: id, status: "Error", notes: String(error.message || error) });
      io.emit("automation:progress", { applicationId: id, type: "applicant-error", error: String(error.message || error) });
    }
  }

  io.emit("automation:done");
});

app.post("/api/automation/stop", (req, res) => {
  automationCancelled = true;
  res.json({ ok: true });
});

// ---------- Static screenshots + frontend ----------

app.use("/screenshots", express.static(SCREENSHOTS_DIR));
app.use("/vendor/cropperjs", express.static(path.join(__dirname, "node_modules", "cropperjs", "dist")));
app.use(express.static(path.join(__dirname, "..", "frontend", "public")));

io.on("connection", (socket) => {
  socket.emit("automation:log", { level: "info", message: "Connected to eVisa automation server." });
});

const PORT = process.env.PORT || 4000;

// sql.js loads its WASM module asynchronously, so the DB must finish
// initializing before we start accepting requests.
db.init()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`eVisa web assistant backend listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize the database:", error);
    process.exit(1);
  });
