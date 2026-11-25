import type { PullRequestChangeBreakdown } from "@cod3/contracts";
import { summarizeChangedFiles } from "@cod3/shared/changedFileKind";
import type { ProviderFileStats } from "@cod3/source-control-core/server/PullRequestProvider";

export function toChangeBreakdown(stats: ProviderFileStats): PullRequestChangeBreakdown {
  if (stats.truncated) return null;
  return summarizeChangedFiles(stats.files);
}
