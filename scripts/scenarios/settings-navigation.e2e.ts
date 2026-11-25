import { expect } from "e2e";
import { test, WEB } from "./cod3.ts";

test(
  "Browse and search Settings on wide and compact windows",
  WEB,
  async ({ cod3, app, browser, screen }) => {
    const project = await cod3.project("Design tools");
    await cod3.thread({
      project,
      title: "Review preferences",
      messages: ["Review the settings layout."],
    });
    await cod3.open("/settings/general");
    await expect(screen.getByRole("switch", "In-app notifications")).toBeVisible();
    await app.screenshot("general-wide");
    await browser.setViewport({ width: 390, height: 740 });
    await browser.emulateMedia({ colorScheme: "dark" });
    await expect(screen.getByRole("switch", "In-app notifications")).toBeVisible();
    await app.screenshot("general-compact");
    const sections = screen.getByRole("button", "Settings sections");
    await screen.getByRole("switch", "In-app notifications").press("F6");
    await expect(sections).toBeFocused();
    await sections.press("Enter");
    await expect(sections).toHaveAttribute("aria-expanded", "true");
    const appearance = screen.getByRole("button", "Appearance", { exact: true });
    await expect(appearance).toBeVisible();
    await app.screenshot("compact-sections");
    await appearance.tap();
    await expect(sections).toHaveAttribute("aria-expanded", "false");
    await expect(screen.getByRole("heading", "Appearance", { exact: true }).first()).toBeVisible();

    await browser.keyboard.press("/");
    const search = screen.getByRole("combobox", "Search settings");
    await search.fill("in-app notifications");
    await expect(screen.getByRole("option", /In-app notifications/).first()).toBeVisible();
    await browser.keyboard.press("Escape");
    await expect(search).toHaveValue("");
    await browser.keyboard.press("Escape");
    await expect(sections).toHaveAttribute("aria-expanded", "false");
    await expect(sections).toBeFocused();

    await browser.keyboard.press("/");
    await search.fill("in-app notifications");
    await browser.keyboard.press("Enter");
    const notifications = screen.getByRole("switch", "In-app notifications");
    await expect(notifications).toBeVisible();
    await expect(sections).toHaveAttribute("aria-expanded", "false");
    await notifications.tap();
    await expect(notifications).toHaveAttribute("aria-checked", "true");
    await cod3.open("/settings/general");
    await expect(notifications).toHaveAttribute("aria-checked", "true");
    await notifications.tap();
    await expect(notifications).toHaveAttribute("aria-checked", "false");

    await browser.setViewport({ width: 1280, height: 800 });
    await screen.getByRole("button", "Threads", { exact: true }).tap();
    await expect(screen.getByRole("button", /^Project scope:/)).toBeVisible();
    await app.screenshot("scoped-page");
  },
);
