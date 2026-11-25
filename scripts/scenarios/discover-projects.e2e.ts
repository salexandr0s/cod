import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { expect } from "e2e";
import { COD3_HOME } from "../e2e.config.ts";
import { makeState, runPromise, test, WEB } from "./cod3.ts";
import { startSecondServer } from "./second-server.ts";
import { run } from "./shell.ts";

test(
  "Discover projects on either machine and keep existing pins",
  WEB,
  async ({ cod3, app, screen, browser }) => {
    const pinned = await cod3.project("second-pin");
    const path = await runPromise(Path.Path);
    const fs = await runPromise(FileSystem.FileSystem);
    const parent = path.join(path.dirname(pinned), "GitHub");
    await runPromise(fs.makeDirectory(parent));
    const existing = path.join(parent, "web-client");
    const git = (args: string[]) => runPromise(run("git", args, { cwd: parent }));
    await git(["init", "-q", "web-client"]);
    await git([
      "-C",
      existing,
      "-c",
      "user.name=Scenario",
      "-c",
      "user.email=scenario@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "Initial commit",
    ]);
    await git(["init", "-q", "design-system"]);
    await git(["init", "-q", "platform-api"]);
    await git(["init", "-q", "services/api"]);
    await git(["init", "-q", "examples/api"]);
    await git([
      "-C",
      existing,
      "worktree",
      "add",
      "--detach",
      path.join(parent, "navigation-preview"),
    ]);

    const server = startSecondServer(app.baseUrl ?? "");
    const primary = makeState(COD3_HOME);
    try {
      const { host, token } = await server.ready;
      await runPromise(primary.cli(["project", "add", existing]));
      await cod3.open("/settings/connections");
      await screen.getByRole("button", "Add environment").tap();
      const pairing = screen.getByRole("dialog");
      await pairing.getByPlaceholder("backend.example.com").fill(host);
      await pairing.getByPlaceholder("PAIRCODE").fill(token);
      await pairing.getByRole("button", "Add environment").tap();
      await screen.getByRole("button", "List", { exact: true }).tap();
      await screen.getByRole("button", "More actions for Scenario").waitFor({ timeout: 60_000 });
      await app.open("/");
      const picker = screen.getByRole("combobox", "Projects", { exact: true });
      await picker.tap();
      for (const name of ["web-client", "second-pin"]) {
        await screen.getByRole("option", new RegExp(name)).hover();
        await browser.locator(`button[title^="Pin ${name}"]`).click();
        await browser.locator(`button[title^="Unpin ${name}"]`).waitFor();
      }
      const pinOrder = async () => {
        const text = (await screen.getByRole("listbox").textContent()) ?? "";
        return text.indexOf("web-client") < text.indexOf("second-pin");
      };
      await browser.keyboard.press("Escape");
      await picker.tap();
      const originalOrder = await pinOrder();
      const discover = () => screen.getByRole("option", "Discover projects").tap();
      const scan = async (folder: string) => {
        await screen.getByLabel("Folder path").fill(folder);
        await screen.getByRole("button", "Scan folder").tap();
      };

      await discover();
      const folderPath = screen.getByLabel("Folder path");
      await folderPath.fill(parent + "/");
      await screen.getByRole("button", "services", { exact: true }).tap();
      await screen.getByRole("button", "api", { exact: true }).waitFor();
      await screen.getByRole("button", "Up one folder").tap();
      await screen.getByRole("button", "services", { exact: true }).waitFor();
      await app.screenshot("choose-discovery-folder");
      await scan(path.join(parent, "missing"));
      await screen.getByRole("alert").waitFor();
      await screen.getByRole("button", "Change folder").tap();
      await expect
        .poll(() =>
          browser.evaluate(() => document.activeElement?.getAttribute("placeholder") ?? ""),
        )
        .toBe("~/GitHub");
      await scan(parent);
      await screen.getByRole("heading", /^Already added\s*1$/).waitFor();
      await screen.getByRole("heading", /^New repositories\s*4$/).waitFor();
      await screen.getByRole("heading", /^Linked worktrees\s*1$/).waitFor();
      const addedGroup = screen.getByRole("button", /^Already added/);
      await expect(addedGroup).toHaveAttribute("aria-expanded", "false");
      await addedGroup.tap();
      await screen
        .getByRole("region", /^Already added/)
        .getByText("web-client", { exact: true })
        .waitFor();
      await addedGroup.tap();
      const filter = screen.getByRole("textbox", "Filter repositories");
      await filter.fill("services/api");
      await screen.getByRole("checkbox", "services/api").waitFor();
      await filter.fill("design-system");
      await screen.getByRole("button", "Select visible").tap();
      await filter.fill("nothing-matches");
      await screen.getByText("No matching repositories.").waitFor();
      await screen.getByRole("button", "Add 1 project", { exact: true }).waitFor();
      await browser.keyboard.press("Escape");
      await screen.getByRole("checkbox", "platform-api").tap();
      await app.screenshot("discover-projects");
      await browser.setViewport({ width: 390, height: 740 });
      await screen.getByRole("checkbox", "examples/api").waitFor();
      await browser.emulateMedia({ colorScheme: "dark" });
      await expect
        .poll(() =>
          browser.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            const footer = dialog
              ?.querySelector('[data-slot="dialog-footer"]')
              ?.getBoundingClientRect();
            return (
              !!dialog &&
              !!footer &&
              dialog.scrollWidth <= dialog.clientWidth + 1 &&
              footer.bottom <= window.innerHeight + 1
            );
          }),
        )
        .toBe(true);
      await app.screenshot("discover-projects-narrow");
      await browser.setViewport({ width: 1280, height: 800 });
      await browser.emulateMedia({ colorScheme: "light" });
      await screen.getByRole("button", "Add 2 projects").tap();
      await screen.getByRole("heading", /^Already added\s*3$/).waitFor();
      await screen.getByRole("button", "Done").tap();
      await picker.tap();
      for (const name of ["web-client", "second-pin"]) {
        await browser.locator(`button[title^="Unpin ${name}"]`).waitFor();
      }
      expect(await pinOrder()).toBe(originalOrder);
      await browser.keyboard.press("Escape");
      await git(["init", "-q", "added-since-scan"]);
      await browser.keyboard.press("ControlOrMeta+k");
      await screen
        .getByPlaceholder("Search commands, projects, and threads...")
        .fill("Discover projects");
      await screen.getByText("Discover projects", { exact: true }).tap();
      await scan(parent);
      await screen.getByRole("checkbox", "added-since-scan").waitFor();
      await screen.getByRole("heading", /^Already added\s*3$/).waitFor();

      await screen.getByRole("combobox", "Machine").tap();
      await browser.locator('[role="option"][aria-selected="false"]').last().click();
      await scan(parent);
      await screen.getByRole("heading", /^New repositories\s*6$/).waitFor();
      await screen.getByRole("checkbox", "design-system").tap();
      await screen.getByRole("checkbox", "platform-api").tap();
      const moved = path.join(parent, "temporarily-moved");
      await runPromise(fs.rename(path.join(parent, "platform-api"), moved));
      try {
        await screen.getByRole("button", "Add 2 projects").tap();
        await screen.getByRole("alert").waitFor();
        await screen.getByRole("heading", /^Already added\s*1$/).waitFor();
      } finally {
        await runPromise(fs.rename(moved, path.join(parent, "platform-api")));
      }
      await screen.getByRole("button", "Retry 1 project").tap();
      await screen.getByRole("heading", /^Already added\s*2$/).waitFor();
      await screen.getByRole("heading", /^New repositories\s*4$/).waitFor();
      await app.screenshot("discover-projects-remote");
    } finally {
      await server.stop();
      for (const name of ["web-client", "design-system", "platform-api"]) {
        await runPromise(
          primary.cli(["project", "remove", path.join(parent, name), "--force"], [0, 1]),
        );
      }
    }
  },
);
