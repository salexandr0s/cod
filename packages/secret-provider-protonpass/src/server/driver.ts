import { spawnAndCollect } from "@cod3/provider-core/server/snapshotProbe";
import { defineSecretProviderDriver } from "@cod3/secret-provider-core/server/driver";
import * as Effect from "effect/Effect";
import { ChildProcess } from "effect/process";

import { definition } from "../shared/definition.ts";

const readField = Effect.fn("ProtonPassDriver.readField")(
  function* (reference: string) {
    if (!definition.isReference(reference)) return undefined;
    const { code, stdout } = yield* spawnAndCollect(
      "pass-cli",
      ChildProcess.make("pass-cli", ["item", "view", reference], { stdin: "ignore", shell: false }),
    );
    // pass-cli prints each field with Rust's println!, including one LF after the value.
    if (code !== 0 || !stdout.endsWith("\n")) return undefined;
    const value = stdout.slice(0, -1);
    return value.trim().length > 0 ? value : undefined;
  },
  Effect.orElseSucceed(() => undefined),
);

export const driver = defineSecretProviderDriver({
  kind: definition.kind,
  definition,
  read: Effect.fn("ProtonPassDriver.read")(function* (_config, references) {
    const values: Array<string | undefined> = references.map(() => undefined);
    yield* Effect.forEach(
      references,
      (reference, index) =>
        readField(reference).pipe(
          Effect.map((value) => {
            values[index] = value;
          }),
        ),
      { concurrency: 2, discard: true },
    ).pipe(Effect.timeoutOption("45 seconds"));
    return values;
  }),
});
