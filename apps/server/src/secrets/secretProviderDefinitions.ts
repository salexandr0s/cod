import { builtInSecretProviderDefinitions } from "@cod3/secret-provider-definitions/registry";
import * as OnePasswordDriver from "@cod3/secret-provider-onepassword/server/driver";
import * as ProtonPassDriver from "@cod3/secret-provider-protonpass/server/driver";

/** In the shared registry's order. */
export const BUILT_IN_SECRET_PROVIDER_DRIVER_LIST = [
  OnePasswordDriver.driver,
  ProtonPassDriver.driver,
] as const;

export const secretProviderDefinitions = builtInSecretProviderDefinitions;
