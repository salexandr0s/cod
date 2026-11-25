import * as HostProcess from "@cod3/shared/HostProcess";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Layer from "effect/Layer";
import * as ProcessRunner from "../processRunner.ts";
import { makeDiscoverProjects } from "./discoverProjects.ts";

it.layer(ProcessRunner.layer.pipe(Layer.provideMerge(NodeServices.layer)))(
  "discoverProjects",
  (it) => {
    it.effect(
      "identifies physical checkouts, separate gitdirs and linked worktrees within the chosen folder",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const runner = yield* ProcessRunner.ProcessRunner;
          const fixture = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
          const root = path.join(fixture, "GitHub");
          yield* fs.makeDirectory(root);
          const git = Effect.fnUntraced(function* (...args: string[]) {
            const result = yield* runner.run({
              command: "git",
              cwd: root,
              args: [
                "-c",
                "user.name=Scenario",
                "-c",
                "user.email=scenario@example.invalid",
                ...args,
              ],
            });
            assert.strictEqual(result.code, 0, result.stderr);
          });
          yield* git("init", "main repo");
          yield* git("-C", "main repo", "commit", "--allow-empty", "-m", "initial");
          yield* git(
            "-C",
            "main repo",
            "worktree",
            "add",
            "--detach",
            path.join(root, ".worktrees", "linked"),
          );
          yield* git(
            "-C",
            "main repo",
            "worktree",
            "add",
            "--detach",
            path.join(fixture, "outside"),
          );
          yield* git("init", "--separate-git-dir", path.join(fixture, "metadata"), "team/separate");
          yield* git("init", "node_modules/dependency");
          yield* git("init", ".hidden");
          yield* fs.makeDirectory(path.join(root, "bad"));
          yield* fs.writeFileString(path.join(root, "bad", ".git"), "invalid");
          yield* fs.makeDirectory(path.join(root, "empty"));
          const scan = yield* makeDiscoverProjects.pipe(
            Effect.provideService(HostProcess.HomeDirectory, fixture),
          );
          const found = yield* scan({ workspaceRoot: "~/GitHub" });
          assert.strictEqual(found.workspaceRoot, root);
          assert.deepEqual(
            found.repositories.map(({ name, linkedWorktree }) => [name, linkedWorktree]),
            [
              ["linked", true],
              ["main repo", false],
              ["separate", false],
            ],
          );
          assert.strictEqual(found.skipped, 1);
          assert.isFalse(found.truncated);
          const linked = yield* scan({ workspaceRoot: path.join(fixture, "outside") });
          assert.deepEqual(
            linked.repositories.map((row) => row.linkedWorktree),
            [true],
          );
          assert.deepEqual(
            (yield* scan({ workspaceRoot: path.join(root, "empty") })).repositories,
            [],
          );
          const missing = yield* Effect.flip(scan({ workspaceRoot: path.join(root, "missing") }));
          assert.strictEqual(missing.operation, "scan");
        }),
    );
  },
);
