import { expect } from "e2e";
import { test, WEB } from "./cod3.ts";

test(
  "Search across project filters and fold grouped project folders",
  WEB,
  async ({ cod3, app, browser, screen }) => {
    const client = await cod3.project("Web client");
    const library = await cod3.project("Design system");
    const current = await cod3.thread({
      project: client,
      title: "Review the navigation",
      messages: ["Review the navigation layout."],
    });
    await cod3.thread({
      project: library,
      title: "Update the color palette",
      messages: ["Check the theme colors."],
    });
    await cod3.open(current);
    const picker = screen.getByRole("combobox", "Projects", { exact: true });
    const resize = screen.getByRole("separator", "Resize Sidebar");
    await expect(resize).toHaveAttribute("aria-valuenow", "280");
    await screen
      .getByRole("button", /Review the navigation/)
      .first()
      .waitFor();
    const newThread = screen.getByRole("button", "New thread", { exact: true });
    await expect(newThread).toHaveText("");
    const completedThread = screen.getByRole("button", /Update the color palette, Done/);
    await expect(completedThread).not.toContainText("Done");
    await app.screenshot("thread-navigation");
    const search = screen.getByRole("combobox", "Search threads");
    await completedThread.press("/");
    await expect(search).toBeFocused();
    await search.fill("color palette");
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await search.press("Escape");
    await expect(completedThread).toBeFocused();
    await newThread.press("Enter");
    await screen.getByRole("option", /Design system/).waitFor();
    await browser.keyboard.press("Escape");
    await resize.press("Home");
    await expect(resize).toHaveAttribute("aria-valuenow", "208");
    await resize.press("ArrowRight");
    await expect(resize).toHaveAttribute("aria-valuenow", "224");
    await cod3.open(current);
    await expect(resize).toHaveAttribute("aria-valuenow", "224");
    await resize.press("End");
    await expect(resize).toHaveAttribute("aria-valuenow", "640");
    await resize.dblclick();
    await expect(resize).toHaveAttribute("aria-valuenow", "280");
    await picker.tap();
    await screen.getByRole("option", /Web client/).tap();
    await search.fill("color palette");
    await screen.getByText("No threads found", { exact: true }).waitFor();
    await app.screenshot("scoped-search");
    await screen.getByRole("button", "Search all projects").press("Enter");
    await expect(search).toBeFocused();
    const results = screen.getByRole("listbox", "Thread search results");
    const paletteResult = results.getByRole("option", /Update the color palette, Design system/);
    await expect(paletteResult).toContainText("Design system");
    await browser.keyboard.press("Enter");
    await expect(screen.getByRole("button", /Update the color palette/).first()).toHaveAttribute(
      "aria-current",
      "page",
    );

    await cod3.open("/settings/labs");
    await screen.getByLabel("Boring sidebar (group by project)", { exact: true }).tap();
    await screen.getByLabel("Two-line folder rows", { exact: true }).waitFor();
    await cod3.open(current);
    const folder = screen.getByRole("button", "Web client", { exact: true });
    await screen.getByRole("button", "Collapse all folders").tap();
    await expect(folder).toHaveAttribute("aria-expanded", "false");
    await screen.getByRole("button", "Expand all folders").press("Enter");
    await expect(folder).toHaveAttribute("aria-expanded", "true");
    await app.screenshot("project-folders");
    await resize.press("Home");
    await app.screenshot("minimum-width");

    await browser.setViewport({ width: 390, height: 740 });
    await browser.emulateMedia({ colorScheme: "dark" });
    await screen.getByRole("button", "Toggle main sidebar").tap();
    await picker.tap();
    await screen.getByRole("option", /Design system/).tap();
    await screen.getByRole("combobox", "Projects: Design system").waitFor();
    await app.screenshot("narrow-project-filter");
    await screen.getByRole("button", "Show all projects", { exact: true }).tap();
    await expect(picker).toBeVisible();
    await screen.getByRole("link", "cod3 home").tap();
    await expect(picker).toBeHidden();
  },
);
