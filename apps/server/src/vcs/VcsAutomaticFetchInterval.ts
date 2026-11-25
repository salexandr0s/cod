import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { DEFAULT_AUTOMATIC_GIT_FETCH_INTERVAL } from "@cod3/contracts";
import { resolveServerBackgroundActivitySettings } from "@cod3/shared/backgroundActivitySettings";

import * as ServerSettings from "../serverSettings.ts";

export class VcsAutomaticFetchInterval extends Context.Reference<Effect.Effect<Duration.Duration>>(
  "cod3/vcs/VcsAutomaticFetchInterval",
  { defaultValue: () => Effect.succeed(DEFAULT_AUTOMATIC_GIT_FETCH_INTERVAL) },
) {}

export const layer = Layer.effect(
  VcsAutomaticFetchInterval,
  Effect.gen(function* () {
    const serverSettings = yield* ServerSettings.ServerSettingsService;
    return serverSettings.getSettings.pipe(
      Effect.map(
        (settings) => resolveServerBackgroundActivitySettings(settings).automaticGitFetchInterval,
      ),
      Effect.orElseSucceed(() => DEFAULT_AUTOMATIC_GIT_FETCH_INTERVAL),
    );
  }),
);
