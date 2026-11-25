import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcessSpawner } from "effect/process";

import { definition } from "../shared/definition.ts";
import { driver } from "./driver.ts";

describe("Proton Pass", () => {
  it("requires a vault, item and field, including for TOTP references", () => {
    for (const reference of [
      "pass://私用/My login/Section.API key",
      "pass://Team%20Vault/My%2Fitem/token",
      "pass://vault/item/totp?totp=code",
      "pass://vault/item/custom/nested",
    ])
      assert.isTrue(definition.isReference(reference), reference);
    for (const reference of [
      "op://vault/item/field",
      "pass://vault/item",
      "pass://vault/item/",
      "pass://vault/item?field=/password",
      "pass://vault/item#fragment/password",
      "pass://vault/item/?totp=uri",
      "pass://vault/item/%0A",
      "pass://v/i/%xx",
      "pass://vault/item/pw?totp=anything",
      "pass://vault/item/pw\n",
    ])
      assert.isFalse(definition.isReference(reference), reference);
  });

  it.effect("passes each field as one argument and isolates unreadable fields", () => {
    const field = "pass://My vault/CI/key";
    const missing = "pass://My vault/CI/missing";
    const calls: string[][] = [];
    const spawner = ChildProcessSpawner.make((command) =>
      Effect.sync(() => {
        if (command._tag !== "StandardCommand") throw new Error("Expected a direct command");
        calls.push([command.command, ...command.args.map(String)]);
        const ok = command.args.at(-1) === field;
        return ChildProcessSpawner.makeHandle({
          pid: ChildProcessSpawner.ProcessId(1),
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(ok ? 0 : 1)),
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          unref: Effect.succeed(Effect.void),
          stdin: Sink.drain,
          stdout: Stream.make(
            new TextEncoder().encode(ok ? "  first\nsecond \r\n\n" : "partial value"),
          ),
          stderr: Stream.make(new TextEncoder().encode("private diagnostic")),
          all: Stream.empty,
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
        });
      }),
    );
    return Effect.gen(function* () {
      assert.deepStrictEqual(yield* driver.read({}, [missing, "pass://My vault/CI", field]), [
        undefined,
        undefined,
        "  first\nsecond \r\n",
      ]);
      assert.deepStrictEqual(
        calls.toSorted(),
        [
          ["pass-cli", "item", "view", field],
          ["pass-cli", "item", "view", missing],
        ].toSorted(),
      );
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
          NodeFileSystem.layer,
          NodeCrypto.layer,
        ),
      ),
    );
  });
});
