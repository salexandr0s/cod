import type { EnvironmentId, SecretProviderConfig, SecretProviderId } from "@cod3/contracts";
import * as Result from "effect/Result";
import { useState } from "react";
import { T, useGT, useMessages, Var } from "gt-react";

import { useUpdateEnvironmentSettings } from "../../hooks/useSettings";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import {
  draftFromSecretProvider,
  secretProviderFromDraft,
  type SecretProviderDraft,
  type secretProviderChoices,
} from "./SecretProviderDialog.logic";

/** Mounted per open, so each open starts from a fresh draft. */
export function SecretProviderDialog({
  onClose,
  environmentId,
  environmentLabel,
  choices,
  existingIds,
  existing,
}: {
  readonly onClose: () => void;
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly choices: ReadonlyArray<(typeof secretProviderChoices)[number]>;
  readonly existingIds: ReadonlySet<string>;
  readonly existing?: { readonly id: SecretProviderId; readonly config: SecretProviderConfig };
}) {
  const messages = useMessages();
  const gt = useGT();
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const [draft, setDraft] = useState<SecretProviderDraft>(
    existing
      ? draftFromSecretProvider(existing.config)
      : {
          kind: choices[0]?.value ?? "one_password",
          name: "",
          account: "",
        },
  );
  const [submitted, setSubmitted] = useState(false);
  const result = secretProviderFromDraft(
    draft,
    existingIds,
    existing ? { mode: "edit", id: existing.id } : { mode: "add" },
    messages,
  );
  const issues = Result.isFailure(result) ? result.failure : {};
  const nameError = submitted ? issues.name : undefined;
  const accountError = submitted ? issues.account : undefined;

  const update = (patch: Partial<SecretProviderDraft>) => setDraft({ ...draft, ...patch });
  const save = () => {
    setSubmitted(true);
    if (Result.isFailure(result)) return;
    updateSettings({ secretProviders: { [result.success.id]: result.success.config } });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing
              ? gt("Edit {label}", { label: existing.config.label })
              : gt("Add a secret provider")}
          </DialogTitle>
          <DialogDescription>
            <T>
              Secrets are read on <Var>{environmentLabel}</Var>.
            </T>
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            id="secret-provider-form"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            {!existing && choices.length > 1 ? (
              <div className="grid gap-1.5">
                <Label htmlFor="secret-provider-kind">
                  <T>Password manager</T>
                </Label>
                <Select
                  items={choices}
                  value={draft.kind}
                  onValueChange={(kind) => {
                    if (kind) update({ kind });
                  }}
                >
                  <SelectTrigger id="secret-provider-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {choices.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="secret-provider-name">
                <T>Name</T>
              </Label>
              <Input
                id="secret-provider-name"
                placeholder={gt("Personal")}
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                maxLength={64}
                aria-invalid={nameError !== undefined}
                aria-describedby={
                  nameError !== undefined ? "secret-provider-name-error" : undefined
                }
                autoFocus={Boolean(existing) || choices.length < 2}
              />
              {nameError !== undefined ? (
                <p
                  id="secret-provider-name-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {nameError}
                </p>
              ) : null}
            </div>
            {draft.kind === "proton_pass" ? (
              <p className="text-sm text-muted-foreground">
                <T>
                  Run <code>pass-cli login</code> as the user running the cod3 server.
                </T>
              </p>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="secret-provider-account">
                  <T>Account</T>
                </Label>
                <Input
                  id="secret-provider-account"
                  placeholder="my.1password.com"
                  value={draft.account}
                  onChange={(event) => update({ account: event.target.value })}
                  maxLength={253}
                  spellCheck={false}
                  aria-invalid={accountError !== undefined}
                  aria-describedby={
                    accountError !== undefined ? "secret-provider-account-error" : undefined
                  }
                />
                {accountError !== undefined ? (
                  <p
                    id="secret-provider-account-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {accountError}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  <T>
                    The account shorthand, sign-in address without https://, or ID that op account
                    list shows.
                  </T>
                </p>
              </div>
            )}
          </form>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="outline" onClick={onClose}>
            <T>Cancel</T>
          </Button>
          <Button
            type="submit"
            form="secret-provider-form"
            disabled={submitted && Result.isFailure(result)}
          >
            {existing ? gt("Save changes") : gt("Add provider")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
