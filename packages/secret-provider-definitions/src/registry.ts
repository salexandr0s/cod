import { makeSecretProviderDefinitionRegistry } from "@cod3/secret-provider-core/shared/definition";
import * as OnePassword from "@cod3/secret-provider-onepassword/shared/definition";
import * as ProtonPass from "@cod3/secret-provider-protonpass/shared/definition";

export const builtInSecretProviderDefinitions = makeSecretProviderDefinitionRegistry([
  OnePassword.definition,
  ProtonPass.definition,
]);
