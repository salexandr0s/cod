// @effect-diagnostics-next-line nodeBuiltinImport:off -- directory entry types skip symlinks without a stat per entry.
import * as NodeFSP from "node:fs/promises";
import * as Path from "effect/Path";
import {
  WorkspaceFoldersError,
  type WorkspaceDiscoverProjectsResult,
  type WorkspaceScanFoldersInput,
} from "@cod3/contracts";
import { expandHomePath } from "@cod3/provider-core/server/pathExpansion";
import * as HostProcess from "@cod3/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as ProcessRunner from "../processRunner.ts";
import { unsetInheritedRepositoryEnv } from "../vcs/VcsProcess.ts";

const MAX_FOLDERS = 2048;
const MAX_REPOSITORIES = 512;

const scanError = (detail: string) => new WorkspaceFoldersError({ operation: "scan", detail });
type Repository = WorkspaceDiscoverProjectsResult["repositories"][number];

export const makeDiscoverProjects = Effect.gen(function* () {
  const runner = yield* ProcessRunner.ProcessRunner;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* HostProcess.HomeDirectory;
  const platform = yield* HostProcess.Platform;

  return Effect.fn("ProjectService.discoverProjects")(function* ({
    workspaceRoot,
  }: WorkspaceScanFoldersInput) {
    const expanded = expandHomePath(workspaceRoot, home);
    if (!path.isAbsolute(expanded)) return yield* scanError("Choose an absolute folder path.");
    const root = yield* fileSystem
      .realPath(expanded)
      .pipe(Effect.mapError(() => scanError(`Could not open ${workspaceRoot}.`)));
    const repositories = new Map<string, Repository>();
    let skipped = 0;
    let truncated = false;
    let visited = 0;
    let level = [root];

    const remember = (checkout: string, linkedWorktree: boolean) => {
      if (repositories.has(checkout)) return;
      if (repositories.size >= MAX_REPOSITORIES) {
        truncated = true;
        return;
      }
      repositories.set(checkout, {
        path: checkout,
        name: path.basename(checkout) || checkout,
        linkedWorktree,
      });
    };
    const git = (folder: string, args: string[]) =>
      runner.run({
        command: "git",
        args: ["-C", folder, ...args],
        env: unsetInheritedRepositoryEnv(process.env, platform),
        timeout: "5 seconds",
        maxOutputBytes: 512 * 1024,
      });
    const inspect = Effect.fnUntraced(function* (folder: string, depth: number) {
      if (repositories.has(folder)) return [];
      const hasGit = yield* fileSystem.exists(path.join(folder, ".git"));
      if (!hasGit) {
        if (depth === 2) return [];
        const entries = yield* Effect.tryPromise({
          try: () => NodeFSP.readdir(folder, { withFileTypes: true }),
          catch: () => scanError(`Could not read ${folder}.`),
        });
        return entries
          .filter(
            (entry) =>
              entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules",
          )
          .map((entry) => path.join(folder, entry.name));
      }
      const result = yield* git(folder, ["worktree", "list", "--porcelain", "-z"]);
      if (result.code !== 0) {
        skipped++;
        return [];
      }
      // Git lists the main checkout first even with a separate gitdir. A linked checkout may
      // live under an otherwise hidden folder, or belong to a main checkout outside this scan.
      for (const [index, record] of result.stdout.split("\0\0").entries()) {
        const [field, ...flags] = record.split("\0");
        if (
          !field?.startsWith("worktree ") ||
          flags.includes("bare") ||
          flags.some((f) => f.startsWith("prunable"))
        )
          continue;
        const checkout = path.normalize(field.slice("worktree ".length));
        const relative = path.relative(root, checkout);
        if (
          relative === ".." ||
          relative.startsWith(".." + path.sep) ||
          path.isAbsolute(relative) ||
          repositories.has(checkout)
        )
          continue;
        if (checkout !== folder && !(yield* fileSystem.exists(path.join(checkout, ".git"))))
          continue;
        remember(checkout, index > 0);
      }
      // With --separate-git-dir, Git may list the metadata directory as its main worktree.
      if (!repositories.has(folder) && repositories.size < MAX_REPOSITORIES) {
        const inside = yield* git(folder, ["rev-parse", "--is-inside-work-tree"]);
        if (inside.code === 0 && inside.stdout.trim() === "true") remember(folder, false);
      }
      return [];
    });

    for (let depth = 0; depth <= 2 && level.length > 0; depth++) {
      const children = yield* Effect.forEach(
        level,
        (folder) =>
          inspect(folder, depth).pipe(
            Effect.catch((error) => {
              if (error._tag === "ProcessSpawnError")
                return Effect.fail(scanError("Could not start Git on this machine."));
              if (folder === root) return Effect.fail(scanError(`Could not inspect ${root}.`));
              skipped++;
              return Effect.succeed([]);
            }),
          ),
        { concurrency: 4 },
      );
      visited += level.length;
      const next = children.flat().sort();
      level = next.slice(0, MAX_FOLDERS - visited);
      if (next.length > level.length) truncated = true;
      if (repositories.size >= MAX_REPOSITORIES && level.length) {
        truncated = true;
        break;
      }
    }

    return {
      workspaceRoot: root,
      repositories: [...repositories.values()].sort((a, b) => a.path.localeCompare(b.path)),
      skipped,
      truncated,
    };
  });
}).pipe(Effect.provide(ProcessRunner.layer));
