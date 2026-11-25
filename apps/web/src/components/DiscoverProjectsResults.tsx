import { thrownErrorMessage } from "@cod3/client-runtime/errors";
import {
  CommandId,
  type EnvironmentId,
  type WorkspaceDiscoverProjectsResult,
} from "@cod3/contracts";
import { fileBasename, workspaceRelativeFilePath } from "@cod3/shared/path";
import { T, useGT } from "gt-react";
import {
  BookMarkedIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FolderOpenIcon,
  FolderSearchIcon,
  GitBranchIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { m } from "../i18n/messages";
import { cn, newProjectId } from "../lib/utils";
import { isNewOnboardingProject } from "../onboarding/projectImport.logic";
import { readProjects, useProjects } from "../state/entities";
import { filesystemEnvironment } from "../state/filesystem";
import { projectEnvironment } from "../state/projects";
import { formatEnvironmentQueryError, useEnvironmentQuery } from "../state/query";
import { useAtomCommand } from "../state/use-atom-command";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { DialogFooter, DialogPanel } from "./ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import { MiddleTruncate } from "./ui/middle-truncate";

type Repository = WorkspaceDiscoverProjectsResult["repositories"][number];
type DiscoveryRow = Repository & { relativePath: string };
type Group = "new" | "linked" | "added";

const focusScanLocation = (node: HTMLParagraphElement | null) =>
  node?.focus({ preventScroll: true });

export function DiscoverProjectsResults({
  environmentId,
  root,
  canCreate,
  busy,
  setBusy,
  onBack,
  onClose,
}: {
  environmentId: EnvironmentId;
  root: string;
  canCreate: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const gt = useGT();
  const scan = useEnvironmentQuery(
    filesystemEnvironment.discoverProjects({ environmentId, input: { workspaceRoot: root } }),
  );
  const isNew = isNewOnboardingProject(useProjects());
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const filterInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const attempts = useRef(new Map<string, ReturnType<typeof newProjectId>>());
  const running = useRef(false);
  const data = scan.error === null ? scan.data : null;
  const folder = data?.workspaceRoot ?? root;
  const groups: Record<Group, DiscoveryRow[]> = { new: [], linked: [], added: [] };
  const selection: Repository[] = [];
  const filter = query.trim().normalize("NFC").toLowerCase();
  let available = 0;
  for (const repo of data?.repositories ?? []) {
    const group =
      added.has(repo.path) || !isNew(environmentId, repo)
        ? "added"
        : repo.linkedWorktree
          ? "linked"
          : "new";
    if (group !== "added") {
      available += 1;
      if (selected.has(repo.path)) selection.push(repo);
    }
    const relativePath = workspaceRelativeFilePath(repo.path, folder) ?? repo.path;
    if (
      !filter ||
      relativePath.normalize("NFC").toLowerCase().includes(filter) ||
      repo.name.normalize("NFC").toLowerCase().includes(filter)
    ) {
      groups[group].push({ ...repo, relativePath });
    }
  }
  const toggle = (rows: ReadonlyArray<Repository>, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of rows) {
        if (checked) next.add(row.path);
        else next.delete(row.path);
      }
      return next;
    });
  const submit = async () => {
    if (running.current || !canCreate || !selection.length) return;
    running.current = true;
    setBusy(true);
    setErrors(new Map());
    // A selection can span several searches. Show the whole batch so individual errors are visible.
    setQuery("");
    for (const [index, repo] of selection.entries()) {
      setProgress({ current: index + 1, total: selection.length });
      try {
        if (!isNewOnboardingProject(readProjects())(environmentId, repo)) continue;
        const projectId = attempts.current.get(repo.path) ?? newProjectId();
        attempts.current.set(repo.path, projectId);
        const result = await createProject({
          environmentId,
          input: {
            projectId,
            commandId: CommandId.make(`discover:project:create:${projectId}`),
            title: repo.name,
            workspaceRoot: repo.path,
            createWorkspaceRootIfMissing: false,
            defaultModelSelection: null,
          },
        });
        if (result._tag === "Failure") {
          const message = formatEnvironmentQueryError(result.cause);
          setErrors((prev) => new Map(prev).set(repo.path, message));
        } else {
          setAdded((prev) => new Set(prev).add(repo.path));
        }
      } catch (cause) {
        const message = thrownErrorMessage(cause, m) ?? gt("Could not add project.");
        setErrors((prev) => new Map(prev).set(repo.path, message));
      }
    }
    running.current = false;
    setBusy(false);
  };
  const titles = {
    new: gt("New repositories"),
    linked: gt("Linked worktrees"),
    added: gt("Already added"),
  };
  const nothingVisible = !groups.new.length && !groups.linked.length && !groups.added.length;
  const allVisibleNewSelected =
    groups.new.length > 0 && groups.new.every((row) => selected.has(row.path));
  const showAdd = busy || (canCreate && (selection.length > 0 || (!added.size && available > 0)));
  return (
    <>
      <div className="grid min-w-0 gap-3 px-6 pb-3">
        <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <FolderOpenIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p
              ref={focusScanLocation}
              tabIndex={-1}
              className="truncate text-sm font-medium outline-none"
            >
              {fileBasename(folder)}
            </p>
            <div className="flex min-w-0 font-mono text-xs text-muted-foreground">
              <MiddleTruncate value={root.startsWith("~/") ? root : folder} />
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={onBack}>
            <T>Change folder</T>
          </Button>
        </div>
        {data && data.repositories.length > 1 && (
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              ref={filterInput}
              type="text"
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  event.preventDefault();
                  event.stopPropagation();
                  setQuery("");
                }
              }}
              aria-label={gt("Filter repositories")}
              placeholder={gt("Filter by name or path…")}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              disabled={busy}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={gt("Clear filter")}
                  onClick={() => {
                    setQuery("");
                    filterInput.current?.focus();
                  }}
                >
                  <XIcon />
                </Button>
              </InputGroupAddon>
            )}
          </InputGroup>
        )}
      </div>
      <DialogPanel>
        {scan.error ? (
          <Alert variant="error">
            <CircleAlertIcon />
            <AlertDescription>
              <span className="wrap-anywhere">{scan.error}</span>
            </AlertDescription>
          </Alert>
        ) : !data ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
          >
            <FolderSearchIcon className="size-4" />
            <T>Scanning folder…</T>
          </div>
        ) : (
          <>
            {(data.truncated || data.skipped > 0) && (
              <Alert variant="warning" role="status">
                <CircleAlertIcon />
                <AlertDescription>
                  {data.truncated && (
                    <p>
                      <T>Scan limit reached. Choose a smaller folder to see more repositories.</T>
                    </p>
                  )}
                  {data.skipped > 0 && (
                    <p>
                      <T>Some folders could not be inspected.</T>
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {!canCreate && (
              <Alert variant="info" role="status">
                <CircleAlertIcon />
                <AlertDescription>
                  <T>This connection cannot add projects.</T>
                </AlertDescription>
              </Alert>
            )}
            {nothingVisible ? (
              <Empty role="status">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {filter ? <SearchIcon /> : <FolderSearchIcon />}
                  </EmptyMedia>
                  <EmptyTitle>
                    {filter ? gt("No matching repositories.") : gt("No repositories found.")}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              (["new", "linked", "added"] as const).map(
                (kind) =>
                  groups[kind].length > 0 && (
                    <RepositoryGroup
                      key={kind}
                      kind={kind}
                      title={titles[kind]}
                      count={groups[kind].length}
                      collapsible={kind === "added" && available > 0 && !filter}
                      action={
                        kind === "new" && (groups.new.length > 1 || filter) && canCreate ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={busy}
                            onClick={() => toggle(groups.new, !allVisibleNewSelected)}
                          >
                            {allVisibleNewSelected
                              ? filter
                                ? gt("Clear visible")
                                : gt("Clear selection")
                              : filter
                                ? gt("Select visible")
                                : gt("Select all")}
                          </Button>
                        ) : null
                      }
                    >
                      {groups[kind].map((repo) => (
                        <RepositoryRow
                          key={repo.path}
                          repo={repo}
                          registered={kind === "added"}
                          checked={selected.has(repo.path)}
                          disabled={busy || !canCreate}
                          error={kind === "added" ? undefined : errors.get(repo.path)}
                          onCheck={(checked) => toggle([repo], checked)}
                        />
                      ))}
                    </RepositoryGroup>
                  ),
              )
            )}
          </>
        )}
      </DialogPanel>
      <DialogFooter className="flex-row flex-wrap items-center justify-between sm:justify-between">
        <div
          role="status"
          className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
        >
          {busy ? (
            gt("Adding {current} of {total}…", progress)
          ) : added.size ? (
            <>
              <CircleCheckIcon className="size-4 text-success" />
              {gt("{count, plural, one {{count} project added} other {{count} projects added}}", {
                count: added.size,
              })}
            </>
          ) : showAdd || scan.error || !data ? (
            <Button variant="ghost" onClick={onClose}>
              <T>Cancel</T>
            </Button>
          ) : null}
        </div>
        {scan.error ? (
          <Button onClick={scan.refresh}>
            <T>Retry</T>
          </Button>
        ) : showAdd ? (
          <Button disabled={busy || !selection.length} onClick={() => void submit()}>
            {busy
              ? gt("Adding projects…")
              : selection.length
                ? selection.every((repo) => errors.has(repo.path))
                  ? gt(
                      "{count, plural, one {Retry {count} project} other {Retry {count} projects}}",
                      { count: selection.length },
                    )
                  : gt("{count, plural, one {Add {count} project} other {Add {count} projects}}", {
                      count: selection.length,
                    })
                : gt("Add selected")}
          </Button>
        ) : data ? (
          <Button onClick={onClose}>
            <T>Done</T>
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}

function RepositoryGroup({
  kind,
  title,
  count,
  collapsible,
  action,
  children,
}: {
  kind: Group;
  title: string;
  count: number;
  collapsible: boolean;
  action: ReactNode;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const headingId = useId();
  const heading = (
    <>
      {title}
      <span className="rounded-md bg-muted px-1.5 font-mono text-xs font-normal tabular-nums text-muted-foreground">
        {count}
      </span>
    </>
  );
  return (
    <section aria-labelledby={headingId} className="space-y-1">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 id={headingId} className="min-w-0 text-sm font-semibold">
          {collapsible ? (
            <button
              type="button"
              className="flex items-center gap-2 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronRightIcon className={cn("size-3.5", expanded && "rotate-90")} />
              {heading}
            </button>
          ) : (
            <span className="flex items-center gap-2">{heading}</span>
          )}
        </h3>
        {action}
      </div>
      {(!collapsible || expanded) && (
        <div
          id={listId}
          className={cn(
            "divide-y overflow-hidden rounded-lg border",
            kind === "added" ? "bg-muted/15" : "bg-background/60",
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function RepositoryRow({
  repo,
  registered,
  checked,
  disabled,
  error,
  onCheck,
}: {
  repo: DiscoveryRow;
  registered: boolean;
  checked: boolean;
  disabled: boolean;
  error: string | undefined;
  onCheck: (checked: boolean) => void;
}) {
  const gt = useGT();
  const Icon = repo.linkedWorktree ? GitBranchIcon : BookMarkedIcon;
  const nested = repo.relativePath !== repo.name && repo.relativePath !== ".";
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          !registered && checked ? "text-primary" : "text-muted-foreground",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{repo.name}</span>
        {nested && (
          <span className="block break-all font-mono text-xs text-muted-foreground">
            {repo.relativePath}
          </span>
        )}
        {registered && repo.linkedWorktree && (
          <span className="block text-xs text-muted-foreground">{gt("Linked worktree")}</span>
        )}
      </span>
    </>
  );
  return (
    <div>
      {registered ? (
        <div className="flex min-h-10 items-center gap-3 px-3 py-2 text-muted-foreground">
          {content}
          <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
        </div>
      ) : (
        <label
          className={cn(
            "flex min-h-11 items-center gap-3 px-3 py-2 has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-ring",
            disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/60",
            checked && "bg-primary/6",
          )}
        >
          {content}
          <Checkbox
            disabled={disabled}
            checked={checked}
            onCheckedChange={onCheck}
            aria-label={nested ? repo.relativePath : repo.name}
          />
        </label>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 px-3 pb-2 text-xs text-destructive">
          <CircleAlertIcon className="size-3.5 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}
    </div>
  );
}
