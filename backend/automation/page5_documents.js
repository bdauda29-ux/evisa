const fs = require("fs");
const path = require("path");

const UPLOAD_BUTTON_SELECTOR = "input[type='button'][value='Upload file'].upload_btn";
const DOCUMENT_CARD_SELECTOR = "form#msform .upload_docs";
const FILE_INPUT_SELECTOR = "app-file-upload-modal input[type='file'].upload.up";
const MODAL_SELECTOR = "div[role='dialog'].modal.in app-file-upload-modal, app-file-upload-modal";

async function waitForUploadModalClosed(page) {
  const modal = page.locator(MODAL_SELECTOR).first();
  await modal.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
}

async function uploadOne(page, cardIndex, filePath, position) {
  // IMPORTANT: target the fixed document CARD, not nth() over the live list of
  // Upload file buttons. After a successful upload Angular removes/replaces the
  // button in that card, so the button list shrinks and nth(index) would skip
  // every other document. The .upload_docs card order itself stays stable.
  const card = page.locator(DOCUMENT_CARD_SELECTOR).nth(cardIndex);
  await card.waitFor({ state: "attached", timeout: 12000 });

  const uploadButton = card.locator(UPLOAD_BUTTON_SELECTOR).first();
  const buttonVisible = await uploadButton.isVisible().catch(() => false);

  if (!buttonVisible) {
    // If this slot was already accepted by the portal, its required hidden
    // field normally contains a value and the Upload file button disappears.
    const hiddenValue = await card
      .locator("input[type='hidden'][required]")
      .first()
      .inputValue()
      .catch(() => "");

    if (String(hiddenValue || "").trim()) {
      return { position, filePath, alreadyUploaded: true };
    }

    throw new Error(
      `Page 5 document position ${position} has no visible Upload file button and is not marked uploaded`
    );
  }

  await uploadButton.scrollIntoViewIfNeeded();

  try {
    await uploadButton.click();
  } catch {
    await uploadButton.click({ force: true });
  }

  // This is the exact F6A/F4A DOM shown by the portal and used by the
  // working desktop application. Do NOT click the inner #upload icon.
  const fileInput = page.locator(FILE_INPUT_SELECTOR).first();
  await fileInput.waitFor({ state: "attached", timeout: 12000 });
  await fileInput.setInputFiles(filePath);
  await page.waitForTimeout(900);

  // Scope OK to the active file-upload component only.
  const okButton = page
    .locator("app-file-upload-modal .modal-footer button.btn")
    .filter({ hasText: /^\s*OK\s*$/i })
    .first();

  await okButton.waitFor({ state: "visible", timeout: 12000 });
  try {
    await okButton.click();
  } catch {
    await okButton.click({ force: true });
  }

  await waitForUploadModalClosed(page);
  await page.waitForTimeout(700);

  return { position, filePath };
}

async function run(page, applicant, projectRoot) {
  // Preserve the original upload-position indexes. filter(Boolean) would shift
  // later documents left whenever a position is empty, which can attach a file
  // to the wrong Page 5 card.
  const rawPositions = Array.isArray(applicant.upload_positions)
    ? applicant.upload_positions
    : [];
  const assignments = rawPositions
    .map((filename, index) => ({ filename, index, position: index + 1 }))
    .filter((item) => Boolean(item.filename));

  if (!assignments.length) {
    throw new Error(
      "No documents were assigned in upload_position_1 through upload_position_7"
    );
  }

  const folder = String(
    applicant.document_folder ||
      path.join(projectRoot, "documents", applicant.application_id)
  );

  const assignmentsWithPaths = assignments.map((item) => ({
    ...item,
    filePath: path.join(folder, item.filename),
  }));

  for (const { filePath } of assignmentsWithPaths) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Assigned document was not found: ${filePath}`);
    }

    // Keep the same file-size checks as the desktop reference implementation.
    const isPdf = path.extname(filePath).toLowerCase() === ".pdf";
    const maxBytes = isPdf ? 1.5 * 1024 * 1024 : 1024 * 1024;
    if (fs.statSync(filePath).size >= maxBytes) {
      throw new Error(
        isPdf
          ? `PDF document must be 1.5MB or less: ${filePath}`
          : `Document must be less than 1MB: ${filePath}`
      );
    }
  }

  const documentCards = page.locator(DOCUMENT_CARD_SELECTOR);
  const documentCardCount = await documentCards.count();

  const highestAssignedPosition = Math.max(...assignments.map((item) => item.position));
  if (highestAssignedPosition > documentCardCount) {
    throw new Error(
      `Document position ${highestAssignedPosition} is assigned, but the portal shows only ` +
        `${documentCardCount} supporting-document position(s) for this visa category`
    );
  }

  const uploaded = [];
  for (const assignment of assignmentsWithPaths) {
    // Wait for any previous upload component to fully disappear, then resolve
    // the fixed card for this exact upload position. Angular may remove the
    // completed card's button, but it does not change the card's position.
    await waitForUploadModalClosed(page);
    await page.waitForTimeout(350);

    await uploadOne(
      page,
      assignment.index,
      assignment.filePath,
      assignment.position
    );
    uploaded.push(assignment.filename);
  }

  const continueButton = page.locator("input[type='submit'][value='Continue']").first();
  await continueButton.waitFor({ state: "visible", timeout: 12000 });

  // The form enables Continue only after all required hidden document values
  // have been populated by the upload modal.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await continueButton.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(250);
  }

  if (!(await continueButton.isEnabled().catch(() => false))) {
    throw new Error(
      "All assigned files were sent to the Page 5 upload dialogs, but Continue is still disabled. " +
        "One or more portal document uploads may not have been accepted."
    );
  }

  try {
    await continueButton.click();
  } catch {
    await continueButton.click({ force: true });
  }

  await page.waitForTimeout(1800);
  return { page: 5, completed: true, uploaded };
}

module.exports = { run };
