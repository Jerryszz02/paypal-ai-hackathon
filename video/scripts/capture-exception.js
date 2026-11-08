async (page) => {
  const out = "public/footage/";
  const pause = (ms) => page.waitForTimeout(ms);
  await page.addStyleTag({
    content:
      "nextjs-portal {display:none !important} html {scroll-behavior:smooth}",
  });
  await page.screencast.start({
    path: out + "exception.webm",
    size: { width: 1440, height: 900 },
    fps: 30,
  });
  await page.screencast.showActions({
    duration: 450,
    style: {
      point: "width:18px;height:18px;border-radius:50%;background:#a7671870",
      title: "display:none",
    },
  });
  await pause(1500);
  await page.getByRole("checkbox", { name: /I checked the merchant/ }).check();
  await page.getByRole("checkbox", { name: /I personally paid/ }).check();
  await page.getByRole("button", { name: "Submit claim", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit for checks", exact: true })
    .click();
  await page.getByRole("heading", { name: "Checks & next steps" }).waitFor();
  await pause(3300);
  await page.screenshot({ path: out + "exception-needs-info.png" });
  await page.getByRole("button", { name: "Update claim", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear replacement · £420", exact: true })
    .click();
  await pause(1800);
  await page.getByRole("checkbox", { name: /I checked the merchant/ }).check();
  await page.getByRole("checkbox", { name: /I personally paid/ }).check();
  await page.getByRole("button", { name: "Submit claim", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit for checks", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Above the automatic limit", exact: true })
    .waitFor();
  await pause(5000);
  await page.screenshot({ path: out + "exception.png" });
  await page.screencast.stop();
  await page.screencast.hideActions();
  return {
    claim: page.url(),
    verified: "Clear replacement still requires finance review",
  };
};
