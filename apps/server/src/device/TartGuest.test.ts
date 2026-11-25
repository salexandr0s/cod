// @effect-diagnostics nodeBuiltinImport:off -- This test exercises a native child process and its Unix socket.
import * as HostProcess from "@cod3/shared/HostProcess";
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeEvents from "node:events";
import * as NodeUtil from "node:util";
import { createServer, keysyms, type RfbServerConnection } from "rfb2";
import { expect, it } from "vite-plus/test";
import { bootGuest, guestConsoleAddress } from "./TartGuest.ts";
import { bindGuestLauncher } from "./TartLauncher.ts";

const run = NodeUtil.promisify(NodeChildProcess.execFile);

it("requires the password and port advertised by Tart on loopback", () => {
  expect(guestConsoleAddress("starting")).toBeUndefined();
  expect(() => guestConsoleAddress("VNC server is running at vnc://127.0.0.1")).toThrow();
  expect(() =>
    guestConsoleAddress("VNC server is running at vnc://:secret@elsewhere:5901"),
  ).toThrow();
});

it.skipIf(HostProcess.Platform.defaultValue() !== "darwin")(
  "revokes the bound shell command on console loss",
  async () => {
    const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "cod3-tart-test-"));
    const inputs: number[] = [];
    const requests: boolean[] = [];
    const connection = Promise.withResolvers<RfbServerConnection>();
    const server = createServer({ width: 2, height: 2, password: "guest-test" }, (peer) => {
      connection.resolve(peer);
      peer.on("key", ({ down, keysym }) => {
        if (down) inputs.push(keysym);
      });
      peer.on("updateRequest", ({ incremental }) => {
        requests.push(incremental);
        if (!incremental)
          peer.sendUpdate([
            { type: "pixels", x: 0, y: 0, width: 2, height: 2, data: Buffer.alloc(16, 128) },
          ]);
      });
    });
    server.listen(0, "127.0.0.1");
    await NodeEvents.once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    const executable = NodePath.join(dir, "tart");
    await NodeFSP.writeFile(
      executable,
      [
        "#!/bin/sh",
        'case "$1" in',
        "run)",
        "  trap 'exit 0' USR2 INT",
        '  echo "VNC server is running at vnc://:guest-test@127.0.0.1:' + address.port + '"',
        // Wait for the owner's stop signal without starting a child that can keep the pipes open.
        "  exec /usr/bin/perl -e '$SIG{USR2}=sub{exit 0}; sleep 300' ;;",
        'exec) if [ "$2" = "-i" ]; then cat >/dev/null; else echo 00000000-0000-0000-0000-000000000001; fi ;;',
        "*) exit 2 ;;",
        "esac",
      ].join("\n"),
      { mode: 0o700 },
    );
    const lost = Promise.withResolvers<void>();
    try {
      const guest = await bootGuest(executable, lost.resolve);
      try {
        const launcher = await bindGuestLauncher(
          NodePath.join(dir, "target"),
          guest,
          async () => "fixture",
        );
        try {
          await run(launcher.command, ["key", "Cmd", "a"]);
          await run(launcher.command, ["type", "abc"]);
          expect(inputs).toEqual([keysyms.AltLeft, 97]);
          const initial = await guest.capture();
          expect(initial.png?.readUInt32BE(16)).toBe(2);

          const unchanged = await Promise.all([
            guest.capture(initial.tag),
            guest.capture(initial.tag),
          ]);
          expect(unchanged.map((frame) => frame.png)).toEqual([null, null]);
          expect(requests.filter((incremental) => !incremental)).toEqual([false]);
          (await connection.promise).destroy();
          await lost.promise;
          await expect(run(launcher.command, ["click", "1", "1"])).rejects.toThrow();
          await expect(run(launcher.command, ["type", "x"])).rejects.toThrow();
          const artifact = NodePath.join(dir, "proof.png");
          await NodeFSP.writeFile(artifact, "original");
          await expect(run(launcher.command, ["screenshot", artifact])).rejects.toThrow(
            /disconnected/i,
          );
          expect(await NodeFSP.readFile(artifact, "utf8")).toBe("original");
          await expect(guest.capture()).rejects.toThrow(/disconnected/i);
          expect(inputs).toEqual([keysyms.AltLeft, 97]);
        } finally {
          await launcher.close();
        }
      } finally {
        await guest.stop();
      }
    } finally {
      server.close();
      await NodeFSP.rm(dir, { recursive: true, force: true });
    }
  },
);
