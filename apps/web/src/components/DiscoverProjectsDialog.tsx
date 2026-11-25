import { getAddProjectInitialQuery } from "@cod3/client-runtime/operations/projects";
import {
  filterFilesystemBrowseEntries,
  getFilesystemBrowsePath,
} from "@cod3/client-runtime/state/filesystem";
import { appendBrowsePathSegment } from "@cod3/client-runtime/state/projects";
import {
  AuthFilesystemReadScope,
  AuthOrchestrationOperateScope,
  resolveEnvironmentMachineKind,
  type EnvironmentId,
  type FilesystemBrowseEntry,
} from "@cod3/contracts";
import {
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  FolderIcon,
  FolderSearchIcon,
} from "lucide-react";
import { fileBasename } from "@cod3/shared/path";
import { T, useGT } from "gt-react";
import { useId, useRef, useState } from "react";
import { create } from "zustand";

import {
  type EnvironmentPresentation,
  useEnvironments,
  usePrimaryEnvironmentId,
} from "../state/environments";
import { filesystemEnvironment } from "../state/filesystem";
import { useEnvironmentQuery } from "../state/query";
import { useEnvironmentScope } from "../state/session";
import { getEnvironmentBrowsePlatform } from "./CommandPalette.logic";
import { DiscoverProjectsResults } from "./DiscoverProjectsResults";
import { EnvironmentMachineIcon } from "./EnvironmentMachineIcon";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import { Label } from "./ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "./ui/select";

const useDiscovery = create(() => ({ open: false }));
export const openDiscoverProjects = () => useDiscovery.setState({ open: true });
const close = () => useDiscovery.setState({ open: false });

export function DiscoverProjectsDialogHost() {
  return useDiscovery((s) => s.open) ? <DiscoverProjectsDialog /> : null;
}

function DiscoverProjectsDialog() {
  const gt = useGT();
  const { environments } = useEnvironments();
  const primary = usePrimaryEnvironmentId();
  const popup = useRef<HTMLDivElement>(null);
  const connected = environments.filter((env) => env.connection.phase === "connected");
  const [machine, setMachine] = useState<EnvironmentId | null>(
    () =>
      connected.find((env) => env.environmentId === primary)?.environmentId ??
      connected[0]?.environmentId ??
      primary,
  );
  const target = connected.find((env) => env.environmentId === machine);
  const [busy, setBusy] = useState(false);
  const items = connected.map((env) => {
    const duplicate = connected.some((other) => other !== env && other.label === env.label);
    const address =
      env.displayUrl?.replace(/^https?:\/\//u, "").replace(/\/$/u, "") ?? env.environmentId;
    return {
      value: env.environmentId,
      label: duplicate ? `${env.label} · ${address}` : env.label,
      kind: resolveEnvironmentMachineKind(env.serverConfig),
    };
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogPopup
        ref={popup}
        className="sm:max-h-[min(42rem,100%)] sm:max-w-xl"
        showCloseButton={!busy}
        initialFocus={(openType) =>
          openType === "touch"
            ? popup.current
            : (popup.current?.querySelector<HTMLInputElement>("input") ?? popup.current)
        }
      >
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-3 pe-6">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 text-primary"
              aria-hidden="true"
            >
              <FolderSearchIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle>
                <T>Discover projects</T>
              </DialogTitle>
              <DialogDescription className="sr-only">
                <T>Find Git repositories in a folder on a connected machine.</T>
              </DialogDescription>
              {items.length === 1 && target ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <EnvironmentMachineIcon kind={items[0]!.kind} className="size-3.5" />
                  <span className="truncate">{target.label}</span>
                </div>
              ) : (
                items.length > 0 && (
                  <Select
                    items={items}
                    value={target?.environmentId ?? null}
                    disabled={busy}
                    onValueChange={(id) => {
                      if (id) setMachine(id);
                    }}
                  >
                    <SelectTrigger
                      variant="ghost"
                      size="xs"
                      className="-ms-2 max-w-full"
                      aria-label={gt("Machine")}
                    >
                      <EnvironmentMachineIcon
                        kind={resolveEnvironmentMachineKind(target?.serverConfig ?? null)}
                      />
                      <SelectValue placeholder={gt("Choose a connected machine.")} />
                    </SelectTrigger>
                    <SelectPopup>
                      {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          <span className="flex min-w-0 items-center gap-2">
                            <EnvironmentMachineIcon kind={item.kind} className="size-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                )
              )}
            </div>
          </div>
        </DialogHeader>
        {target ? (
          <DiscoveryFolder
            key={target.environmentId}
            target={target}
            busy={busy}
            setBusy={setBusy}
          />
        ) : (
          <DialogPanel>
            <Alert variant="info" role="status">
              <CircleAlertIcon />
              <AlertDescription>
                {connected.length
                  ? gt("Choose a connected machine.")
                  : gt("Connect a machine to browse its folders.")}
              </AlertDescription>
            </Alert>
          </DialogPanel>
        )}
      </DialogPopup>
    </Dialog>
  );
}

function DiscoveryFolder({
  target,
  busy,
  setBusy,
}: {
  target: EnvironmentPresentation;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const gt = useGT();
  const inputId = useId();
  const focusOnReturn = useRef(false);
  const { environmentId } = target;
  const canRead = useEnvironmentScope(environmentId, AuthFilesystemReadScope);
  const canCreate = useEnvironmentScope(environmentId, AuthOrchestrationOperateScope);
  const [folder, setFolder] = useState(() =>
    getAddProjectInitialQuery(target.serverConfig?.settings.addProjectBaseDirectory),
  );
  const [scanRoot, setScanRoot] = useState<string | null>(null);
  const supported = target.serverConfig?.environment.capabilities?.projectDiscovery === true;
  const browsePath = getFilesystemBrowsePath(
    folder,
    getEnvironmentBrowsePlatform(target.serverConfig?.environment.platform.os),
    canRead,
  );
  const browse = useEnvironmentQuery(
    supported && scanRoot === null && browsePath.isBrowsing && browsePath.directoryPath
      ? filesystemEnvironment.browse({
          environmentId,
          input: { partialPath: browsePath.directoryPath },
        })
      : null,
  );
  const { visibleEntries } = filterFilesystemBrowseEntries(
    browse.data?.entries ?? [],
    browsePath.filterQuery,
  );
  if (!supported || !canRead)
    return (
      <DialogPanel>
        <Alert variant="warning" role="status">
          <CircleAlertIcon />
          <AlertDescription>
            {!supported ? (
              <T>Update cod3 on this machine to discover projects.</T>
            ) : (
              <T>This connection cannot browse folders.</T>
            )}
          </AlertDescription>
        </Alert>
      </DialogPanel>
    );
  if (scanRoot !== null)
    return (
      <DiscoverProjectsResults
        environmentId={environmentId}
        root={scanRoot}
        canCreate={canCreate}
        busy={busy}
        setBusy={setBusy}
        onBack={() => {
          focusOnReturn.current = true;
          setScanRoot(null);
        }}
        onClose={close}
      />
    );
  const parent = browsePath.canBrowseUp ? browsePath.parentPath : null;
  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (folder.trim()) setScanRoot(folder.trim());
      }}
    >
      <div className="grid gap-2 px-6 pb-3">
        <Label htmlFor={inputId}>
          <T>Folder path</T>
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <FolderIcon />
          </InputGroupAddon>
          <InputGroupInput
            ref={(node) => {
              if (node && focusOnReturn.current) {
                focusOnReturn.current = false;
                node.focus({ preventScroll: true });
              }
            }}
            id={inputId}
            font="mono"
            value={folder}
            onChange={(event) => setFolder(event.currentTarget.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="~/GitHub"
          />
          {parent !== null && (
            <InputGroupAddon align="inline-end">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={gt("Up one folder")}
                onClick={() => setFolder(parent)}
              >
                <ArrowUpIcon />
              </Button>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>
      <DialogPanel>
        {browse.error ? (
          <Alert variant="error">
            <CircleAlertIcon />
            <AlertDescription>{browse.error}</AlertDescription>
          </Alert>
        ) : browse.data === null && browse.isPending && browsePath.isBrowsing ? (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            <T>Loading folders…</T>
          </p>
        ) : visibleEntries.length ? (
          <FolderList
            key={browsePath.directoryPath + "\u0000" + browsePath.filterQuery}
            entries={visibleEntries}
            directory={fileBasename(browsePath.directoryPath)}
            onChoose={(name) => setFolder(appendBrowsePathSegment(browsePath.directoryPath, name))}
          />
        ) : browse.data ? (
          <p className="py-4 text-sm text-muted-foreground">
            {browsePath.filterQuery ? gt("No matching folders.") : gt("No subfolders.")}
          </p>
        ) : null}
      </DialogPanel>
      <DialogFooter className="flex-row justify-between sm:justify-between">
        <Button type="button" variant="ghost" onClick={close}>
          <T>Cancel</T>
        </Button>
        <Button type="submit" disabled={!folder.trim()}>
          <T>Scan folder</T>
          <ArrowRightIcon />
        </Button>
      </DialogFooter>
    </form>
  );
}

function FolderList({
  directory,
  entries,
  onChoose,
}: {
  directory: string;
  entries: ReadonlyArray<FilesystemBrowseEntry>;
  onChoose: (name: string) => void;
}) {
  const gt = useGT();
  const [limit, setLimit] = useState(30);
  return (
    <div className="overflow-hidden rounded-lg border bg-background/60">
      <div className="border-b bg-muted/35 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span className="block truncate">{gt("Folders in {directory}", { directory })}</span>
      </div>
      {entries.slice(0, limit).map((entry) => (
        <button
          type="button"
          key={entry.fullPath}
          className="group flex min-h-10 w-full items-center gap-3 border-b px-3 py-2 text-start text-sm outline-none last:border-b-0 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => onChoose(entry.name)}
        >
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          <ChevronRightIcon className="size-3.5 text-muted-foreground/60 group-hover:text-foreground" />
        </button>
      ))}
      {entries.length > limit && (
        <div className="p-1">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setLimit(limit + 30)}
          >
            <T>Show more folders</T>
          </Button>
        </div>
      )}
    </div>
  );
}
