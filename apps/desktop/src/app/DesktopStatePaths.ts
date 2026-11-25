import * as Option from "effect/Option";

export type JoinPath = (first: string, ...segments: string[]) => string;

function normalizeConfiguredBaseDir(cod3Home: Option.Option<string>): Option.Option<string> {
  if (Option.isNone(cod3Home)) {
    return Option.none();
  }
  const trimmed = cod3Home.value.trim();
  return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
}

export function resolveDesktopBaseDir(input: {
  readonly homeDirectory: string;
  readonly joinPath: JoinPath;
  readonly cod3Home: Option.Option<string>;
}): string {
  return Option.getOrElse(normalizeConfiguredBaseDir(input.cod3Home), () =>
    input.joinPath(input.homeDirectory, ".cod3"),
  );
}

export function resolveDesktopStateDir(input: {
  readonly baseDir: string;
  readonly isDevelopment: boolean;
  readonly joinPath: JoinPath;
  readonly cod3Home: Option.Option<string>;
}): string {
  const useDevSubdir =
    input.isDevelopment && Option.isNone(normalizeConfiguredBaseDir(input.cod3Home));
  return input.joinPath(input.baseDir, useDevSubdir ? "dev" : "userdata");
}
