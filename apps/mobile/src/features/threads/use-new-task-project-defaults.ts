import { resolveFilesystemReadAccess } from "@cod3/client-runtime/state/filesystem";
import { isScratchProject } from "@cod3/client-runtime/state/projects";
import type { EnvironmentProject } from "@cod3/client-runtime/state/shell";
import type { ProjectReadFileResult } from "@cod3/contracts";
import { DEFAULT_SERVER_SETTINGS, COD3_PROJECT_FILE_NAME } from "@cod3/contracts";
import { resolveNewThreadEnvMode, resolveProjectSettings } from "@cod3/shared/projectSettings";
import { parseCod3ProjectFile } from "@cod3/shared/cod3ProjectFile";

import { m } from "../../i18n/messages";
import { useEnvironmentServerConfig } from "../../state/entities";
import { useEnvironmentPresentation } from "../../state/presentation";
import { useProjectHasThreads } from "../../state/project-has-threads";
import { projectEnvironment } from "../../state/projects";
import { useEnvironmentQuery } from "../../state/query";
import { environmentSession } from "../../state/session";

/**
 * A project's new-task defaults: server settings merged with its cod3.json. The
 * new-task flow and the home pending-drafts list both read the default
 * workspace mode here, so a draft that never picked one shows what it sends.
 * Every read is a shared per-environment or per-project atom.
 */
export function useNewTaskProjectDefaults(project: EnvironmentProject | null) {
  const serverConfig = useEnvironmentServerConfig(project?.environmentId ?? null);
  const isScratch =
    project !== null && isScratchProject(project, serverConfig?.scratchWorkspaceRoot);
  const hasWorkspace = project !== null && project.workspaceRoot !== "";
  const fileAccessSession = useEnvironmentQuery(
    hasWorkspace ? environmentSession.sessionStateAtom(project.environmentId) : null,
  );
  const fileEnvironment = useEnvironmentPresentation(project?.environmentId ?? null);
  const fileAccess = resolveFilesystemReadAccess(
    {
      isCatalogReady: fileEnvironment.isReady,
      connection: fileEnvironment.presentation?.connection ?? null,
      session: fileAccessSession.data,
      sessionError: fileAccessSession.error,
    },
    m,
  );
  const fileAccessPending = hasWorkspace && fileAccess.isPending;
  const cod3ProjectFileQuery = useEnvironmentQuery(
    fileAccess.canReadFiles && hasWorkspace
      ? projectEnvironment.readFile({
          environmentId: project.environmentId,
          input: {
            cwd: project.workspaceRoot,
            relativePath: COD3_PROJECT_FILE_NAME,
            allowMissing: true,
          },
        })
      : null,
  );
  const cod3ProjectFileData = cod3ProjectFileQuery.data as ProjectReadFileResult | null;
  const cod3ProjectFile =
    cod3ProjectFileData === null ||
    cod3ProjectFileData.exists === false ||
    cod3ProjectFileData.truncated
      ? null
      : parseCod3ProjectFile(cod3ProjectFileData.contents);
  const projectSettings = resolveProjectSettings(
    serverConfig?.settings ?? DEFAULT_SERVER_SETTINGS,
    project?.id ?? null,
    project,
    cod3ProjectFile,
  );
  const projectHasThreads = useProjectHasThreads(project);
  const defaultWorkspaceMode = isScratch
    ? "local"
    : resolveNewThreadEnvMode({
        projectSettings,
        workspaceRoot: project?.workspaceRoot ?? null,
        newProjectsRoot: serverConfig?.newProjectsRoot,
        projectHasThreads,
      });
  // While cod3.json loads, the environment default is provisional; cod3.json may replace it.
  const defaultWorkspaceModeSettled =
    projectSettings.sources.defaultThreadEnvMode !== "environment" ||
    (!cod3ProjectFileQuery.isPending && !fileAccessPending);
  return {
    serverConfig,
    isScratch,
    projectSettings,
    defaultWorkspaceMode,
    defaultWorkspaceModeSettled,
  };
}
