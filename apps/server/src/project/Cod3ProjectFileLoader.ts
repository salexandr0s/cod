import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { COD3_PROJECT_FILE_NAME, type Cod3ProjectFile } from "@cod3/contracts";
import { Cod3ProjectFileFromJson } from "@cod3/shared/cod3ProjectFile";

const decodeCod3ProjectFileJson = Schema.decodeEffect(Cod3ProjectFileFromJson);

export class Cod3ProjectFileLoadError extends Schema.TaggedError<Cod3ProjectFileLoadError>()(
  "Cod3ProjectFileLoadError",
  {
    operation: Schema.Literals(["read", "decode"]),
    workspaceRoot: Schema.String,
    filePath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation} ${COD3_PROJECT_FILE_NAME} at ${this.filePath}.`;
  }
}

export class Cod3ProjectFileLoader extends Context.Service<
  Cod3ProjectFileLoader,
  {
    /** Never fails; missing/unreadable/invalid files return none, with warnings for invalid files. */
    readonly load: (workspaceRoot: string) => Effect.Effect<Option.Option<Cod3ProjectFile>>;
  }
>()("cod3/project/Cod3ProjectFileLoader") {}

const logCod3ProjectFileLoadError = (error: Cod3ProjectFileLoadError) =>
  Effect.logWarning(error).pipe(
    Effect.annotateLogs({
      operation: error.operation,
      workspaceRoot: error.workspaceRoot,
      filePath: error.filePath,
      errorTag: error._tag,
    }),
  );

/** @public */
export const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const load: Cod3ProjectFileLoader["Service"]["load"] = Effect.fn("Cod3ProjectFileLoader.load")(
    function* (workspaceRoot) {
      const filePath = path.join(workspaceRoot, COD3_PROJECT_FILE_NAME);
      const raw = yield* fileSystem.readFileString(filePath).pipe(
        Effect.asSome,
        Effect.catchTags({
          PlatformError: (error) =>
            error.reason._tag === "NotFound"
              ? Effect.succeed(Option.none<string>())
              : logCod3ProjectFileLoadError(
                  new Cod3ProjectFileLoadError({
                    operation: "read",
                    workspaceRoot,
                    filePath,
                    cause: error,
                  }),
                ).pipe(Effect.as(Option.none<string>())),
        }),
      );
      if (Option.isNone(raw)) {
        return Option.none<Cod3ProjectFile>();
      }
      return yield* decodeCod3ProjectFileJson(raw.value).pipe(
        Effect.asSome,
        Effect.catchTags({
          SchemaError: (error) =>
            logCod3ProjectFileLoadError(
              new Cod3ProjectFileLoadError({
                operation: "decode",
                workspaceRoot,
                filePath,
                cause: error,
              }),
            ).pipe(Effect.as(Option.none<Cod3ProjectFile>())),
        }),
      );
    },
  );

  return Cod3ProjectFileLoader.of({ load });
});

export const layer = Layer.effect(Cod3ProjectFileLoader, make);
