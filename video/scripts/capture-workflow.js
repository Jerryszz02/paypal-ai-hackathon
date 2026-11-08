async (page) => {
  const out = "public/footage/";
  const pause = (ms) => page.waitForTimeout(ms);
  const clean = () =>
    page.addStyleTag({
      content:
        "nextjs-portal {display:none !important} html {scroll-behavior:smooth}",
    });
  const start = async (name) => {
    await clean();
    await page.screencast.start({
      path: out + name + ".webm",
      size: { width: 1440, height: 900 },
      fps: 30,
    });
    await page.screencast.showActions({
      duration: 650,
      style: {
        point: "width:18px;height:18px;border-radius:50%;background:#087f7970",
        title: "display:none",
      },
    });
  };
  const stop = async (name) => {
    await page.screenshot({ path: out + name + ".png" });
    await page.screencast.stop();
    await page.screencast.hideActions();
    console.log("Captured " + name);
  };
  if (page.url().endsWith("/claims/new")) {
    await start("applicant");
    await pause(1800);
    await page
      .getByRole("button", { name: "Clear · £23.80", exact: true })
      .click();
    await page.getByText("Sample extraction", { exact: true }).waitFor();
    await pause(3800);
    await page.getByLabel("Merchant", { exact: true }).scrollIntoViewIfNeeded();
    await pause(2200);
    await page
      .getByRole("checkbox", { name: /I checked the merchant/ })
      .check();
    await pause(1000);
    await page.getByRole("checkbox", { name: /I personally paid/ }).check();
    await pause(1800);
    await page
      .getByRole("button", { name: "Submit claim", exact: true })
      .click();
    await pause(2000);
    await page
      .getByRole("button", { name: "Submit for checks", exact: true })
      .click();
    await page.getByRole("heading", { name: "Checks & next steps" }).waitFor();
    await pause(3500);
    await stop("applicant");
  }
  const claimPath = page.url().replace("http://127.0.0.1:3107", "");
  await start("checks");
  await page
    .getByRole("heading", { name: "Checks & next steps" })
    .scrollIntoViewIfNeeded();
  await pause(6000);
  await page.mouse.wheel(0, 350);
  await pause(5500);
  await page.mouse.wheel(0, -260);
  await pause(5000);
  await stop("checks");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: /Morgan Chen/ }).click();
  await page.waitForURL("**/claims");
  await page.goto("http://127.0.0.1:3107" + claimPath);
  await page.getByLabel("Decision reason").waitFor();
  await start("review");
  await pause(2000);
  await page.getByLabel("Decision reason").scrollIntoViewIfNeeded();
  await page
    .getByLabel("Decision reason")
    .pressSequentially(
      "Checked the original paid rail receipt and confirmed reimbursement details.",
      { delay: 42 },
    );
  await pause(2500);
  await page
    .getByRole("button", { name: "Approve claim", exact: true })
    .click();
  await pause(2500);
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simulate approved payment", exact: true })
    .waitFor();
  await pause(4500);
  await stop("review");
  await start("payment");
  await page
    .getByRole("button", { name: "Simulate approved payment", exact: true })
    .scrollIntoViewIfNeeded();
  await pause(2000);
  await page
    .getByRole("button", { name: "Simulate approved payment", exact: true })
    .click();
  await pause(4800);
  await page
    .getByRole("button", { name: "Confirm simulation", exact: true })
    .click();
  await page
    .locator(".payment-panel .status-badge")
    .filter({ hasText: "Processing" })
    .waitFor();
  await pause(4500);
  await page
    .getByRole("button", { name: "Synchronize existing payment", exact: true })
    .click();
  await page
    .locator(".payment-panel .status-badge")
    .filter({ hasText: "Paid" })
    .waitFor();
  await pause(6000);
  await stop("payment");
  return { claimPath, verified: "Simulated payment reconciled to Paid" };
};
