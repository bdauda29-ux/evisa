const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

const DATA_DIR = process.env.EVISA_DATA_DIR ? path.resolve(process.env.EVISA_DATA_DIR) : path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "eVisa_Applicants.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });

const APPLICANT_COLUMNS = [
  "application_id", "nationality", "visa_category", "passport_type", "title",
  "surname", "first_name", "other_names", "date_of_birth", "place_of_birth",
  "gender", "marital_status", "passport_number", "passport_expiry_date",
  "has_nigerian_passport", "purpose_of_journey", "travel_carrier",
  "flight_number", "country_of_departure", "departure_date", "arrival_date",
  "arrival_channel", "duration_of_stay", "port_of_entry", "contact_name",
  "contact_phone", "contact_address", "contact_city", "contact_state",
  "contact_email", "postal_code",
  "upload_position_1", "upload_position_2", "upload_position_3",
  "upload_position_4", "upload_position_5", "upload_position_6",
  "upload_position_7", "status", "notes", "created_at", "updated_at",
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS applicants (
  application_id TEXT PRIMARY KEY, nationality TEXT, visa_category TEXT,
  passport_type TEXT, title TEXT, surname TEXT, first_name TEXT,
  other_names TEXT, date_of_birth TEXT, place_of_birth TEXT, gender TEXT,
  marital_status TEXT, passport_number TEXT, passport_expiry_date TEXT,
  has_nigerian_passport TEXT, purpose_of_journey TEXT, travel_carrier TEXT,
  flight_number TEXT, country_of_departure TEXT, departure_date TEXT,
  arrival_date TEXT, arrival_channel TEXT, duration_of_stay TEXT,
  port_of_entry TEXT, contact_name TEXT, contact_phone TEXT,
  contact_address TEXT, contact_city TEXT, contact_state TEXT,
  contact_email TEXT, postal_code TEXT, upload_position_1 TEXT,
  upload_position_2 TEXT, upload_position_3 TEXT, upload_position_4 TEXT,
  upload_position_5 TEXT, upload_position_6 TEXT, upload_position_7 TEXT,
  status TEXT, notes TEXT, created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  client_code TEXT PRIMARY KEY COLLATE NOCASE, client_name TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  contact_name TEXT PRIMARY KEY, contact_phone TEXT, contact_address TEXT,
  contact_city TEXT, contact_state TEXT, contact_email TEXT
);

CREATE TABLE IF NOT EXISTS travel_carriers (carrier_name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS countries (country_name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS ports_of_entry (port_name TEXT PRIMARY KEY, arrival_channel TEXT);
CREATE TABLE IF NOT EXISTS carrier_flights (
  carrier_name TEXT, flight_number TEXT, route_description TEXT,
  nigeria_city TEXT, PRIMARY KEY (carrier_name, flight_number)
);
`;

// ---------- Static lookup seed data (mirrored from the desktop app) ----------

const SEED_COUNTRIES = [
  "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei",
  "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
  "Cape Verde", "Central African Republic", "Chad", "Chile", "China",
  "Colombia", "Comoros", "Congo", "Costa Rica", "Cote D'Ivoire", "Croatia",
  "Cuba", "Cyprus", "Czech Republic", "Democratic Republic of the Congo",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Fiji", "Finland",
  "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece",
  "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti",
  "Honduras", "Hong Kong S.A.R", "Hungary", "Iceland", "India", "Indonesia",
  "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan",
  "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
  "Lebanon", "Lesotho", "Liberia", "Liechtenstein", "Lithuania", "Luxembourg",
  "Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
  "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico",
  "Moldova", "Monaco", "Mongolia", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua",
  "Niger", "Nigeria", "Norway", "Oman", "Pakistan", "Palau", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia",
  "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "South Africa", "South Korea", "Spain", "Sri Lanka", "Suriname",
  "Swaziland", "Sweden", "Switzerland", "Taiwan Province", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkmenistan", "Tuvalu", "Uganda",
  "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
  "Uruguay", "Uzbekistan", "Vanuatu", "Vatican", "Venezuela", "Vietnam",
  "Western Sahara", "Yemen", "Zambia", "Zimbabwe",
];

const SEED_CARRIERS = [
  "Qatar Airways", "Emirates", "Ethiopian Airlines", "Turkish Airlines",
  "EgyptAir", "Air Peace", "British Airways", "Virgin Atlantic", "RwandAir",
  "Lufthansa", "KLM", "Air France", "Royal Air Maroc", "Air Côte d’Ivoire",
  "Africa World Airlines", "Saudia", "Delta Air Lines", "United Airlines", "Kenya Airways", "South African Airways", "ASKY Airlines",
];

const SEED_PORTS = [
  ["Nnamdi Azikiwe international Airport, Abuja", "Air"],
  ["Mallam Aminu Kano Airport, Kano", "Air"],
  ["Murtala Mohammed Airport, Lagos", "Air"],
  ["Margret Ekpo Airport, Calabar", "Air"],
  ["PortHarcourt International Airport, Rivers", "Air"],
  ["Akanu Ibiam International Airport, Enugu", "Air"],
  ["Seme-Krake (Lagos)", "Land"],
  ["Idiroko (Ogun)", "Land"],
  ["Illela (Sokoto)", "Land"],
  ["Maigatari (Jigawa)", "Land"],
  ["Jibiya (Katsina)", "Land"],
  ["Kamba (Kebbi)", "Land"],
  ["Mfum (Etung, Cross River)", "Land"],
  ["Ikom (Cross River)", "Land"],
  ["Apapa (Lagos Port Complex)", "Sea"],
  ["Tin Can Island Port", "Sea"],
  ["Onne Port", "Sea"],
  ["(Old) Port Harcourt", "Sea"],
  ["Warri Port", "Sea"],
  ["Calabar Port", "Sea"],
  ["Lekki Deep Sea Port", "Sea"],
];

const SEED_FLIGHTS = [
  ["Emirates", "EK783", "Dubai to Lagos", "Lagos"],
  ["Emirates", "EK784", "Lagos to Dubai", "Lagos"],
  ["Ethiopian Airlines", "ET901", "Addis Ababa to Lagos", "Lagos"],
  ["Ethiopian Airlines", "ET900", "Lagos to Addis Ababa", "Lagos"],
  ["Ethiopian Airlines", "ET951", "Addis Ababa to Abuja", "Abuja"],
  ["Ethiopian Airlines", "ET950", "Abuja to Addis Ababa", "Abuja"],
  ["Qatar Airways", "QR1405", "Doha to Lagos", "Lagos"],
  ["Qatar Airways", "QR1406", "Lagos to Doha", "Lagos"],
  ["Qatar Airways", "QR1431", "Doha to Abuja", "Abuja"],
  ["Qatar Airways", "QR1432", "Abuja to Doha", "Abuja"],
  ["Turkish Airlines", "TK623", "Istanbul to Abuja", "Abuja"],
  ["Turkish Airlines", "TK624", "Abuja to Istanbul", "Abuja"],
  ["Turkish Airlines", "TK625", "Istanbul to Lagos", "Lagos"],
  ["Turkish Airlines", "TK626", "Lagos to Istanbul", "Lagos"],
  ["EgyptAir", "MS875", "Cairo to Lagos", "Lagos"],
  ["EgyptAir", "MS876", "Lagos to Cairo", "Lagos"],
  ["EgyptAir", "MS877", "Cairo to Abuja", "Abuja"],
  ["EgyptAir", "MS878", "Abuja to Cairo", "Abuja"],
  ["Air Peace", "P47120", "Lagos to Abuja", "Abuja"],
  ["Air Peace", "P47121", "Abuja to Lagos", "Lagos"],
  ["British Airways", "BA75", "London Heathrow to Lagos", "Lagos"],
  ["British Airways", "BA83", "London Heathrow to Abuja", "Abuja"],
  ["Virgin Atlantic", "VS411", "London Heathrow to Lagos", "Lagos"],
  ["RwandAir", "WB202", "Kigali to Lagos", "Lagos"],
  ["Lufthansa", "LH568", "Frankfurt to Lagos", "Lagos"],
  ["Lufthansa", "LH594", "Frankfurt to Abuja", "Abuja"],
  ["Air France", "AF132", "Paris to Lagos", "Lagos"],
  ["Air France", "AF878", "Paris to Abuja", "Abuja"],
  ["Royal Air Maroc", "AT555", "Casablanca to Lagos", "Lagos"],
  ["Royal Air Maroc", "AT587", "Casablanca to Abuja", "Abuja"],
  ["Air Côte d’Ivoire", "HF530", "Abidjan to Lagos", "Lagos"],
  ["Africa World Airlines", "AW222", "Accra to Lagos", "Lagos"],
  ["Africa World Airlines", "AW260", "Accra to Abuja", "Abuja"],
  ["Saudia", "SV431", "Jeddah to Lagos", "Lagos"],
  ["Saudia", "SV449", "Jeddah to Abuja", "Abuja"],
  ["Delta Air Lines", "DL54", "Atlanta to Lagos", "Lagos"],
  ["United Airlines", "UA612", "Washington Dulles to Lagos", "Lagos"],
];

const SEED_CONTACTS = [
  ["Transcorp Hilton Abuja", "8039013000", "1 Aguiyi Ironsi Street Maitama", "Abuja", "FCT", "hilton.abuja@hilton.com"],
  ["Chelsea Hotel Abuja", "9155171409", "123 Mohammadu Buhari Way Central Business District", "Abuja", "FCT", "info@chelseahotelabuja.com"],
  ["The Envoy Hotel Abuja", "8098331233", "305 Diplomatic Drive", "Abuja", "FCT", "reservations@theenvoyabuja.ng"],
  ["Oxford Hotel Wuse", "8148808800", "26 Suez Crescent Sani Abacha Estate Wuse Zone 4", "Abuja", "FCT", ""],
  ["Eko Hotels and Suites", "9092772700", "Plot 1415 Adetokunbo Ademola Street Victoria Island", "Lagos", "Lagos", "reservation@ekohotels.com"],
  ["Lagos Continental Hotel", "2012366666", "52A Kofo Abayomi Street Victoria Island", "Lagos", "Lagos", "info@thelagoscontinental.com"],
  ["Radisson Blu Anchorage Hotel Lagos", "7080610000", "1A Ozumba Mbadiwe Road Victoria Island", "Lagos", "Lagos", "info.lagos@radissonblu.com"],
  ["Lagos Marriott Hotel Ikeja", "8139844850", "122 Joel Ogunnaike Street Ikeja GRA", "Lagos", "Lagos", ""],
  ["Boss Hotels and Suites", "9135384553", "14 Oseni Agoro Street Off Barlett Bus Stop Oshodi Isolo", "Lagos", "Lagos", "admin@bosshotel.com.ng"],
];

// Extra permanent hotel/host addresses can be maintained in backend/config/hotels.json.
try {
  const hotelsPath = path.join(__dirname, "config", "hotels.json");
  if (fs.existsSync(hotelsPath)) {
    const extraHotels = JSON.parse(fs.readFileSync(hotelsPath, "utf8"));
    if (Array.isArray(extraHotels)) {
      for (const hotel of extraHotels) {
        if (!hotel || !String(hotel.contact_name || "").trim()) continue;
        SEED_CONTACTS.push([
          hotel.contact_name || "", hotel.contact_phone || "", hotel.contact_address || "",
          hotel.contact_city || "", hotel.contact_state || "", hotel.contact_email || ""
        ]);
      }
    }
  }
} catch (error) {
  console.warn("Could not load backend/config/hotels.json:", error.message || error);
}

function seedLookups() {
  const countryInsert = "INSERT OR IGNORE INTO countries (country_name) VALUES (?)";
  for (const name of SEED_COUNTRIES) sqlDb.run(countryInsert, [name]);

  const carrierInsert = "INSERT OR IGNORE INTO travel_carriers (carrier_name) VALUES (?)";
  for (const name of SEED_CARRIERS) sqlDb.run(carrierInsert, [name]);

  const portInsert = "INSERT OR IGNORE INTO ports_of_entry (port_name, arrival_channel) VALUES (?, ?)";
  for (const row of SEED_PORTS) sqlDb.run(portInsert, row);

  const flightInsert =
    "INSERT OR IGNORE INTO carrier_flights (carrier_name, flight_number, route_description, nigeria_city) VALUES (?, ?, ?, ?)";
  for (const row of SEED_FLIGHTS) sqlDb.run(flightInsert, row);

  const contactInsert =
    "INSERT OR IGNORE INTO contacts (contact_name, contact_phone, contact_address, contact_city, contact_state, contact_email) VALUES (?, ?, ?, ?, ?, ?)";
  for (const row of SEED_CONTACTS) sqlDb.run(contactInsert, row);
}

let sqlDb = null;
let SQLModule = null;
let saveTimer = null;

// sql.js keeps the database in memory; this flushes it to disk. Debounced
// slightly so a burst of writes doesn't hammer the filesystem.
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }, 150);
}

function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function init() {
  if (sqlDb) return;
  const SQL = await initSqlJs();
  SQLModule = SQL;

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run(SCHEMA);
  seedLookups();
  saveNow();
}

async function loadDatabaseBuffer(buffer) {
  if (!SQLModule) SQLModule = await initSqlJs();
  const candidate = new SQLModule.Database(new Uint8Array(buffer));
  // Validate that this is an eVisa-compatible SQLite DB before replacing live data.
  candidate.run(SCHEMA);
  const cols = candidate.exec("PRAGMA table_info(applicants)");
  if (!cols.length) { candidate.close(); throw new Error("SQLite file does not contain an applicants table"); }
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { sqlDb?.close?.(); } catch {}
  sqlDb = candidate;
  seedLookups();
  saveNow();
  return listApplicants();
}

function databaseBuffer() {
  saveNow();
  return fs.readFileSync(DB_PATH);
}

function all(sql, params = []) {
  const stmt = sqlDb.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  sqlDb.run(sql, params);
  scheduleSave();
}

function listApplicants() {
  return all(`SELECT * FROM applicants ORDER BY rowid ASC`);
}

function getApplicant(id) {
  return get(`SELECT * FROM applicants WHERE application_id = ? COLLATE NOCASE`, [id]);
}


function nextSequentialApplicationId(requestedId) {
  const raw = String(requestedId || "").trim();
  if (!raw) return "";
  // Treat a manually supplied -NNN suffix as part of the same base family.
  const base = raw.replace(/-\d{3}$/i, "");
  const rows = all(`SELECT application_id FROM applicants`);
  let max = 0;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}-(\\d{3})$`, "i");
  for (const row of rows) {
    const match = pattern.exec(String(row.application_id || ""));
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  return `${base}-${String(max + 1).padStart(3, "0")}`;
}

function upsertApplicant(record) {
  const now = new Date().toISOString();
  const existing = getApplicant(record.application_id);
  const merged = { ...existing, ...record };
  merged.created_at = existing?.created_at || now;
  merged.updated_at = now;

  const cols = APPLICANT_COLUMNS;
  const values = cols.map((c) => (merged[c] === undefined ? null : merged[c]));

  if (existing) {
    const setClause = cols.filter((c) => c !== "application_id").map((c) => `${c} = ?`).join(", ");
    const setValues = cols.filter((c) => c !== "application_id").map((c) => (merged[c] === undefined ? null : merged[c]));
    run(`UPDATE applicants SET ${setClause} WHERE application_id = ?`, [...setValues, record.application_id]);
  } else {
    const placeholders = cols.map(() => "?").join(", ");
    run(`INSERT INTO applicants (${cols.join(", ")}) VALUES (${placeholders})`, values);
  }

  // Persist immediately so the currently loaded SQLite profile always includes
  // a newly added/edited applicant before moving to document assignment.
  saveNow();
  return getApplicant(record.application_id);
}

function deleteApplicant(id) {
  run(`DELETE FROM applicants WHERE application_id = ? COLLATE NOCASE`, [id]);
}


// ---------- Clients (Application ID prefixes) ----------

function listClients() {
  return all(`SELECT client_code, client_name, created_at FROM clients ORDER BY client_code COLLATE NOCASE`);
}

function upsertClient(record) {
  const code = String(record.client_code || "").trim().replace(/-\d{3}$/i, "");
  if (!code) throw new Error("Client code is required");
  const name = String(record.client_name || "").trim();
  const now = new Date().toISOString();
  run(
    `INSERT INTO clients (client_code, client_name, created_at) VALUES (?, ?, ?)
     ON CONFLICT(client_code) DO UPDATE SET client_name=excluded.client_name`,
    [code, name, now]
  );
  saveNow();
  return get(`SELECT client_code, client_name, created_at FROM clients WHERE client_code = ? COLLATE NOCASE`, [code]);
}

function deleteClient(code) {
  run(`DELETE FROM clients WHERE client_code = ? COLLATE NOCASE`, [String(code || "").trim()]);
  saveNow();
}

// ---------- Lookups (dropdown data source) ----------

function listCountries() {
  return all(`SELECT country_name FROM countries ORDER BY country_name`).map((r) => r.country_name);
}

function listCarriers() {
  return all(`SELECT carrier_name FROM travel_carriers ORDER BY carrier_name`).map((r) => r.carrier_name);
}

function listPorts() {
  return all(`SELECT port_name, arrival_channel FROM ports_of_entry ORDER BY arrival_channel, port_name`);
}

function listFlights() {
  return all(`SELECT carrier_name, flight_number, route_description, nigeria_city FROM carrier_flights ORDER BY carrier_name, flight_number`);
}

function listContacts() {
  return all(`SELECT * FROM contacts ORDER BY contact_name`);
}

function upsertContact(record) {
  const cols = ["contact_name", "contact_phone", "contact_address", "contact_city", "contact_state", "contact_email"];
  const values = cols.map((c) => record[c] || "");
  run(
    `INSERT INTO contacts (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
     ON CONFLICT(contact_name) DO UPDATE SET
       contact_phone=excluded.contact_phone, contact_address=excluded.contact_address,
       contact_city=excluded.contact_city, contact_state=excluded.contact_state,
       contact_email=excluded.contact_email`,
    values
  );
  // Hotel/host contacts are part of the active SQLite profile and are
  // persisted immediately, just like applicants.
  saveNow();
  return get(`SELECT * FROM contacts WHERE contact_name = ?`, [record.contact_name]);
}

function bulkImport(records) {
  const results = { imported: 0, skipped: 0 };
  for (const r of records) {
    if (!r.application_id || !String(r.application_id).trim()) {
      results.skipped++;
      continue;
    }
    upsertApplicant(r);
    results.imported++;
  }
  saveNow();
  return results;
}

module.exports = {
  init,
  DATA_DIR,
  DB_PATH,
  APPLICANT_COLUMNS,
  listApplicants,
  listClients,
  upsertClient,
  deleteClient,
  getApplicant,
  upsertApplicant,
  nextSequentialApplicationId,
  deleteApplicant,
  bulkImport,
  listCountries,
  listCarriers,
  listPorts,
  listFlights,
  listContacts,
  upsertContact,
  loadDatabaseBuffer,
  databaseBuffer,
};
