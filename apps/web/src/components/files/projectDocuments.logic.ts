import type { ProjectEntry } from "@cod3/contracts";

const names = [
  ["checklist", "checklists", "projectchecklist", "implementationchecklist", "launchchecklist"],
  ["goal", "goals", "projectgoal", "projectgoals"],
  ["requirements", "technicalrequirements", "projectrequirements", "productrequirements", "prd"],
  ["spec", "specs", "specification", "technicalspec", "technicalspecification", "specifications"],
  ["plan", "projectplan", "implementationplan", "roadmap", "tasks", "todo"],
];

export function projectDocumentRank(path: string) {
  const match = /^(?:docs\/)?([^/]+)\.(?:md|markdown)$/i.exec(path);
  if (!match) return -1;
  const stem = match[1]!.toLowerCase().replace(/[\s_-]+/g, "");
  return names.findIndex((group) => group.includes(stem));
}

export function projectDocsDirectory(entries: readonly ProjectEntry[]) {
  return entries.find((entry) => entry.kind === "directory" && entry.path.toLowerCase() === "docs")
    ?.path;
}

export function findProjectDocuments(entries: readonly ProjectEntry[]) {
  return entries
    .filter((entry) => entry.kind === "file")
    .map(({ path }) => ({ path, rank: projectDocumentRank(path) }))
    .filter(({ rank }) => rank !== -1)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(a.path.includes("/")) - Number(b.path.includes("/")) ||
        a.path.localeCompare(b.path),
    );
}
