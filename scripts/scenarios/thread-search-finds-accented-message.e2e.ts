import { expect } from "e2e";

import { test, WEB } from "./cod3.ts";

test(
  "Thread search finds an accented message by a short unaccented word",
  WEB,
  async ({ cod3, app, screen }) => {
    const project = await cod3.project("demo");
    const thread = await cod3.thread({ project, title: "Weekly notes", messages: ["Start"] });
    await cod3.thread({ project, title: "École fermée", messages: ["Schedule"] });
    await cod3.open(thread);

    // Search reads what the user wrote; messages the CLI sends count as an agent's.
    const composer = screen.getByRole("textbox");
    await composer.pressSequentially("École fermée à Lyon");
    await composer.press("Enter");
    await expect(screen.getByText("second fixture turn complete", { exact: false })).toBeVisible();

    const search = screen.getByRole("combobox", "Search threads");
    await search.fill("fermée ec");
    const results = screen.getByRole("listbox", "Thread search results");
    await expect(results.getByRole("group", "In messages")).toContainText("École fermée");
    await search.press("ArrowDown");
    await expect(
      results.getByRole("group", "In messages").getByRole("option", /Weekly notes/),
    ).toHaveAttribute("aria-selected", "true");
    await app.screenshot("search");
    await search.press("Enter");
    await expect(screen.getByRole("searchbox", "Find in thread")).toBeVisible();
  },
);
