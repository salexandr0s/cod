import { expect } from "e2e";

import { test, WEB } from "./cod3.ts";

test("An invalid host filter keeps the Issues page open", WEB, async ({ cod3, app, browser }) => {
  await cod3.project("demo");
  await cod3.open("/issues?host=true");

  await app.screenshot("issues-invalid-host");
  await expect(browser.locator("h1")).toHaveText("Issues");
});
