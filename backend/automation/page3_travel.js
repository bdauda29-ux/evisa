const { splitDate, chooseMatOption } = require("./helpers");

async function findVisibleField(page, selectors, labelTerms = []) {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        if (await locator.nth(i).isVisible().catch(() => false)) return locator.nth(i);
      }
    }

    for (const term of labelTerms) {
      const lowerTerm = String(term).toLowerCase().replace(/'/g, "\\'");
      const xp = `//*[self::label or self::span or self::div or self::p][contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),"${lowerTerm}")]`;
      const labels = page.locator(`xpath=${xp}`);
      const labelCount = await labels.count().catch(() => 0);

      for (let i = 0; i < labelCount; i++) {
        const label = labels.nth(i);
        const controls = label.locator(
          "xpath=following::*[(self::input or self::textarea) and not(@type='hidden') and not(@type='radio') and not(@type='file')][1]"
        );
        const controlCount = await controls.count().catch(() => 0);
        for (let j = 0; j < controlCount; j++) {
          if (await controls.nth(j).isVisible().catch(() => false)) return controls.nth(j);
        }
      }
    }

    await page.waitForTimeout(300);
  }

  return null;
}

async function fillTravelField(page, selectors, labelTerms, value, fieldLabel) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`No value supplied for ${fieldLabel}`);
  }

  const input = await findVisibleField(page, selectors, labelTerms);
  if (!input) throw new Error(`${fieldLabel} field was not found`);

  await input.scrollIntoViewIfNeeded();
  try {
    await input.fill("");
  } catch {
    await input.evaluate((el) => {
      el.removeAttribute("readonly");
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  await input.fill(String(value));
  await input.evaluate((el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  });
}

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
      await select.evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
      await page.waitForTimeout(800);
      return;
    }
  }

  throw new Error(`"${visibleText}" was not found in ${label}. Available: ${available.join(" | ")}`);
}

async function selectMatByName(page, name, value, label) {
  const dropdown = page.locator(`mat-select[name='${name}']`);
  await dropdown.waitFor({ timeout: 12000 });
  await chooseMatOption(page, dropdown, value, label);
}

async function setFlatpickrDateByName(page, name, dateValue) {
  const date = splitDate(dateValue);
  const formatted = `${date.day}/${date.month}/${date.year}`;
  const input = page.locator(`input[name='${name}']`);
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

async function findPortOfEntryControl(page) {
  const matSelectors = ["mat-select[name='portOfEntry']", "mat-select[name='entryPort']", "mat-select[name='portEntry']", "mat-select[name='arrivalPort']"];
  const nativeSelectors = ["select[name='portOfEntry']", "select[name='entryPort']", "select[name='portEntry']", "select[name='arrivalPort']"];
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    for (const selector of matSelectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) return { type: "mat-select", element: locator };
    }
    for (const selector of nativeSelectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) return { type: "select", element: locator };
    }

    const xp = "//*[self::label or self::span or self::div][contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'port of entry')]";
    const labels = page.locator(`xpath=${xp}`);
    const count = await labels.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const label = labels.nth(i);
      const followingMat = label.locator("xpath=following::mat-select[1]");
      if (await followingMat.isVisible().catch(() => false)) return { type: "mat-select", element: followingMat };
      const followingSelect = label.locator("xpath=following::select[1]");
      if (await followingSelect.isVisible().catch(() => false)) return { type: "select", element: followingSelect };
    }

    await page.waitForTimeout(300);
  }

  throw new Error("Port of Entry control was not found");
}

async function selectPortOfEntry(page, portValue) {
  const control = await findPortOfEntryControl(page);

  if (control.type === "mat-select") {
    await chooseMatOption(page, control.element, portValue, "Port of Entry");
    return;
  }

  const options = control.element.locator("option");
  const count = await options.count();
  const wanted = String(portValue || "").trim().toLowerCase();
  const available = [];

  for (let i = 0; i < count; i++) {
    const text = (await options.nth(i).innerText()).trim();
    if (!text) continue;
    available.push(text);
    if (text.toLowerCase() === wanted) {
      const value = await options.nth(i).getAttribute("value");
      await control.element.selectOption(value !== null ? value : { index: i });
      await control.element.evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
      await page.waitForTimeout(500);
      return;
    }
  }

  throw new Error(`"${portValue}" was not found in Port of Entry. Available: ${available.join(" | ")}`);
}

async function clickContinue(page) {
  const button = page.locator("input[type='submit'][value='Continue']");
  await button.waitFor({ timeout: 12000 });
  await button.scrollIntoViewIfNeeded();
  try {
    await button.click();
  } catch {
    await button.click({ force: true });
  }
  await page.waitForTimeout(1800);
}

async function run(page, applicant) {
  await page
    .locator(
      "xpath=//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'travel information')]"
    )
    .first()
    .waitFor({ timeout: 15000 });

  await fillTravelField(
    page,
    [
      "input[name='journeyPurpose']", "textarea[name='journeyPurpose']",
      "input[name='purposeOfJourney']", "textarea[name='purposeOfJourney']",
      "input[name='purpose_of_journey']", "textarea[name='purpose_of_journey']",
      "input[formcontrolname='journeyPurpose']", "textarea[formcontrolname='journeyPurpose']",
      "input[formcontrolname='purposeOfJourney']", "textarea[formcontrolname='purposeOfJourney']",
    ],
    ["purpose of journey", "purpose of travel"],
    applicant.purpose_of_journey,
    "Purpose of Journey"
  );

  await fillTravelField(
    page,
    [
      "input[name='airlineName']", "textarea[name='airlineName']",
      "input[name='travelCarrier']", "input[name='carrierName']",
      "input[formcontrolname='airlineName']", "input[formcontrolname='travelCarrier']",
    ],
    ["travel carrier", "airline", "shipping and bus company"],
    applicant.travel_carrier,
    "Travel Carrier"
  );

  await fillTravelField(
    page,
    ["input[name='flightNumber']", "input[name='flightBusVesselNumber']", "input[name='vesselNumber']", "input[formcontrolname='flightNumber']"],
    ["flight/bus/vessel number", "flight number", "vessel number"],
    applicant.flight_number,
    "Flight Number"
  );

  await selectMatByName(page, "departureCountry", applicant.country_of_departure, "Country of Departure");
  await setFlatpickrDateByName(page, "expectedDepartureDate", applicant.departure_date);
  await setFlatpickrDateByName(page, "expectedArrivalDate", applicant.arrival_date);
  await selectNativeByName(page, "arrivalChannel", applicant.arrival_channel, "Arrival Channel");

  await fillTravelField(
    page,
    ["input[name='durationOfStay']", "input[name='stayDuration']", "input[name='duration']", "input[formcontrolname='durationOfStay']"],
    ["duration of stay", "duration of stay(in days)", "duration of stay in days"],
    applicant.duration_of_stay,
    "Duration of Stay"
  );

  // Port of Entry is dynamically loaded after Arrival Channel.
  await selectPortOfEntry(page, applicant.port_of_entry);
  await clickContinue(page);

  return { page: 3, completed: true };
}

module.exports = { run };
