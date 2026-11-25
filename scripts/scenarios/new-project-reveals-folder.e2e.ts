import { expect } from "e2e";

import { test, WEB } from "./cod3.ts";

test(
  "A project created from the picker appears in the Projects section",
  WEB,
  async ({ cod3, app, screen, browser }) => {
    await cod3.project("original-project");
    await cod3.open("/settings/labs");
    await screen.getByLabel("Boring sidebar (group by project)", { exact: true }).tap();
    await screen.getByLabel("Two-line folder rows", { exact: true }).waitFor();
    await cod3.open();

    await screen.getByRole("button", "Projects", { exact: true }).tap();
    const picker = screen.getByRole("combobox", "Projects");
    await picker.tap();
    await screen.getByRole("option", /original-project/).tap();
    await screen.getByRole("combobox", "Projects: original-project", { exact: true }).tap();
    await screen.getByRole("option", "Add project").tap();
    await screen.getByText("New project", { exact: true }).tap();
    await screen.getByPlaceholder("Project name").fill("fresh-project");
    await screen.getByRole("button", /^Create \(/).tap();
    await screen.getByText("Created fresh-project", { exact: true }).waitFor();

    const folder = screen.getByRole("button", "fresh-project", { exact: true });
    await expect(folder).toBeVisible();
    await picker.tap();
    await screen.getByPlaceholder("Search projects...").fill("fresh");
    const newProjectOption = screen.getByRole("option", /fresh-project/);
    await expect(newProjectOption).toBeVisible();
    await newProjectOption.hover();
    await app.screenshot("new-project-in-picker");
    await newProjectOption.tap();
    const composer = screen.getByRole("textbox");
    await composer.fill("Keep this draft while switching projects");
    await browser.locator("[data-draft-project-trigger]").tap();
    await screen.getByRole("option", /original-project/).tap();
    await expect(screen.getByRole("button", "original-project", { exact: true })).toBeVisible();
    await expect(composer).toContainText("Keep this draft while switching projects");
  },
);
