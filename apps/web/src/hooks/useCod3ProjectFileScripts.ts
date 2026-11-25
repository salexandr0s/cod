import {
  COD3_PROJECT_FILE_NAME,
  type EnvironmentId,
  type Cod3ProjectFile,
  type Cod3ProjectFileScript,
} from "@cod3/contracts";
import { parseCod3ProjectFile } from "@cod3/shared/cod3ProjectFile";

import { useProjectFileQuery } from "~/components/files/projectFilesQueryState";

const NO_SCRIPTS: ReadonlyArray<Cod3ProjectFileScript> = [];

export interface Cod3ProjectFileState {
  status: "loading" | "missing" | "invalid" | "valid";
  file: Cod3ProjectFile | null;
  scripts: ReadonlyArray<Cod3ProjectFileScript>;
}

export function useCod3ProjectFileState(
  environmentId: EnvironmentId,
  cwd: string | null,
): Cod3ProjectFileState {
  const query = useProjectFileQuery(environmentId, cwd ?? "", COD3_PROJECT_FILE_NAME, cwd !== null);
  const contents = query.data && !query.data.truncated ? query.data.contents : null;
  const isPending = query.isPending;
  if (contents === null) {
    return {
      status: isPending ? "loading" : "missing",
      file: null,
      scripts: NO_SCRIPTS,
    } as const;
  }
  const file = parseCod3ProjectFile(contents);
  if (file === null) {
    return { status: "invalid", file: null, scripts: NO_SCRIPTS } as const;
  }
  return { status: "valid", file, scripts: file.scripts ?? NO_SCRIPTS } as const;
}

export function useCod3ProjectFileScripts(
  environmentId: EnvironmentId,
  cwd: string | null,
): ReadonlyArray<Cod3ProjectFileScript> {
  return useCod3ProjectFileState(environmentId, cwd).scripts;
}
