// @effect-diagnostics nodeBuiltinImport:off globalTimers:off -- This adapter owns Tart's process and virtual display.
import * as NodeChildProcess from "node:child_process";
import * as NodeEvents from "node:events";
import * as NodeReadline from "node:readline";
import * as NodeStream from "node:stream";
import * as NodeStreamConsumers from "node:stream/consumers";
import * as NodeStreamPromises from "node:stream/promises";
import * as NodeTimersPromises from "node:timers/promises";
import * as NodePath from "node:path";
import versions from "./deviceToolVersions.json" with { type: "json" };
import * as NodeUtil from "node:util";
import { PNG } from "pngjs";
import {
  buttons,
  connect,
  Framebuffer,
  keysyms,
  keysymFromChar,
  security,
  type RfbClient,
} from "rfb2";

export const TART_VM_NAME = "t3-mac";
const TART_BOOT_ARGS = [
  "run",
  "--no-graphics",
  "--no-clipboard",
  "--no-audio",
  "--no-usb-accessories",
  "--net-host",
  "--vnc-experimental",
  TART_VM_NAME,
];

const execute = NodeUtil.promisify(NodeChildProcess.execFile);
const disconnected = () => new Error("The Mac guest disconnected. Open Mac again to continue.");
const aliases: Readonly<Record<string, number>> = {
  ...keysyms,
  // Apple Virtualization maps the RFB Alt key to Command and Meta to Option.
  Cmd: keysyms.AltLeft,
  Command: keysyms.AltLeft,
  Shift: keysyms.ShiftLeft,
  Option: keysyms.MetaLeft,
  Ctrl: keysyms.ControlLeft,
  Enter: keysyms.Return,
  Backspace: keysyms.BackSpace,
};

function keyCode(value: string) {
  const code = Object.hasOwn(aliases, value) ? aliases[value] : undefined;
  if (code !== undefined) return code;
  if ([...value].length === 1) return keysymFromChar(value);
  throw new Error("Unknown Mac key: " + value);
}

// Only the owned Tart process can supply a console. A missing address must never select a VNC default.
export function guestConsoleAddress(line: string) {
  const match = /^VNC server is running at (vnc:\/\/\S+)$/.exec(line);
  if (!match) return undefined;
  const url = new URL(match[1]!);
  if (url.hostname !== "127.0.0.1" || !url.port || !url.password)
    throw new Error("Unexpected Tart console address.");
  return { host: "127.0.0.1", port: Number(url.port), password: decodeURIComponent(url.password) };
}

async function waitForLogin(tart: string, signal: AbortSignal) {
  while (true) {
    signal.throwIfAborted();
    try {
      const { stdout } = await execute(
        tart,
        [
          "exec",
          TART_VM_NAME,
          "/bin/sh",
          "-c",
          'test "$(/usr/bin/stat -f %Su /dev/console)" != root && /usr/sbin/sysctl -n kern.bootsessionuuid',
        ],
        { timeout: 4500, signal },
      );
      const uuid = stdout.trim();
      if (/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(uuid)) return uuid;
    } catch {
      signal.throwIfAborted();
    }
    await NodeTimersPromises.setTimeout(500, undefined, { signal });
  }
}

const launchScript = [
  "set -eu",
  'test "$(/usr/sbin/sysctl -n kern.bootsessionuuid)" = "$1"',
  'dir=$(mktemp -d "${TMPDIR:-/tmp}/t3-app.XXXXXXXX")',
  'app="$dir/$2"',
  'mkdir "$app"',
  '/usr/bin/tar -xf - -C "$app"',
  '/usr/bin/plutil -lint "$app/Contents/Info.plist" >/dev/null',
  '/usr/bin/open -n "$app"',
  'printf "%s\\n" "$app"',
].join("\n");

async function transferApp(
  tart: string,
  bootId: string,
  archive: NodeStream.Readable,
  name: string,
  signal: AbortSignal,
) {
  if (!/^[^/\0\r\n]+\.app$/i.test(name)) throw new Error("Expected a Mac .app bundle.");
  return guestInput(
    tart,
    ["exec", "-i", TART_VM_NAME, "/bin/sh", "-c", launchScript, "t3", bootId, name],
    archive,
    signal,
  );
}

async function guestInput(
  tart: string,
  args: string[],
  input: NodeStream.Readable,
  signal: AbortSignal,
) {
  const child = NodeChildProcess.spawn(tart, args, {
    stdio: "pipe",
    signal: AbortSignal.any([signal, AbortSignal.timeout(180_000)]),
  });
  const [out, err, [code]] = await Promise.all([
    NodeStreamConsumers.buffer(child.stdout),
    NodeStreamConsumers.buffer(child.stderr),
    NodeEvents.EventEmitter.once(child, "close"),
    NodeStreamPromises.pipeline(input, child.stdin),
  ]);
  if (code !== 0) throw new Error("Mac guest command failed. " + err.toString().slice(-800));
  return out.toString().trim();
}

// Swift builds the pinned package's native accessibility helper inside the VM on first use.
async function installNativeHelper(
  tart: string,
  bootId: string,
  entry: string,
  signal: AbortSignal,
) {
  const prefix =
    'set -eu; test "$(/usr/sbin/sysctl -n kern.bootsessionuuid)" = "$1"; dir="$HOME/Library/Application Support/T3 Device/agent-device-$2"; ';
  const args = (script: string) => [
    TART_VM_NAME,
    "/bin/sh",
    "-c",
    prefix + script,
    "t3",
    bootId,
    versions["agent-device"],
  ];
  const installed = await execute(tart, ["exec", ...args('test -x "$dir/helper"')], {
    signal,
    timeout: 8000,
  }).then(
    () => true,
    () => false,
  );
  if (installed) return;
  signal.throwIfAborted();
  const archive = NodeChildProcess.spawn(
    "/usr/bin/tar",
    [
      "-cf",
      "-",
      "-C",
      NodePath.resolve(entry, "../../apple/macos-helper"),
      "Package.swift",
      "Sources",
      "Tests",
    ],
    { stdio: ["ignore", "pipe", "ignore"], signal },
  );
  const done = NodeEvents.EventEmitter.once(archive, "close");
  try {
    const install = [
      'mkdir -p "$dir"',
      'work=$(mktemp -d "$dir/build.XXXXXXXX")',
      "trap 'rm -rf \"$work\"' EXIT",
      'cd "$work"',
      "/usr/bin/tar -xf -",
      "/usr/bin/swift build -c release --product agent-device-macos-helper >&2",
      'mv -f .build/release/agent-device-macos-helper "$dir/helper"',
    ].join("\n");
    const [, [code]] = await Promise.all([
      guestInput(tart, ["exec", "-i", ...args(install)], archive.stdout, signal),
      done,
    ]);
    if (code !== 0)
      throw new Error("Could not transfer the agent-device helper into the Mac guest.");
  } finally {
    archive.kill();
  }
}

function display(client: RfbClient, bootId: string, signal: AbortSignal) {
  const frame = Framebuffer.attach(client);
  const check = () => {
    if (signal.aborted || !client.connected) throw disconnected();
  };
  let revision = 0;
  let awaiting = false;
  let cached: { revision: number; png: Promise<Buffer> } | undefined;
  client.on("update", () => {
    revision++;
    awaiting = false;
  });
  const initialize = async () => {
    const next = client.nextUpdate();
    client.requestUpdate(false);
    const alarm = setTimeout(() => client.destroy(), 12000);
    try {
      await next;
      check();
    } finally {
      clearTimeout(alarm);
    }
  };
  const capture = async (previous?: string) => {
    check();
    const tag = '"' + bootId + "-" + revision + '"';
    // Apple may withhold updates while the desktop is static. Only a visible viewer asks for more.
    if (!awaiting) {
      awaiting = true;
      client.requestUpdate(true);
    }
    if (tag === previous) return { tag, png: null };
    if (cached?.revision !== revision) {
      const image = new PNG({
        width: frame.width,
        height: frame.height,
        filterType: 1,
        deflateLevel: 2,
      });
      image.data = frame.toRgba();
      const output = new NodeStream.PassThrough();
      image.once("error", (error) => output.destroy(error));
      cached = { revision, png: NodeStreamConsumers.buffer(image.pack().pipe(output)) };
    }
    const png = await cached.png;
    check();
    return { tag, png };
  };
  const click = (x: number, y: number) => {
    check();
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= frame.width ||
      y >= frame.height
    )
      throw new Error("Click coordinates are outside the guest display.");
    client.pointerEvent(x, y, 0);
    client.pointerEvent(x, y, buttons.left);
    client.pointerEvent(x, y, 0);
  };
  const key = (keys: readonly string[]) => {
    check();
    const codes = keys.map(keyCode);
    for (const code of codes) client.keyEvent(code, true);
    for (const code of codes.reverse()) client.keyEvent(code, false);
  };
  return {
    check,
    initialize,
    capture,
    click,
    key,
  };
}

export async function bootGuest(tart: string, onDisconnect: () => void, cancel?: AbortSignal) {
  const life = new AbortController();
  const child = NodeChildProcess.spawn(tart, TART_BOOT_ARGS, {
    env: { ...process.env, NSUnbufferedIO: "YES" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exit = NodeEvents.EventEmitter.once(child, "close").then(
    () => undefined,
    () => undefined,
  );
  const lines = NodeReadline.createInterface({ input: child.stdout });
  let diagnostic = "";
  child.stderr.on("data", (chunk: Buffer) => {
    diagnostic = (diagnostic + chunk.toString()).slice(-1200);
  });
  const terminate = () => {
    child.kill("SIGINT");
  };
  process.once("exit", terminate);
  const disconnect = () => {
    if (life.signal.aborted) return;
    life.abort(disconnected());
    onDisconnect();
  };
  void exit.then(() => {
    disconnect();
    process.off("exit", terminate);
  });
  const signal = AbortSignal.any([
    life.signal,
    AbortSignal.timeout(120_000),
    ...(cancel ? [cancel] : []),
  ]);
  let bootId: string | undefined;
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const requested =
      bootId &&
      !life.signal.aborted &&
      (await execute(
        tart,
        [
          "exec",
          TART_VM_NAME,
          "/bin/sh",
          "-c",
          'test "$(/usr/sbin/sysctl -n kern.bootsessionuuid)" = "$1" && /usr/bin/sudo -n /sbin/shutdown -h now',
          "t3",
          bootId,
        ],
        { timeout: 4000 },
      ).then(
        () => true,
        () => false,
      ));
    if (!requested) child.kill("SIGUSR2");
    const force = setTimeout(terminate, 30_000);
    try {
      await exit;
    } finally {
      clearTimeout(force);
    }
  };
  try {
    const address = await new Promise<NonNullable<ReturnType<typeof guestConsoleAddress>>>(
      (resolve, reject) => {
        const failed = () =>
          reject(
            new Error(
              "Tart did not start the guest console. " +
                diagnostic.replace(/vnc:\/\/\S+/g, "[guest console]"),
            ),
          );
        signal.addEventListener("abort", failed, { once: true });
        lines.on("line", (line: string) => {
          try {
            const endpoint = guestConsoleAddress(line);
            if (endpoint) {
              signal.removeEventListener("abort", failed);
              resolve(endpoint);
            }
          } catch (error) {
            reject(error);
          }
        });
        lines.on("close", failed);
      },
    );
    const client = await connect({
      ...address,
      security: [security.VNC],
      initialUpdate: false,
      timeout: 8000,
      signal: life.signal,
    });
    client.once("close", disconnect);
    client.on("error", disconnect);
    const currentBoot = await waitForLogin(tart, signal);
    bootId = currentBoot;
    const desktop = display(client, currentBoot, life.signal);
    await desktop.initialize();
    let installed: Promise<void> | undefined;
    const ensureNativeHelper = async (source: () => Promise<string>) => {
      desktop.check();
      installed ??= source()
        .then((entry) => installNativeHelper(tart, currentBoot, entry, life.signal))
        .catch((error) => {
          installed = undefined;
          throw error;
        });
      await installed;
      desktop.check();
    };

    return {
      ...desktop,
      bootId: currentBoot,
      stop,
      confirm: async () => {
        desktop.check();
        const { stdout } = await execute(
          tart,
          ["exec", TART_VM_NAME, "/usr/sbin/sysctl", "-n", "kern.bootsessionuuid"],
          {
            signal: life.signal,
            timeout: 5000,
          },
        );
        if (stdout.trim() !== currentBoot) throw disconnected();
        desktop.check();
      },
      screenshot: async () => {
        desktop.check();
        // A still capture runs in the guest WindowServer even when its RFB stream has no pixel changes.
        const script = [
          "set -eu",
          'test "$(/usr/sbin/sysctl -n kern.bootsessionuuid)" = "$1"',
          "img=$(mktemp -t t3-device-capture)",
          `trap 'rm -f "$img"' EXIT`,
          '/usr/sbin/screencapture -x -t png "$img"',
          '/bin/cat "$img"',
        ].join("\n");
        const { stdout } = await execute(
          tart,
          ["exec", TART_VM_NAME, "/bin/sh", "-c", script, "t3", currentBoot],
          {
            signal: life.signal,
            encoding: "buffer",
            timeout: 12000,
            maxBuffer: 64 * 1024 * 1024,
          },
        );
        desktop.check();
        if (!stdout.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          throw new Error("The Mac guest could not capture its display.");
        return stdout;
      },
      type: async (text: string, source: () => Promise<string>, cancel: AbortSignal) => {
        await ensureNativeHelper(source);
        cancel.throwIfAborted();
        // AppKit sheets need text input even in apps that do not implement the Paste menu action.
        const script = [
          "set -eu",
          'test "$(/usr/sbin/sysctl -n kern.bootsessionuuid)" = "$1"',
          `bundle=$(/usr/bin/osascript -l JavaScript -e 'ObjC.import("AppKit"); $.NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier.js')`,
          "text=$(cat; printf .)",
          'exec "$HOME/Library/Application Support/T3 Device/agent-device-$2/helper" type --bundle-id "$bundle" --delay-ms 30 --text "${text%.}"',
        ].join("\n");
        await guestInput(
          tart,
          [
            "exec",
            "-i",
            TART_VM_NAME,
            "/bin/sh",
            "-c",
            script,
            "t3",
            currentBoot,
            versions["agent-device"],
          ],
          NodeStream.Readable.from([Buffer.from(text)]),
          AbortSignal.any([life.signal, cancel]),
        );
        desktop.check();
      },
      snapshot: async (source: () => Promise<string>) => {
        desktop.check();
        await ensureNativeHelper(source);
        const { stdout } = await execute(
          tart,
          [
            "exec",
            TART_VM_NAME,
            "/bin/sh",
            "-c",
            'test "$(/usr/sbin/sysctl -n kern.bootsessionuuid)" = "$1" && exec "$HOME/Library/Application Support/T3 Device/agent-device-$2/helper" snapshot --surface frontmost-app',
            "t3",
            currentBoot,
            versions["agent-device"],
          ],
          { signal: life.signal, timeout: 20000, maxBuffer: 8 * 1024 * 1024 },
        );
        desktop.check();
        return stdout;
      },
      verifyFile: async (path: string) => {
        desktop.check();
        const { stdout } = await execute(
          tart,
          [
            "exec",
            TART_VM_NAME,
            "/bin/sh",
            "-c",
            'set -eu; test "$(/usr/sbin/sysctl -n kern.bootsessionuuid)" = "$1"; test -f "$2"; /usr/bin/shasum -a 256 -- "$2"',
            "t3",
            currentBoot,
            path,
          ],
          { timeout: 15000, signal: life.signal },
        );
        desktop.check();
        return stdout;
      },
      launch: async (archive: NodeStream.Readable, name: string, cancel?: AbortSignal) => {
        desktop.check();
        const path = await transferApp(
          tart,
          currentBoot,
          archive,
          name,
          cancel ? AbortSignal.any([life.signal, cancel]) : life.signal,
        );
        desktop.check();
        return path;
      },
    };
  } catch (error) {
    terminate();
    await exit;
    throw error;
  }
}
export type TartGuest = Awaited<ReturnType<typeof bootGuest>>;
