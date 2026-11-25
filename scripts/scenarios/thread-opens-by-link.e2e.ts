import { expect } from "e2e";

import { test, WEB } from "./cod3.ts";

test(
  "A seeded thread opens by its link and shows its history",
  WEB,
  async ({ cod3, app, screen }) => {
    const project = await cod3.project("demo");
    const thread = await cod3.thread({
      project,
      title: "Earlier work",
      messages: ["first", "second"],
    });
    await cod3.open(thread);

    await expect(screen.getByText("second fixture turn complete", { exact: false })).toBeVisible();
    await app.screenshot("thread");
  },
);
