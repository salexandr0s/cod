import type { ProjectEntry } from "@cod3/contracts";
import { scoreQueryMatch } from "@cod3/shared/searchRanking";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export const assistants = ["claude", "codex"] as const;
export type Assistant = (typeof assistants)[number];
export const sections = [
  "skills",
  "agents",
  "commands",
  "workflows",
  "configuration",
  "guides",
  "external",
] as const;
export type Section = (typeof sections)[number];

const binding = Schema.Struct({ id: Schema.String, name: Schema.String, source: Schema.String });
const decodeManifest = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Struct({
      bindings: Schema.Struct({ claude: Schema.Array(binding), codex: Schema.Array(binding) }),
      packages: Schema.Array(Schema.Struct({ path: Schema.String, description: Schema.String })),
      external_skills: Schema.optional(
        Schema.Array(
          Schema.Struct({
            id: Schema.String,
            source: Schema.String,
            source_label: Schema.String,
            reason: Schema.String,
          }),
        ),
      ),
    }),
  ),
);

interface Edition {
  path: string;
  assistant: Assistant | null;
  description: string;
  name: string;
}

export interface CatalogItem {
  title: string;
  section: Section;
  editions: Edition[];
}

export const assistantName = { claude: "Claude", codex: "Codex" } as const;
const packagePath = /^(claude|codex|shared)\/skills\/[\w.-]+$/u;
const readable =
  /(?:\.(?:md|markdown|json|toml|yaml|yml|rules|txt|sh|py|js|mjs|ts|tsx|css|html|plist|svg)|\/LICENSE|\/NOTICE)$/iu;

export function buildCatalog(entries: readonly ProjectEntry[], manifestText?: string) {
  const files = new Set(
    entries.filter((entry) => entry.kind === "file" && !entry.ignored).map((entry) => entry.path),
  );
  const manifest =
    manifestText === undefined ? undefined : Option.getOrUndefined(decodeManifest(manifestText));
  const descriptions = new Map(manifest?.packages.map((pkg) => [pkg.path, pkg.description]));
  const items = new Map<string, CatalogItem>();
  const bound = new Set<string>();
  const add = (section: Section, title: string, edition: Edition) => {
    const key = section + "/" + title;
    const item = items.get(key) ?? { section, title, editions: [] };
    item.editions.push(edition);
    items.set(key, item);
  };
  for (const assistant of assistants) {
    for (const skill of manifest?.bindings[assistant] ?? []) {
      if (!packagePath.test(skill.source) || !files.has(skill.source + "/SKILL.md")) continue;
      add("skills", skill.id, {
        path: skill.source + "/SKILL.md",
        assistant,
        name: skill.name,
        description: descriptions.get(skill.source) ?? "",
      });
      bound.add(skill.source);
      bound.add(assistant + "/skills/" + skill.id);
    }
  }
  for (const path of files) {
    const template =
      path === "claude/.env.example" ||
      path === "claude/.protected.json" ||
      path === "claude/.manifest.json";
    if (!template && (!readable.test(path) || path.split("/").some((part) => part.startsWith("."))))
      continue;
    const [scope, folder, id, leaf] = path.split("/");
    const assistant = assistants.find((a) => a === scope) ?? null;
    if (
      assistant === null &&
      scope !== "shared" &&
      scope !== "docs" &&
      scope !== "scripts" &&
      scope !== "launchagents" &&
      path !== "README.md" &&
      path !== "skills-manifest.json" &&
      path !== "install.sh"
    )
      continue;
    if (folder === "skills") {
      const dir = path.slice(0, -"/SKILL.md".length);
      if (id && leaf === "SKILL.md" && packagePath.test(dir) && !bound.has(dir)) {
        add("skills", id, { path, assistant, name: id, description: descriptions.get(dir) ?? "" });
      }
      continue;
    }
    if (scope === "docs" && !/\.(md|markdown)$/iu.test(path)) continue;
    const section =
      folder === "agents" || folder === "commands" || folder === "workflows"
        ? folder
        : scope === "docs" || path === "README.md"
          ? "guides"
          : "configuration";
    const title =
      section === "configuration" || section === "guides"
        ? path
        : path
            .split("/")
            .slice(2)
            .join("/")
            .replace(/\.[^.]+$/u, "");
    add(section, title, { path, assistant, name: title, description: "" });
  }
  return {
    files,
    items: [...items.values()].sort((a, b) => a.title.localeCompare(b.title)),
    external: manifest?.external_skills ?? [],
    invalidManifest: manifestText !== undefined && !manifest,
  };
}

export function searchCatalog(
  catalog: ReturnType<typeof buildCatalog>,
  query: string,
  assistant: Assistant | null,
) {
  const words = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const score = (title: string, name: string, path: string, description: string) => {
    if (!words.length) return 0;
    const names = [title, name].map((value) => value.toLowerCase());
    const location = path.toLowerCase();
    const body = description.toLowerCase();
    let rank = 0;
    for (const word of words) {
      const nameRank = Math.min(
        ...names.map(
          (value) =>
            scoreQueryMatch({
              value,
              query: word,
              exactBase: 0,
              prefixBase: 1,
              boundaryBase: 2,
              includesBase: 3,
              ignorePosition: true,
            }) ?? Infinity,
        ),
      );
      if (Number.isFinite(nameRank)) rank += nameRank;
      else if (location.includes(word)) rank += 4;
      else if (body.includes(word)) rank += 5;
      else return Infinity;
    }
    return rank;
  };
  const items = catalog.items
    .flatMap((item) => {
      const editions = item.editions.filter(
        (edition) => !assistant || !edition.assistant || edition.assistant === assistant,
      );
      const ranked = editions
        .map((edition) => ({
          edition,
          rank: score(
            item.title.split("/").at(-1) ?? item.title,
            edition.name,
            edition.path,
            edition.description,
          ),
        }))
        .sort((a, b) => a.rank - b.rank);
      const best = ranked[0];
      return best && Number.isFinite(best.rank)
        ? [{ ...item, editions, first: best.edition, rank: best.rank }]
        : [];
    })
    .sort((a, b) => a.rank - b.rank);
  const external = assistant
    ? []
    : catalog.external.filter((entry) =>
        Number.isFinite(score(entry.id, entry.source_label, entry.source, entry.reason)),
      );
  return { items, external };
}

export function packageFiles(files: ReadonlySet<string>, path: string) {
  const match = /^((?:claude|codex|shared)\/skills\/[\w.-]+)\//u.exec(path);
  if (!match) return [];
  const prefix = match[1] + "/";
  return [...files].filter((file) => file.startsWith(prefix) && readable.test(file)).sort();
}

export function linkedCatalogFile(files: ReadonlySet<string>, document: string, href: string) {
  if (!href || href.startsWith("#") || /^[a-z][\w+.-]*:|^[/\\]/iu.test(href)) return null;
  try {
    const url = new URL(href, new URL(document, "https://repo.invalid/"));
    const path = decodeURIComponent(url.pathname.slice(1)).replace(/\/$/u, "");
    const file = [path, path + "/SKILL.md", path + "/README.md"].find(
      (candidate) => files.has(candidate) && readable.test(candidate),
    );
    return file ? { file, hash: url.hash.slice(1) } : null;
  } catch {
    return null;
  }
}
