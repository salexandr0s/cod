import {
  threadRuntimeCanArchive,
  type ThreadRuntimeSummary,
} from "@cod3/client-runtime/state/models";

export function threadCanArchive(runtime: ThreadRuntimeSummary | null | undefined): boolean {
  return threadRuntimeCanArchive(runtime);
}
