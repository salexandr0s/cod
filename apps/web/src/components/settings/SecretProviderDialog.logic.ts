import {
  SecretProviderId,
  SecretProviderKind,
  SecretProviderLabel,
  type SecretProviderConfig,
} from "@cod3/contracts";
import {
  definition as onePassword,
  OnePasswordSecretProviderConfig,
  type OnePasswordAccount,
} from "@cod3/secret-provider-onepassword/shared/definition";
import { definition as protonPass } from "@cod3/secret-provider-protonpass/shared/definition";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { msg } from "gt-react";

import { m, type MessageResolver } from "../../i18n/messages";

export const secretProviderChoices = [
  { value: "one_password", label: onePassword.label },
  { value: "proton_pass", label: protonPass.label },
] as const;

const isProtonPassConfig = Schema.is(protonPass.configSchema);
const decodeSecretProviderId = Schema.decodeOption(SecretProviderId);
const decodeOnePasswordConfig = Schema.decodeUnknownOption(OnePasswordSecretProviderConfig);

export type ClassifiedSecretProvider =
  | { readonly kind: "one_password"; readonly account: OnePasswordAccount }
  | { readonly kind: "proton_pass" }
  | { readonly kind: "unsupported" };

/** Unknown kinds and configs that no longer decode are shown read-only; removal stays available. */
export function classifySecretProvider(provider: SecretProviderConfig): ClassifiedSecretProvider {
  if (provider.kind === "proton_pass") {
    return isProtonPassConfig(provider.config) ? { kind: "proton_pass" } : { kind: "unsupported" };
  }
  if (provider.kind !== "one_password") return { kind: "unsupported" };
  const decoded = decodeOnePasswordConfig(provider.config);
  return decoded._tag === "Some"
    ? { kind: "one_password", account: decoded.value.account }
    : { kind: "unsupported" };
}

/** Stable and readable in settings.json, so re-adding a provider under the same name restores its variables. */
function secretProviderIdFromName(name: string): SecretProviderId | null {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/, "");
  return Option.getOrNull(decodeSecretProviderId(slug));
}

export interface SecretProviderDraft {
  readonly kind: (typeof secretProviderChoices)[number]["value"];
  readonly name: string;
  readonly account: string;
}

export function draftFromSecretProvider(provider: SecretProviderConfig): SecretProviderDraft {
  const classified = classifySecretProvider(provider);
  return {
    kind: classified.kind === "proton_pass" ? "proton_pass" : "one_password",
    name: provider.label,
    account: classified.kind === "one_password" ? classified.account : "",
  };
}

export type SecretProviderTarget =
  | { readonly mode: "add" }
  | { readonly mode: "edit"; readonly id: SecretProviderId };

export type SecretProviderDraftIssues = {
  readonly [Field in keyof SecretProviderDraft]?: string;
};

function decodeField<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: string,
  emptyMessage: string,
): Result.Result<S["Type"], string> {
  const trimmed = value.trim();
  if (trimmed.length === 0) return Result.fail(emptyMessage);
  return Result.mapError(Schema.decodeResult(schema)(trimmed), (error) => error.message);
}

/** The settings entry a draft adds or replaces, or every field that blocks it, one message each. */
export function secretProviderFromDraft(
  draft: SecretProviderDraft,
  existingIds: ReadonlySet<string>,
  target: SecretProviderTarget,
  resolve: MessageResolver = m,
): Result.Result<
  { readonly id: SecretProviderId; readonly config: SecretProviderConfig },
  SecretProviderDraftIssues
> {
  const label = decodeField(SecretProviderLabel, draft.name, resolve(msg("Enter a name.")));
  const config =
    draft.kind === "proton_pass"
      ? Result.succeed({})
      : Result.map(
          decodeField(
            OnePasswordSecretProviderConfig.fields.account,
            draft.account,
            resolve(msg("Enter the 1Password account.")),
          ),
          (account) => ({ account }),
        );

  let id: SecretProviderId | null = null;
  let nameIssue: string | undefined;
  if (Result.isFailure(label)) {
    nameIssue = label.failure;
  } else {
    id = target.mode === "edit" ? target.id : secretProviderIdFromName(label.success);
    if (id === null) nameIssue = resolve(msg("The name needs at least one letter or digit."));
    else if (target.mode === "add" && existingIds.has(id))
      nameIssue = resolve(msg("A secret provider with this name exists."));
  }

  if (
    id === null ||
    nameIssue !== undefined ||
    Result.isFailure(label) ||
    Result.isFailure(config)
  ) {
    return Result.fail({
      ...(nameIssue === undefined ? {} : { name: nameIssue }),
      ...(Result.isFailure(config) ? { account: config.failure } : {}),
    });
  }
  return Result.succeed({
    id,
    config: {
      kind: SecretProviderKind.make(draft.kind),
      label: label.success,
      config: config.success,
    },
  });
}
