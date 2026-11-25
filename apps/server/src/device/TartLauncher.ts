// @effect-diagnostics nodeBuiltinImport:off -- A session owns a private Unix socket for the agent's shell.
import * as NodeHttp from "node:http";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import type { TartGuest } from "./TartGuest.ts";

const quote = (word: string) => "'" + word.replaceAll("'", "'\"'\"'") + "'";

async function form(request: NodeHttp.IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw new Error("Mac input exceeds 64 KiB.");
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

export async function bindGuestLauncher(
  dir: string,
  guest: TartGuest,
  source: () => Promise<string>,
) {
  guest.check();
  const socketDir = await NodeFSP.mkdtemp("/tmp/cod3-mac-");
  const socket = NodePath.join(socketDir, "guest.sock");
  const binding = new AbortController();
  const server = NodeHttp.createServer(async (request, response) => {
    try {
      binding.signal.throwIfAborted();
      guest.check();
      if (request.method !== "POST") throw new Error("Expected POST.");
      if (request.url === "/launch") {
        const filename = String(request.headers["x-bundle-name"] ?? "");
        response.end(
          await guest.launch(
            request,
            Buffer.from(filename, "base64").toString("utf8"),
            binding.signal,
          ),
        );
      } else if (request.url === "/screenshot") {
        const png = await guest.screenshot();
        response.writeHead(200, { "Content-Type": "image/png" }).end(png);
      } else {
        const input = await form(request);
        binding.signal.throwIfAborted();
        guest.check();
        const args = input.getAll("arg");
        switch (request.url) {
          case "/snapshot":
            response.end(await guest.snapshot(source));
            return;
          case "/verify-file":
            if (args.length !== 1 || !args[0]?.startsWith("/"))
              throw new Error("Use verify-file /guest/path.");
            response.end(await guest.verifyFile(args[0]));
            return;
          case "/click":
            if (args.length !== 2 || !args.every((arg) => /^\d+$/.test(arg)))
              throw new Error("Use click X Y.");
            guest.click(Number(args[0]), Number(args[1]));
            break;
          case "/key":
            if (!args.length || args.length > 6) throw new Error("Use key [modifier ...] KEY.");
            guest.key(args);
            break;
          case "/type":
            if (args.length !== 1) throw new Error("Use type TEXT.");
            await guest.type(args[0]!, source, binding.signal);
            break;
          default:
            throw new Error("Unknown Mac device command.");
        }
        await guest.confirm();
        response.end("OK\n");
      }
    } catch (error) {
      response
        .writeHead(409, { "Content-Type": "text/plain" })
        .end((error instanceof Error ? error.message : "Mac guest command failed.") + "\n");
    }
  });
  const close = async () => {
    binding.abort(new Error("Mac guest session closed."));
    server.closeAllConnections();
    server.close();
    await NodeFSP.rm(socketDir, { recursive: true, force: true });
  };
  try {
    await new Promise<void>((resolve, reject) =>
      server.once("error", reject).listen(socket, resolve),
    );
    await NodeFSP.mkdir(dir, { mode: 0o700, recursive: true });
    const command = NodePath.join(await NodeFSP.mkdtemp(NodePath.join(dir, "open-")), "mac-device");
    const source =
      [
        "#!/bin/bash",
        "set -eu -o pipefail",
        "sock=" + quote(socket),
        '[[ -S "$sock" ]] || { echo "Mac guest disconnected or session closed. Open Mac again." >&2; exit 1; }',
        'call() { /usr/bin/curl -q --noproxy "*" --unix-socket "$sock" --silent --show-error --fail-with-body --max-time 200 "$@"; }',
        "command=${1:-help}",
        "shift || true",
        'case "$command" in',
        "launch)",
        '  [[ $# == 1 && -d "$1" && -f "$1/Contents/Info.plist" && "$1" == *.app ]] || { echo "Use launch /path/to/App.app" >&2; exit 2; }',
        "  archive=$(/usr/bin/mktemp -t cod3-mac-app)",
        "  trap '/bin/rm \"$archive\"' EXIT",
        '  /usr/bin/tar -cf "$archive" -C "$1" .',
        '  call -X POST --upload-file "$archive" -H "X-Bundle-Name: $(printf %s "${1##*/}" | /usr/bin/base64 | /usr/bin/tr -d \'\\n\')" http://localhost/launch ;;',
        "snapshot) [[ $# == 0 ]] || exit 2; call -X POST http://localhost/snapshot ;;",
        "click|type|key|verify-file)",
        '  [[ $# -gt 0 ]] || { echo "Missing command argument" >&2; exit 2; }',
        '  args=(); for value in "$@"; do args+=(--data-urlencode "arg=$value"); done',
        '  call -X POST "${args[@]}" "http://localhost/$command" ;;',
        "screenshot)",
        '  [[ $# == 1 ]] || { echo "Use screenshot /path/to/image.png" >&2; exit 2; }',
        '  tmp=$(/usr/bin/mktemp "${1}.XXXXXX"); trap \'/bin/rm -f "$tmp"\' EXIT',
        '  if call -X POST http://localhost/screenshot > "$tmp"; then /bin/mv "$tmp" "$1";',
        '  else code=$?; if [[ $code == 22 ]]; then /bin/cat "$tmp" >&2; fi; exit "$code"; fi ;;',
        'help) echo "launch APP.app | snapshot | click X Y | type TEXT | key [Cmd|Shift|Option|Ctrl ...] KEY | screenshot PATH.png | verify-file /guest/path" ;;',
        '*) echo "Unknown Mac guest command. Use help." >&2; exit 2 ;;',
        "esac",
      ].join("\n") + "\n";
    await NodeFSP.writeFile(command, source, { mode: 0o700 });
    await NodeFSP.chmod(command, 0o700);
    return { command, close };
  } catch (error) {
    await close();
    throw error;
  }
}
