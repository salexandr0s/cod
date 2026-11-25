/// <reference lib="dom" />
// @effect-diagnostics-next-line nodeBuiltinImport:off -- checks the actual project file after the user ticks a task
import * as NodeFSP from "node:fs/promises";
import { expect } from "e2e";

import { test, WEB } from "./cod3.ts";

test(
  "Project documents puts the checkout's checklist first and saves a checked task",
  WEB,
  async ({ cod3, app, screen, browser }) => {
    await browser.setViewport({ width: 1440, height: 900 });
    const files = {
      "GOAL.md": "# Goal\n\nMake the first release easy to verify.\n",
      "docs/Checklist.md": [
        "# Release checklist",
        "",
        "## Project setup",
        "- [x] Set the project goal",
        "- [x] Document the technical requirements",
        "",
        "## Desktop verification",
        "- [ ] Verify the desktop build",
        "- [ ] Check the sidebar at a narrow width",
        "- [ ] Review the release notes",
        "",
        "```md",
        "- [ ] Example task syntax",
        "```",
        "",
      ].join("\n"),
      "docs/Technical Requirements.md": "# Technical requirements\n\nSupport remote checkouts.\n",
      "docs/unrelated.md": "# Other notes\n",
    };
    const project = await cod3.project("Project kickoff", files);
    const thread = await cod3.thread({
      project,
      title: "Prepare the desktop build",
      messages: ["Review the project checklist."],
    });
    await cod3.open(thread);
    await screen.getByRole("button", "Toggle right panel").tap();
    const docs = screen.getByRole("region", "Project documents");
    await docs.getByRole("button", "docs/Checklist.md").waitFor();
    const paths = docs.getByRole("button");
    await expect(paths).toHaveCount(3);
    await expect(paths.first()).toHaveAttribute("aria-label", "docs/Checklist.md");
    await app.screenshot("project-documents");
    await paths.first().tap();
    await screen.getByRole("heading", "Release checklist").waitFor();
    const progress = screen.getByRole("progressbar", "Checklist progress");
    await expect(progress).toHaveAttribute("aria-valuemax", "5");
    await expect(progress).toHaveAttribute("aria-valuenow", "2");
    await screen.getByRole("checkbox", "Toggle task").nth(2).tap();
    await expect(progress).toHaveAttribute("aria-valuenow", "3");
    await expect
      .poll(() => NodeFSP.readFile(`${project}/docs/Checklist.md`, "utf8"))
      .toContain("- [x] Verify the desktop build");
    await app.screenshot("rendered-checklist");
    await screen.getByRole("button", "Show file explorer").tap();
    await expect(docs.getByRole("button", "docs/Checklist.md")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const resize = screen.getByRole("separator", "Resize file explorer");
    await resize.press("Home");
    await expect(resize).toHaveAttribute("aria-valuenow", "160");
    await browser.evaluate(() => {
      localStorage.setItem("cod3:theme-appearance-mode", "dark");
      return null;
    });
    await cod3.open(thread);
    await expect(docs.getByRole("button", "docs/Checklist.md")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await app.screenshot("compact-document-list");
    await docs.getByRole("button", "GOAL.md").tap();
    await expect(screen.getByRole("heading", "Goal")).toBeVisible();
    await expect(docs.getByRole("button", "GOAL.md")).toHaveAttribute("aria-current", "page");
  },
);
