import { expect } from "e2e";
import { test, WEB } from "./cod3.ts";

test(
  "Read shared skills, provider editions and linked files from the sidebar",
  WEB,
  async ({ app, screen, browser, cod3 }) => {
    const doc = (provider: string) => ({
      id: "review",
      name: "review",
      source: provider + "/skills/review",
    });
    const common = { id: "writing", name: "writing", source: "shared/skills/writing" };
    const project = await cod3.project("AI_Config", {
      "skills-manifest.json": JSON.stringify({
        packages: [{ path: common.source, description: "A shared writing guide." }],
        bindings: { claude: [common, doc("claude")], codex: [common, doc("codex")] },
      }),
      "shared/skills/writing/SKILL.md":
        "---\nname: writing\n---\n# Writing guide\n\nRead the [examples](examples.md#verbs).\n\n## First draft\n\n" +
        "Write one paragraph.\n\n".repeat(60) +
        "## Revision\n\nRead the draft.",
      "shared/skills/writing/examples.md":
        "# Worked examples\n\n## Verbs\n\n- Prefer concrete verbs.",
      "claude/skills/review/SKILL.md": "# Claude review",
      "codex/skills/review/SKILL.md": "# Codex review",
      "codex/config.base.toml": 'model = "example"',
    });
    const thread = await cod3.thread({
      project,
      title: "Configuration review",
      messages: ["Browse the configuration."],
    });
    await browser.setViewport({ width: 1280, height: 800 });
    await cod3.open(thread);
    await screen.getByRole("button", "AI configuration").tap();
    await screen.getByRole("button", /^Skills\s*2$/).waitFor();
    const search = screen.getByRole("searchbox", "Search library");
    await search.fill("base codex");
    await screen.getByRole("link", /^config.base.toml/).waitFor();
    await screen.getByRole("button", /^Skills\s*0$/).tap();
    await expect(screen.getByText("No matching entries.")).toBeVisible();
    await search.fill("base");
    await expect(screen.getByText("No matching entries.")).toBeVisible();
    await screen.getByRole("button", /^Search results\s*1$/).tap();
    await screen.getByRole("button", "Clear search").first().tap();
    await screen.getByRole("link", /^writing/).tap();
    await expect(screen.getByRole("heading", "Writing guide")).toBeVisible();
    await screen.getByRole("button", "On this page").tap();
    await screen.getByRole("menuitem", "Revision").tap();
    await expect
      .poll(() => browser.evaluate(() => document.activeElement?.textContent ?? null))
      .toBe("Revision");
    await screen.getByRole("button", "Show markdown source").tap();
    await browser.locator("diffs-container").first().waitFor();
    await screen.getByRole("button", "Show rendered markdown").tap();
    await screen.getByRole("link", "examples", { exact: true }).tap();
    await expect(screen.getByRole("heading", "Worked examples")).toBeVisible();
    await screen.getByRole("link", "Back to library").tap();
    await screen.getByRole("searchbox", "Search library").fill("review");
    await screen.getByRole("link", /^review/).tap();
    await screen.getByRole("link", "Codex", { exact: true }).tap();
    await expect(screen.getByRole("heading", "Codex review")).toBeVisible();
    await browser.setViewport({ width: 390, height: 740 });
    await app.screenshot("configuration-reader-narrow");
    await screen.getByRole("link", "Back to library").tap();
    await expect(search).toHaveValue("review");
    await screen.getByRole("button", "Clear search").tap();
    await screen.getByRole("combobox", "Library sections").tap();
    await screen.getByRole("option", /^Configuration/).tap();
    await screen.getByRole("link", /^config.base.toml/).waitFor();
    await expect
      .poll(() => browser.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  },
);
