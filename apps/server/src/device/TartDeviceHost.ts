import {
  DeviceBootError,
  DeviceHostUnavailableError,
  DeviceOperationError,
  TART_DEVICE_HOST_ID,
  type DevicePlatform,
  type DeviceHostSummary,
} from "@cod3/contracts";
import * as HostProcess from "@cod3/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Semaphore from "effect/Semaphore";
import * as DeviceHost from "./DeviceHost.ts";
import { bootGuest, TART_VM_NAME, type TartGuest } from "./TartGuest.ts";
import { bindGuestLauncher } from "./TartLauncher.ts";

const id = TART_DEVICE_HOST_ID;
const label = "Local Mac VM";
const unavailable = (reason: string) =>
  new DeviceHostUnavailableError({ hostId: id, hostLabel: label, reason });
const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

export const make = Effect.fn("TartDeviceHost.make")(function* (
  stateDir: string,
  source: () => Promise<string>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* HostProcess.HomeDirectory;
  const env = yield* HostProcess.Environment;
  const kernel = yield* HostProcess.KernelRelease;
  const gate = yield* Semaphore.make(1);
  const bindings = new Map<string, Awaited<ReturnType<typeof bindGuestLauncher>>>();
  const candidates = [
    path.join(home, ".local/bin/tart"),
    "/opt/homebrew/bin/tart",
    "/usr/local/bin/tart",
    ...(env.PATH ?? "")
      .split(":")
      .filter((dir) => path.isAbsolute(dir))
      .map((dir) => path.join(dir, "tart")),
  ];
  const image = path.join(
    env.TART_HOME ?? path.join(home, ".tart"),
    "vms",
    TART_VM_NAME,
    "config.json",
  );
  const setup = Effect.gen(function* () {
    if (Number.parseInt(kernel, 10) < 25)
      return {
        reason: "The isolated Mac requires an Apple Silicon host running macOS Tahoe 26 or later.",
      };
    for (const cmd of new Set(candidates)) {
      if (
        !(yield* fs.stat(cmd).pipe(
          Effect.map((file) => file.type === "File" && (file.mode & 0o111) !== 0),
          Effect.orElseSucceed(() => false),
        ))
      )
        continue;
      if (yield* fs.exists(image).pipe(Effect.orElseSucceed(() => false))) return { cmd };
      return {
        reason:
          "Create the reusable VM on this Mac with tart clone ghcr.io/cirruslabs/macos-tahoe-base:latest t3-mac. Then refresh devices.",
      };
    }
    return {
      reason:
        "Install Tart on the server Mac with brew install openai/tools/tart. Then run tart clone ghcr.io/cirruslabs/macos-tahoe-base:latest t3-mac and refresh devices.",
    };
  });
  let guest: TartGuest | undefined;
  let connected = false;
  let ready = false;
  const platformAvailability = (platform: DevicePlatform) =>
    setup.pipe(
      Effect.map((result) => ({
        platform,
        available: platform === "macos" && !!result.cmd,
        ...(result.reason ? { reason: result.reason } : {}),
      })),
    );
  const summary: Effect.Effect<DeviceHostSummary> = platformAvailability("macos").pipe(
    Effect.map((platform) => ({
      id,
      label,
      kind: "tart",
      platforms: [platform],
      hubInstalled: platform.available,
      agentDeviceInstalled: platform.available,
    })),
  );
  const requireGuest = (deviceId: string) => {
    if (!connected || !guest || deviceId !== TART_VM_NAME)
      throw new Error("Mac guest disconnected. Open Mac again to continue.");
    guest.check();
    return guest;
  };
  const closeBinding = async (session: string) => {
    const bound = bindings.get(session);
    bindings.delete(session);
    if (bound) await bound.close();
  };
  const stopAgent = Effect.promise(() => Promise.all([...bindings.keys()].map(closeBinding))).pipe(
    Effect.asVoid,
  );
  const shutdown = Effect.gen(function* () {
    const running = guest;
    guest = undefined;
    connected = false;
    yield* stopAgent;
    if (running) yield* Effect.promise(() => running.stop());
  });
  const stop = gate.withPermit(
    shutdown.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          ready = false;
        }),
      ),
    ),
  );
  yield* Effect.addFinalizer(() => stop);
  const operation = <A>(name: string, perform: () => Promise<A>) =>
    Effect.tryPromise({
      try: perform,
      catch: (cause) =>
        new DeviceOperationError({ operation: name, reason: "request_failed", cause }),
    });
  const endpoint: DeviceHost.DeviceHostAgentReady = {
    agentDevice: null,
    hub: { origin: "" },
    nodePath: "",
    helpers: { serveSimAxSettings: null, serveSimCli: null },
    run: () =>
      Effect.succeed({
        code: 1,
        stdout: "",
        stderr: "This operation is unavailable on the Mac guest.",
      }),
    upstream: () => Effect.succeed(null),
    releaseAgentSession: (session) => operation("release Mac session", () => closeBinding(session)),
    devices: {
      list: Effect.sync(() => ({
        devices: [
          {
            id: TART_VM_NAME,
            platform: "macos",
            name: "Mac",
            version: "macOS",
            physical: false,
            booted: connected,
          },
        ],
        detail: undefined,
      })),
      boot: (device) =>
        gate.withPermit(
          Effect.gen(function* () {
            if (device.id !== TART_VM_NAME || device.platform !== "macos")
              return yield* unavailable("Unknown Mac guest.");
            if (connected) return TART_VM_NAME;
            yield* shutdown;
            const result = yield* setup;
            if (!result.cmd)
              return yield* unavailable(result.reason ?? "Mac VM setup is incomplete.");
            const cmd = result.cmd;
            guest = yield* Effect.tryPromise({
              try: (signal) =>
                bootGuest(
                  cmd,
                  () => {
                    connected = false;
                  },
                  signal,
                ),
              catch: (cause) =>
                new DeviceBootError({
                  hostId: id,
                  deviceId: TART_VM_NAME,
                  reason: "launch_failed",
                  diagnostics: reason(cause).slice(-1800),
                  cause,
                }),
            });
            connected = true;
            return TART_VM_NAME;
          }),
        ),
      attach: (device) =>
        operation("attach Mac", async () => {
          requireGuest(device.id);
        }),
      shutdown: (device) =>
        device.id === TART_VM_NAME
          ? gate.withPermit(shutdown)
          : operation("stop Mac", async () => {
              throw new Error("Unknown Mac guest.");
            }),
      macBootId: () => (connected ? guest?.bootId : undefined),
      screenshot: (device, bootId) =>
        Effect.tryPromise({
          try: async () => {
            const running = requireGuest(device.id);
            if (bootId && running.bootId !== bootId)
              throw new Error("Mac guest session ended. Open Mac again.");
            return running.screenshot();
          },
          catch: (cause) => unavailable(reason(cause)),
        }),
      macFrame: (deviceId, previous, still) =>
        Effect.tryPromise({
          try: async () => {
            const running = requireGuest(deviceId);
            if (previous && !previous.startsWith('"' + running.bootId + "-"))
              throw new Error("Mac guest session ended. Open Mac again.");
            if (still)
              return { tag: '"' + running.bootId + '-still"', png: await running.screenshot() };
            return running.capture(previous);
          },
          catch: (cause) => unavailable(reason(cause)),
        }),
      bindMacSession: (session, deviceId) =>
        gate.withPermit(
          Effect.tryPromise({
            try: async () => {
              const running = requireGuest(deviceId);
              let binding = bindings.get(session);
              if (!binding) {
                binding = await bindGuestLauncher(
                  path.join(stateDir, "device", "targets", session),
                  running,
                  source,
                );
                bindings.set(session, binding);
              }
              running.check();
              return binding.command;
            },
            catch: (cause) => unavailable(reason(cause)),
          }),
        ),
    },
  };
  const ensure = Effect.fn("TartDeviceHost.ensureReady")(function* () {
    ready = true;
    return endpoint;
  });
  return DeviceHost.DeviceHost.of({
    id,
    label,
    summary,
    platformAvailability,
    ensureReady: ensure,
    ensureAgentReady: ensure,
    current: Effect.sync(() => (ready ? endpoint : null)),
    stopAgent: gate.withPermit(stopAgent),
    stop,
  });
});
