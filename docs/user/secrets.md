# Secrets

cod3 can read credentials from a secret provider, so the credential stays in your password
manager and cod3 saves only a reference to it. Agents can also ask you for a secret in a
private card instead of in the chat.

The Secrets settings page is in preview. To enable it, add `secret_providers` to
`COD3_FEATURE_FLAGS` on the cod3 server and restart it. Secret requests from agents work everywhere.

## Secret providers

Open **Settings → Secrets** on the environment that will use the credential. Select **Add
provider**, choose a password manager, and give it a name. Each environment has its own providers.
Install and sign in to the password manager's CLI on the machine running that environment's cod3
server, including when you connect from a phone or another computer.

- **Proton Pass** uses `pass-cli`. Run `pass-cli login` as the user running the server. For an
  unattended server, Proton also supports vault-scoped access tokens. See the
  [CLI setup guide](https://protonpass.github.io/pass-cli/) and
  [Proton's access token guide](https://proton.me/support/pass-access-tokens).
- **1Password** uses `op`. Enter the account shorthand, sign-in address (without `https://`), or
  ID shown by `op account list`. A desktop sign-in prompts on the server machine. For an
  unattended server, use a [service account](./secrets-1password-service-account.md) or
  [Connect server](./secrets-1password-connect.md). See the
  [1Password CLI guide](https://developer.1password.com/docs/cli/).

## Use a secret reference

Credential fields in Settings, such as provider environment variables and credentials, source
control tokens, usage limit keys, and device host tokens, show a source picker next to the field.
Pick **Value** to save the credential itself, or pick a secret provider and enter a reference such
as `pass://Personal/GitHub/token` for Proton Pass or `op://vault/item/field` for 1Password.
Proton Pass accepts vault and item names or IDs. Include the field you want to read. In
1Password, use **Copy Secret Reference**.
Select the check button next to a reference to read it now. If it reads, providers that use it
start using the new value.

cod3 reads the secret when it needs it, for example when a provider starts. Change the
credential in your password manager and refresh to use the new value.

## When a secret cannot be read

If the password manager is locked or signed out, the provider or feature that needs the secret shows an error
naming the secret provider. Restore CLI access on the server's machine, then select **Refresh** in
**Settings → Providers**. cod3 never replaces a saved credential it cannot read with another
login.

## Remove a secret provider

When you remove a secret provider in **Settings → Secrets**, cod3 lists the fields that read
from it. Removing it clears those fields, so set them again before you need them. Your credentials stay in the password manager.

## When an agent asks for a secret

An agent that needs a token or password shows a secret request card in the thread instead of asking
you to paste it into the chat. Type or paste the value and select **Save securely**, or select
**Decline**. You can answer from web, desktop, or mobile.

If the environment has a secret provider, the card also lets you pick it and enter a reference
instead of the value. cod3 reads the secret once, when you answer. If cod3 cannot read the field, the
request stays open. Restore access and try again, or enter the value.

The value never appears in the conversation. Most requests keep it from the agent too: cod3
passes it to the tool that needs it. When an agent has to run a command with the value, the card
says so instead: the value goes into a private file that the agent's commands can read for about 24
hours.
