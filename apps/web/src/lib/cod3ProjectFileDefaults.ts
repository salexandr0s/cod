import {
  COD3_PROJECT_FILE_NAME,
  type EnvironmentId,
  type ProjectReadFileResult,
  type Cod3ProjectFile,
} from "@cod3/contracts";
import { parseCod3ProjectFile } from "@cod3/shared/cod3ProjectFile";
import { executeAtomQuery } from "@cod3/client-runtime/state/runtime";
import { AsyncResult } from "effect/reactivity";

import {
  getProjectFileQueryAtom,
  resolveProjectFileQueryData,
} from "~/components/files/projectFilesQueryState";
import { appAtomRegistry } from "~/rpc/atomRegistry";

function toCod3ProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
  result: ProjectReadFileResult | null,
): Cod3ProjectFile | null {
  const data = resolveProjectFileQueryData(
    environmentId,
    workspaceRoot,
    COD3_PROJECT_FILE_NAME,
    result,
  );
  if (data === null || data.exists === false || data.truncated) return null;
  return parseCod3ProjectFile(data.contents);
}

export async function readCod3ProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
): Promise<Cod3ProjectFile | null> {
  const result = await executeAtomQuery(
    appAtomRegistry,
    getProjectFileQueryAtom(environmentId, workspaceRoot, COD3_PROJECT_FILE_NAME),
    { reportDefect: false, reportFailure: false },
  );
  return toCod3ProjectFile(
    environmentId,
    workspaceRoot,
    result._tag === "Success" ? result.value : null,
  );
}

/** The project's cod3.json from an earlier read, or `undefined` when none has loaded yet. */
export function peekCod3ProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
): Cod3ProjectFile | null | undefined {
  const result = appAtomRegistry.get(
    getProjectFileQueryAtom(environmentId, workspaceRoot, COD3_PROJECT_FILE_NAME),
  );
  return AsyncResult.isSuccess(result)
    ? toCod3ProjectFile(environmentId, workspaceRoot, result.value)
    : undefined;
}
