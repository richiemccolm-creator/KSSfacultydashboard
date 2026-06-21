import { test, expect } from "@playwright/test";

test.describe("Faculty Head Hub navigation", () => {
  test("fhNavHref appends embed=1 for hub pages", async ({ page }) => {
    await page.goto("/e2e/fixtures/fh-nav-test.html?embed=1");
    await page.waitForFunction(() => typeof window.fhNavHref === "function");

    const calendarHref = await page.evaluate(() => window.fhNavHref("fh_calendar.html"));
    const hubHref = await page.evaluate(() => window.fhNavHref("faculty-hub.html?panel=data-backup"));

    expect(calendarHref).toBe("fh_calendar.html?embed=1");
    expect(hubHref).toBe("faculty-hub.html?panel=data-backup");
  });

  test("embedded fixture hides duplicate topbar", async ({ page }) => {
    await page.goto("/e2e/fixtures/fh-nav-test.html?embed=1");
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-fh-embed") === "1"
    );
    await expect(page.locator(".topbar")).toBeHidden();
  });

  test("mobile top nav preserves embed on primary links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/e2e/fixtures/fh-nav-test.html?embed=1");
    await page.waitForSelector("#fhTopNav");

    const calendarBtn = page.locator('.fh-top-nav-btn[href*="fh_calendar"]');
    await expect(calendarBtn).toHaveAttribute("href", "fh_calendar.html?embed=1");

    const patchedLink = page.locator("#calendarLink");
    await expect(patchedLink).toHaveAttribute("href", "fh_calendar.html?embed=1");
  });

  test("top nav sets chrome height CSS variables", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/e2e/fixtures/fh-nav-test.html?embed=1");
    await page.waitForSelector("#fhTopNav");

    const navHeight = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--fh-top-nav-h")
    );

    expect(navHeight.trim()).not.toBe("");
    expect(parseInt(navHeight, 10)).toBeGreaterThan(40);
  });
});

test.describe("Faculty Head Hub page assets", () => {
  test("fh_class_management wrapper no longer redirects away", async ({ request }) => {
    const res = await request.get("/fh_class_management.html");
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).not.toContain("window.location.replace('class_management.html')");
    expect(html).toContain('class="page-frame"');
    expect(html).toContain("embed-chrome.js");
    expect(html).toContain("fh-access.js");
  });

  test("fh_tracking uses iframe wrapper instead of hard redirect", async ({ request }) => {
    const res = await request.get("/fh_tracking.html");
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).not.toContain('window.location.replace("tracking_monitoring_landing.html")');
    expect(html).toContain("tracking_monitoring_landing.html?embed=1");
  });

  test("academic calendar supports embed chrome flag", async ({ request }) => {
    const res = await request.get("/academic_calendar_app.html");
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain("data-cal-embed");
    expect(html).toContain("viewport-fit=cover");
  });

  test("all fh wrapper pages include shared access and embed scripts", async ({ request }) => {
    const pages = [
      "fh_calendar.html",
      "fh_announcements.html",
      "fh_staff.html",
      "fh_procurement.html",
      "fh_department_meetings.html",
      "fh_tracking.html",
      "fh_class_management.html",
    ];

    for (const path of pages) {
      const res = await request.get("/" + path);
      expect(res.ok(), path + " should load").toBeTruthy();
      const html = await res.text();
      expect(html, path).toContain("embed-chrome.js");
      expect(html, path).toContain("fh-access.js");
    }
  });
});
