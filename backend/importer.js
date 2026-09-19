const XLSX = require("xlsx");
const { APPLICANT_COLUMNS } = require("./db");

function excelDateToIso(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${d}/${m}/${y}`;
  }
  return value === undefined || value === null ? "" : String(value).trim();
}

// Reads an .xlsx / .xls / .csv buffer and returns an array of applicant
// records shaped like the `applicants` table, mirroring the original
// desktop app's "Applicants" sheet import.
function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === "applicants") ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const records = [];
  for (const row of rows) {
    const record = {};
    for (const col of APPLICANT_COLUMNS) {
      if (!(col in row)) continue;
      const value = row[col];
      if (col.includes("date")) {
        record[col] = excelDateToIso(value);
      } else {
        record[col] = value === undefined || value === null ? "" : String(value).trim();
      }
    }
    if (record.application_id && String(record.application_id).trim()) {
      records.push(record);
    }
  }
  return records;
}

module.exports = { parseWorkbook };
