import { SecretProviderKind } from "@cod3/contracts";
import { defineSecretProvider } from "@cod3/secret-provider-core/shared/definition";
import * as Schema from "effect/Schema";

// The CLI also accepts whole-item URIs. Require a field before passing any reference to it.
const referencePattern =
  /^pass:\/\/([^/?#@:]+)\/([^/?#]+)\/([^/?#]+(?:\/[^/?#]+)*)(?:\?totp=(?:code|uri))?$/u;

function isReference(reference: string) {
  if (reference.length > 1024 || /\p{Cc}/u.test(reference)) return false;
  const match = referencePattern.exec(reference);
  if (!match) return false;
  try {
    return match.slice(1).every((part) => {
      const decoded = decodeURIComponent(part);
      return decoded.trim().length > 0 && !/\p{Cc}/u.test(decoded);
    });
  } catch {
    return false;
  }
}

export const definition = defineSecretProvider({
  kind: SecretProviderKind.make("proton_pass"),
  label: "Proton Pass",
  configSchema: Schema.Struct({}),
  isReference,
  referencePlaceholder: "pass://vault/item/field",
  invalidReferenceMessage: "Use a Proton Pass reference like pass://vault/item/field.",
});
