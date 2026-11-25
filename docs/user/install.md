# Install cod3

cod3 runs coding agents on your computer and lets you control them from its
desktop, web, or mobile app. Set up the machine where the agents will work first.

## Requirements

You need an installed, authenticated provider before starting a thread. You can
launch cod3 and configure providers afterwards.

Build cod3 from this checkout with the [development runbook](../operations/00_development.md#first-checkout). Packaged desktop builds include the `cod3` command.

When moving a project from T3 Code, rename its project configuration from `t3.json` to `cod3.json`. The cod3 server uses `~/.cod3` for its own settings and history.

## Command line

The installers below require a matching CLI archive on the [fork’s releases page](https://github.com/salexandr0s/cod/releases).

```bash
curl -fsSL https://raw.githubusercontent.com/salexandr0s/cod/main/scripts/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/salexandr0s/cod/main/scripts/install.ps1 | iex
```

This installs the `cod3` command to `~/.local/bin`. If that folder is not on your
`PATH` yet, the installer says so and, for zsh, bash on Linux, and fish, prints
a command to add it. On Windows, `cod3` works in the same PowerShell window right
away; add the folder to your `PATH` for new windows. If a `cod3` that the
installer or the desktop app did not create is already there, it leaves that
one alone and stops. Set `COD3_CHANNEL=nightly` to install the nightly train, or
`COD3_VERSION` to pin an exact version.

| Task                                  | Command                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Start the server and open the web app | `cod3`                                                                    |
| Start the server without a browser    | `cod3 serve`                                                              |
| Use it from your other devices        | `cod3 up` ([details](./remote-access.md))                                 |
| Keep it running in the background     | `cod3 service install` ([details](./background-service.md))               |
| Move to the newest release            | `cod3 update`                                                             |
| Reclaim database space                | `cod3 doctor` ([details](./background-service.md#reclaim-database-space)) |
| Remove it again                       | `cod3 uninstall`                                                          |

Run `cod3 help` or `cod3 --help` for the full reference. To start in a new working
directory, use an explicit path such as `cod3 ./my-project`. A bare directory name
is accepted only if it already exists.

If `cod3` or `cod3 start` reports an already running server, run the `cod3 pair`
command it names and open the pairing URL to connect to that server. Stop it
before starting a replacement, or use a different `--base-dir` for an
independent server.

To try cod3 once without installing it, run `npx cod3@latest` instead (needs
Node.js for `npx`). It offers to install the `cod3` command first. If you say no,
it asks again at the next minor release, and `npx cod3 install` installs it later.
`npx cod3` always runs the version npm picked, even when a `cod3` is installed. On
the nightly train, run your installed `cod3` (for example `cod3 connect`), not
`npx cod3`, which runs the latest stable release.

### Intel Macs

There is no `cod3` executable for Intel Macs (the desktop app is available). To
run a server there, build it from source with `vp`, which provides the Node version it needs
([Install vp](../operations/00_development.md#first-checkout)):

```bash
git clone https://github.com/salexandr0s/cod
cd cod3 && vp i && vp run build:desktop
node apps/server/dist/bin.mjs
```

`cod3 update` and the background service do not apply to a server run this way;
update it with `git pull` and a rebuild.

## Desktop app

Find packaged artifacts on the [cod3 releases page](https://github.com/salexandr0s/cod/releases), or [build a desktop artifact](../operations/00_development.md#desktop-artifacts) from this checkout.

### Linux

AppImage and `.deb` downloads are available for x86_64 and ARM64. Check your
architecture with `uname -m`: for `x86_64`, choose a file ending in
`x86_64.AppImage` or `amd64.deb`; for `aarch64`, choose `arm64.AppImage` or
`arm64.deb`.

To launch an AppImage, open a terminal in its download folder. Replace
`cod3.AppImage` below with the exact filename you downloaded:

```bash
chmod +x ./cod3.AppImage
./cod3.AppImage
```

The `.deb` updates itself like the other desktop builds. It asks for your
password to install each update. If your desktop has no password prompt, the
update fails. Download the new `.deb` and install it the same way.

The AUR packages support x86_64 and ARM64.
Update AUR installs with your AUR helper, such as `yay -Syu`, instead of the
in-app updater.

### The `cod3` command

The desktop app includes the `cod3` command-line tool. A new install sets it up
on first launch; after an update, or any time, choose **Install** next to
**cod3 command** in **Settings → About**. On macOS and Linux it adds a `cod3` link
in `~/.local/bin` (or `~/bin`); on Windows it adds the app's command folder to
your `PATH`. Open a new terminal afterwards. If the folder is not on your
`PATH`, **Add to PATH** on the Welcome page or in **Settings → About** adds one
line to your shell's startup file. **Remove** takes it off, and the app does not
add it again. If you already have another `cod3`, it stays as it is.

### Windows Subsystem for Linux

Choose a WSL distro in **Settings → Sharing & access** to run agents and projects
there. Install the provider CLIs inside that distro. cod3 installs its own
server runtime there automatically; the first launch after an app update can
take longer.

### Open a project from a terminal

With the desktop app already running on the same machine:

```bash
cod3 app
```

This opens a new thread for the current directory, adding the project if needed.
Pass a path, such as `cod3 app ../my-project`, to open another directory. It requires
the desktop app, so a standalone server or an SSH session is not enough. If the
command cannot reach the app, start or update the desktop app and try again.

### Drop a folder on the sidebar

Drag one or more folders from Finder, Explorer, or your file manager onto the
sidebar. Each one opens as a project on this computer, the same as `cod3 app`.
Files dropped on a thread still attach to that thread. Browsers do not share
folder paths, so in the web app use **Add project** instead.

## Mobile app

Follow the [iOS and Android setup guide](../../apps/mobile/README.md) to build the client and connect it to your server.

## Providers

Open **Settings → Providers** in the web or desktop app, select the environment,
and enable the provider you want. Installation, login, and configuration belong
to that environment's machine, even when you connect from a phone or another
computer.

| Provider            | Install and authenticate                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex               | [Connect with ChatGPT](./providers-codex.md#connect-with-chatgpt), or install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`. |
| Claude              | Install [Claude Code](https://claude.com/product/claude-code), then run `claude auth login`.                                                              |
| Cursor              | Install [Cursor CLI](https://cursor.com/cli), then run `agent login`.                                                                                     |
| Grok Build          | Install [Grok Build CLI](https://x.ai/cli), then run `grok login`.                                                                                        |
| Kiro                | Install [Kiro CLI](https://kiro.dev/docs/cli/), then run `kiro-cli login`.                                                                                |
| OpenCode            | Install [OpenCode](https://opencode.ai), then run `opencode auth login`.                                                                                  |
| Antigravity         | Install and sign in with Google from cod3's provider settings.                                                                                            |
| Pi                  | Install [Pi](./providers-pi.md#set-up-pi) with Node.js 22.19 or newer, then run `pi` and `/login`.                                                        |
| Muse Code           | Install [Muse Code](https://dev.meta.ai/docs/muse-code) on the server, run `muse login`, then enable it in Settings → Providers.                          |
| fx                  | Install [fx](https://fx.sh) with `curl -fsSL https://fx.sh/setup.sh \| bash`, then run `fx login`.                                                        |
| ACP Registry agents | Add GitHub Copilot and other [ACP agents](./providers-acp.md#add-an-agent) from **Settings → Providers → Add provider → Show more**.                      |

Provider CLIs must be on the server's `PATH`. If cod3 cannot find one, set its
**Binary path** in provider settings, especially when using a version manager.
Cursor's executable is `cursor-agent`, although its login command is
`agent login`. Codex connected through ChatGPT and Antigravity can use their
managed runtimes without a `PATH` entry.

cod3 warns when a provider version has known compatibility problems with your
release. Check **Settings → Providers** on that environment for the recommended
version or range. When its package manager supports installing a specific version,
you can install the recommendation there. Otherwise use the provider's installer
on the environment's machine. An unlisted version is unverified.

When a provider CLI is behind its latest release, its provider card shows the
available version. **Update now** runs the installer that owns the CLI
(Homebrew, mise, or a global npm, pnpm, Yarn, Bun, Volta, or Vite+ install), or
the CLI's own update command when cod3 cannot tell. Claude, Codex, and
OpenCode installs cod3 cannot identify stay manual: update them through the
installer you used. cod3 runs `mise upgrade`
only for a tool your mise config requests as `latest` when the provider's binary
path is a mise shim or under the tool's `installs/<tool>/latest` link; update a
pinned version, or a path into one version's directory, through mise yourself.
Update a CLI installed with Nix through Nix.
Cursor and Antigravity update with cod3. Homebrew and Chocolatey installs
compare against the version their package manager offers, which can trail the
npm release; update Claude installed with Chocolatey through Chocolatey.

The managed runtimes for Antigravity and for Codex connected through ChatGPT
first install the release cod3 tested. When cod3 finds a newer compatible
release, their setup in **Settings → Providers** offers an update.

Add another provider instance for a separate account or configuration. Each
instance can have its own environment variables, such as API keys or a custom
base URL. Mark secret values as sensitive; after saving, cod3 does not display
their original values.

For provider-specific setup and accounts, see [Codex](./providers-codex.md),
[Claude](./providers-claude.md), [OpenCode](./providers-opencode.md),
[Antigravity](./providers-antigravity.md), [Kiro](./providers-kiro.md),
[Pi](./providers-pi.md), [Muse Code](./providers-muse.md), [fx](./providers-fx.md), and
[ACP Registry agents](./providers-acp.md).

### Provider check timeouts

If a provider works in its CLI but cod3 reports a timeout while checking it,
allow more time in the cod3 server's environment. For example, give Codex and
Claude readiness checks 60 seconds:

```bash
COD3_CODEX_PROBE_TIMEOUT_MS=60000 COD3_CLAUDE_PROBE_TIMEOUT_MS=60000 cod3 serve
```

For a remote environment, set these on the machine running the cod3 server.
Keep them in your launcher or service configuration to retain them across
updates, then restart the server. For systemd, add
`Environment=COD3_CODEX_PROBE_TIMEOUT_MS=60000` under `[Service]` in a service
override, reload systemd, and restart the service. Provider instances can also
set their own overrides in Settings → Providers.

Each variable extends that provider's readiness-probe deadlines; a phase whose
default is already longer keeps its default. Providers with several phases can
take longer than one deadline in total. Values must be whole milliseconds no
greater than 2147483647; unset or invalid values keep the defaults.

| Provider            | Environment variable                 |
| ------------------- | ------------------------------------ |
| Codex               | `COD3_CODEX_PROBE_TIMEOUT_MS`        |
| Claude              | `COD3_CLAUDE_PROBE_TIMEOUT_MS`       |
| Cursor              | `COD3_CURSOR_PROBE_TIMEOUT_MS`       |
| Antigravity         | `COD3_ANTIGRAVITY_PROBE_TIMEOUT_MS`  |
| Grok                | `COD3_GROK_PROBE_TIMEOUT_MS`         |
| Kiro                | `COD3_KIRO_PROBE_TIMEOUT_MS`         |
| fx                  | `COD3_FX_PROBE_TIMEOUT_MS`           |
| Pi                  | `COD3_PI_PROBE_TIMEOUT_MS`           |
| Muse Code           | `COD3_MUSE_PROBE_TIMEOUT_MS`         |
| OpenCode            | `COD3_OPENCODE_PROBE_TIMEOUT_MS`     |
| ACP Registry agents | `COD3_ACP_REGISTRY_PROBE_TIMEOUT_MS` |

Longer deadlines also take longer to report a stalled check. These overrides
cover readiness and discovery, including OpenCode server startup. Usage and
config enrichment retain their own shorter limits. Turn execution, package
installation, update checks, and shutdown limits keep their existing behavior.

## Next steps

- [Working with threads](./thread-sidebar.md): start tasks and organize parallel work.
- [Permission modes](./permission-modes.md): choose when agents ask before acting.
- [Remote access](./remote-access.md): connect from another device.
- [Running in the background](./background-service.md): keep a host available.
- [Updating cod3](./updating.md): update the app and connected servers.
- [Managed policy](./managed-policy.md): configure cod3 for everyone on a machine.
