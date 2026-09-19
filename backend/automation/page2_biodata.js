const fs = require("fs");
const path = require("path");
const { splitDate } = require("./helpers");

async function selectNativeByName(page, name, visibleText, label) {
  const select = page.locator(`select[name='${name}']`);
  await select.waitFor({ timeout: 12000 });

  const options = select.locator("option");
  const count = await options.count();
  const wanted = String(visibleText || "").trim().toLowerCase();
  const available = [];

  for (let i = 0; i < count; i++) {
    const text = (await options.nth(i).innerText()).trim();
    if (!text) continue;
    available.push(text);
    if (text.toLowerCase() === wanted) {
      const value = await options.nth(i).getAttribute("value");
      await select.selectOption(value !== null ? value : { index: i });
      await page.waitForTimeout(300);
      return;
    }
  }

  throw new Error(`"${visibleText}" was not found in ${label}. Available: ${available.join(" | ")}`);
}

async function fillInputByName(page, name, value, required = true) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) throw new Error(`No value supplied for ${name}`);
    return;
  }
  const input = page.locator(`input[name='${name}']`);
  await input.waitFor({ timeout: 12000 });
  await input.scrollIntoViewIfNeeded();
  try {
    await input.fill("");
  } catch {}
  await input.fill(String(value));
}

async function fillDateOfBirth(page, dateValue) {
  const date = splitDate(dateValue);
  await fillInputByName(page, "dateOfBirthDay", date.day);

  const monthSelect = page.locator("select[name='dateOfBirthMonth']");
  await monthSelect.waitFor({ timeout: 12000 });
  const monthOptions = monthSelect.locator("option");
  const count = await monthOptions.count();
  let selected = false;

  for (let i = 0; i < count; i++) {
    const value = await monthOptions.nth(i).getAttribute("value");
    if (value === date.month) {
      await monthSelect.selectOption(value);
      selected = true;
      break;
    }
  }

  if (!selected) throw new Error(`Birth month ${date.month} was not found`);

  await fillInputByName(page, "dateOfBirthYear", date.year);
}

async function setPassportExpiryDate(page, dateValue) {
  const date = splitDate(dateValue);
  const formatted = `${date.day}/${date.month}/${date.year}`;
  const input = page.locator("input[name='passportExpiryDate']");
  await input.waitFor({ timeout: 12000 });

  await input.evaluate((el, value) => {
    if (el._flatpickr) {
      el._flatpickr.setDate(value, true, "d/m/Y");
    } else {
      el.removeAttribute("readonly");
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    }
  }, formatted);

  await page.waitForTimeout(400);
}

async function chooseNigerianPassport(page, answer) {
  const wanted = String(answer || "No").trim().toLowerCase() === "yes" ? "convictionsYes" : "convictionsNo";
  const radio = page.locator(`#${wanted}`);
  await radio.waitFor({ timeout: 12000 });
  try {
    await radio.click();
  } catch {
    await radio.click({ force: true });
  }
  await page.waitForTimeout(300);
}

function passportPhotoPosition(visaCategory) {
  const category = String(visaCategory || "").trim();
  if (category === "F4A - Business" || category === "F4B - Business Visa (Multiple Entry)") return 3;
  if (category === "F5A - Tourism Visa") return 2;
  if (category === "F6A - Visiting Visa (Single Entry)") return 4;
  return 0;
}

function getAssignedPassportPhoto(applicant, projectRoot) {
  const applicationId = String(applicant.application_id || "").trim();
  if (!applicationId) throw new Error("Application ID is required for passport photo lookup.");

  const folder = String(applicant.document_folder || path.join(projectRoot, "documents", applicationId));
  const assignmentPath = path.join(folder, "assignment.json");
  let assignedFilename = "";

  const positionByVisa = {
    "F4A - Business": 3,
    "F4B - Business Visa (Multiple Entry)": 3,
    "F5A - Tourism Visa": 2,
    "F6A - Visiting Visa (Single Entry)": 4,
  };

  if (fs.existsSync(assignmentPath)) {
    try {
      const assignment = JSON.parse(fs.readFileSync(assignmentPath, "utf8"));
      const positions = Array.isArray(assignment.upload_positions) ? assignment.upload_positions : [];
      const visaCategory = String(applicant.visa_category || "").trim();
      const passportPosition = positionByVisa[visaCategory];
      if (passportPosition) {
        assignedFilename = String(positions[passportPosition - 1] || "").trim();
      }
    } catch (error) {
      throw new Error(`Could not read document assignment for ${applicationId}: ${error.message || error}`);
    }
  }

  if (!assignedFilename && Array.isArray(applicant.upload_positions)) {
    const visaCategory = String(applicant.visa_category || "").trim();
    const passportPosition = positionByVisa[visaCategory];
    if (passportPosition) {
      assignedFilename = String(applicant.upload_positions[passportPosition - 1] || "").trim();
    }
  }

  if (!assignedFilename) throw new Error("Passport Photo has not been assigned in Assign Documents.");

  const photoPath = path.join(folder, assignedFilename);
  if (!fs.existsSync(photoPath)) throw new Error(`Assigned Passport Photo was not found: ${photoPath}`);

  const extension = path.extname(photoPath).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(extension)) {
    throw new Error(`The assigned Passport Photo must be JPG, JPEG or PNG: ${assignedFilename}`);
  }

  return photoPath;
}

async function uploadPhotograph(page, applicant, projectRoot) {
  const photoPath = getAssignedPassportPhoto(applicant, projectRoot);

  const cameraSelectors = [".img_upload .icon_image", ".img_upload .fa-camera", ".img_box .icon_image", ".img_box"];
  let camera = null;
  for (const selector of cameraSelectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      camera = locator;
      break;
    }
  }
  if (!camera) throw new Error("Photograph camera button was not found");

  await camera.scrollIntoViewIfNeeded();
  try {
    await camera.click();
  } catch {
    await camera.click({ force: true });
  }

  const fileInputs = page.locator("input[type='file']");
  await fileInputs.last().waitFor({ timeout: 12000 });
  const fileInput = fileInputs.last();
  await fileInput.setInputFiles(photoPath);
  await page.waitForTimeout(1200);

  const okXpaths = [
    "//button[normalize-space()='OK']",
    "//button[.//span[normalize-space()='OK']]",
    "//input[@type='button' and @value='OK']",
    "//input[@type='submit' and @value='OK']",
    "//*[@role='button' and normalize-space()='OK']",
  ];

  let okButton = null;
  for (const xp of okXpaths) {
    const locator = page.locator(`xpath=${xp}`).first();
    if (await locator.isVisible({ timeout: 15000 }).catch(() => false)) {
      okButton = locator;
      break;
    }
  }
  if (!okButton) throw new Error("OK confirmation button was not found for the photograph");

  await okButton.scrollIntoViewIfNeeded();
  try {
    await okButton.click();
  } catch {
    await okButton.click({ force: true });
  }
  await page.waitForTimeout(1200);
}

async function clickContinue(page) {
  const continueButton = page.locator("input[type='submit'][value='Continue']");
  await continueButton.waitFor({ timeout: 12000 });
  await continueButton.scrollIntoViewIfNeeded();
  try {
    await continueButton.click();
  } catch {
    await continueButton.click({ force: true });
  }
  await page.waitForTimeout(1800);
}

async function run(page, applicant, projectRoot) {
  await selectNativeByName(page, "title", applicant.title, "Title");
  await fillInputByName(page, "lastName", applicant.surname);
  await fillInputByName(page, "firstName", applicant.first_name);
  await fillInputByName(page, "middleName", applicant.other_names, false);
  await fillDateOfBirth(page, applicant.date_of_birth);
  await fillInputByName(page, "placeOfBirth", applicant.place_of_birth);
  await selectNativeByName(page, "gender", applicant.gender || "Male", "Gender");
  await selectNativeByName(page, "maritalStatus", applicant.marital_status, "Marital Status");
  await fillInputByName(page, "passportNumber", applicant.passport_number);
  await setPassportExpiryDate(page, applicant.passport_expiry_date);
  await chooseNigerianPassport(page, applicant.has_nigerian_passport);
  await uploadPhotograph(page, applicant, projectRoot);
  await clickContinue(page);

  return { page: 2, completed: true };
}

module.exports = { run, passportPhotoPosition };
