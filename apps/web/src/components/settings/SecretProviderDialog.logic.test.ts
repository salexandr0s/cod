import { SecretProviderId } from "@cod3/contracts";
import * as Result from "effect/Result";
import { describe, expect, it } from "vite-plus/test";

import { secretProviderFromDraft } from "./SecretProviderDialog.logic";

describe("secretProviderFromDraft", () => {
  it("adds a provider keyed by its name and reports every field that blocks it", () => {
    expect(
      secretProviderFromDraft(
        { kind: "one_password", name: "  1Password!  ", account: "my.1password.com" },
        new Set(),
        {
          mode: "add",
        },
      ),
    ).toEqual(
      Result.succeed({
        id: "1password",
        config: {
          kind: "one_password",
          label: "1Password!",
          config: { account: "my.1password.com" },
        },
      }),
    );

    const blocked = secretProviderFromDraft(
      { kind: "one_password", name: "1Password", account: "--help" },
      new Set(["1password"]),
      { mode: "add" },
    );
    expect(Result.isFailure(blocked) && Object.keys(blocked.failure).toSorted()).toEqual([
      "account",
      "name",
    ]);
  });

  it("saves Proton Pass without an account or any fields left from 1Password", () => {
    const result = secretProviderFromDraft(
      { kind: "proton_pass", name: "Team", account: "old.1password.com" },
      new Set(),
      { mode: "add" },
    );
    expect(result).toEqual(
      Result.succeed({ id: "team", config: { kind: "proton_pass", label: "Team", config: {} } }),
    );
  });

  it("keeps the id when an edit renames the provider", () => {
    const id = SecretProviderId.make("personal");
    const result = secretProviderFromDraft(
      { kind: "one_password", name: "Personal (team)", account: "team.1password.com" },
      new Set(["personal"]),
      { mode: "edit", id },
    );
    expect(Result.isSuccess(result) && result.success).toEqual({
      id,
      config: {
        kind: "one_password",
        label: "Personal (team)",
        config: { account: "team.1password.com" },
      },
    });
  });
});
