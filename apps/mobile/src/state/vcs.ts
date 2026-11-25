import { createVcsActionManager, createVcsEnvironmentAtoms } from "@cod3/client-runtime/state/vcs";

import { connectionAtomRuntime } from "../connection/runtime";

export const vcsEnvironment = createVcsEnvironmentAtoms(connectionAtomRuntime);
export const vcsActionManager = createVcsActionManager(connectionAtomRuntime);
