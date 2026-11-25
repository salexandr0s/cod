import { scopeProjectRef, scopedProjectKey } from "@cod3/client-runtime/environment";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { T, useGT, useMessages } from "gt-react";
import {
  BookOpenIcon,
  BoxesIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
  FileSlidersIcon,
  FolderGit2Icon,
  LibraryBigIcon,
  RefreshCwIcon,
  SquareSlashIcon,
  UsersIcon,
  WorkflowIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { openCommandPalette } from "~/commandPaletteBus";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";
import { useProjects } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import type { Project } from "~/types";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { WorkspacePageContainer } from "../WorkspacePageContainer";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { useProjectEntriesQuery, useProjectFileQuery } from "../files/projectFilesQueryState";
import {
  assistantName,
  assistants,
  buildCatalog,
  searchCatalog,
  sections,
  type Assistant,
  type Section,
} from "./catalog";
import { CatalogReader } from "./CatalogReader";
import { ClaudeAI, OpenAI } from "../Icons";

const sectionIcons = {
  skills: BoxesIcon,
  agents: UsersIcon,
  commands: SquareSlashIcon,
  workflows: WorkflowIcon,
  configuration: FileSlidersIcon,
  guides: BookOpenIcon,
  external: ExternalLinkIcon,
};
const sourceKey = (project: Project) =>
  scopedProjectKey(scopeProjectRef(project.environmentId, project.id));

export function AiConfigPage() {
  const gt = useGT();
  const projects = useProjects().filter((project) => !project.isScratch && !project.archivedAt);
  const primary = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  const search = useSearch({ from: "/_chat/ai-config" });
  const navigate = useNavigate();
  const matches = projects.filter((project) =>
    [project.title, project.workspaceRoot.split(/[/\\]/u).filter(Boolean).at(-1)].some(
      (name) => name && /^ai[ _-]?config$/iu.test(name),
    ),
  );
  const project = search.project
    ? projects.find((p) => sourceKey(p) === search.project)
    : (matches.find((p) => p.environmentId === primary) ?? matches[0]);
  const sources = projects
    .map((p) => ({
      value: sourceKey(p),
      label:
        environments.length > 1
          ? `${p.title} · ${environments.find((env) => env.environmentId === p.environmentId)?.label ?? p.environmentId}`
          : p.title,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden">
      <WorkspacePageHeader electron={isElectron} className="border-b">
        <BookOpenIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{gt("AI configuration")}</h1>
        {sources.length > 0 && (
          <div className="max-w-[50%] [-webkit-app-region:no-drag]">
            <Select
              items={sources}
              value={project ? sourceKey(project) : null}
              onValueChange={(value) => {
                if (value) void navigate({ to: "/ai-config", search: { project: value } });
              }}
            >
              <SelectTrigger aria-label={gt("Configuration project")} variant="ghost" size="sm">
                <FolderGit2Icon />
                <SelectValue placeholder={gt("Choose project")} />
              </SelectTrigger>
              <SelectPopup>
                {sources.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        )}
      </WorkspacePageHeader>
      {project ? (
        <ConfigLibrary key={sourceKey(project)} project={project} selectedPath={search.file} />
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <LibraryBigIcon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{gt("Choose a configuration project")}</EmptyTitle>
            <EmptyDescription>
              <T>Select your Claude and Codex repository, or add it to this machine.</T>
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => openCommandPalette({ open: "add-project" })}>
            {gt("Add project")}
          </Button>
        </Empty>
      )}
    </SidebarInset>
  );
}

function ConfigLibrary({
  project,
  selectedPath,
}: {
  project: Project;
  selectedPath: string | undefined;
}) {
  const gt = useGT();
  const messages = useMessages();
  const [section, setSection] = useState<Section>("skills");
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Section | "all">("all");
  const searchInput = useRef<HTMLInputElement>(null);
  const libraryScroll = useRef(0);
  const results = useRef<HTMLDivElement>(null);
  const resetScroll = () => {
    libraryScroll.current = 0;
    if (results.current) results.current.scrollTop = 0;
  };
  const list = useProjectEntriesQuery(
    project.environmentId,
    project.workspaceRoot,
    undefined,
    undefined,
    messages,
  );
  const hasManifest =
    list.data?.entries.some(
      (entry) => entry.path === "skills-manifest.json" && entry.kind === "file",
    ) ?? false;
  const manifest = useProjectFileQuery(
    project.environmentId,
    project.workspaceRoot,
    "skills-manifest.json",
    hasManifest,
    messages,
  );
  const catalog = buildCatalog(list.data?.entries ?? [], manifest.data?.contents);
  const refresh = () => {
    list.refresh();
    if (hasManifest) manifest.refresh();
  };
  const labels = {
    skills: gt("Skills"),
    agents: gt("Agents"),
    commands: gt("Commands"),
    workflows: gt("Workflows"),
    configuration: gt("Configuration"),
    guides: gt("Guides"),
    external: gt("External skills"),
  };
  const key = sourceKey(project);
  if (list.error || !list.data || (hasManifest && !manifest.data && !manifest.error)) {
    return (
      <Empty role={list.error ? "alert" : "status"}>
        <EmptyDescription>{list.error ?? gt("Loading…")}</EmptyDescription>
        {list.error && (
          <Button variant="outline" onClick={refresh}>
            {gt("Retry")}
          </Button>
        )}
      </Empty>
    );
  }
  if (selectedPath) {
    return (
      <CatalogReader
        key={selectedPath}
        project={project}
        projectKey={key}
        path={selectedPath}
        catalog={catalog}
      />
    );
  }
  const searching = Boolean(query.trim());
  const active = searching ? scope : section;
  const { items, external } = searchCatalog(catalog, query, assistant);
  const visible = items.filter((item) => active === "all" || item.section === active);
  const visibleExternal = active === "all" || active === "external" ? external : [];
  const count = visible.length + visibleExternal.length;
  const sectionOptions = sections
    .filter((s) => s !== "external" || catalog.external.length)
    .map((value) => ({
      value,
      label: labels[value],
      count:
        value === "external"
          ? external.length
          : items.filter((entry) => entry.section === value).length,
      Icon: sectionIcons[value],
    }));
  const options = [
    ...(searching
      ? [
          {
            value: "all" as const,
            label: gt("Search results"),
            count: items.length + external.length,
            Icon: SearchIcon,
          },
        ]
      : []),
    ...sectionOptions,
  ];
  const chooseSection = (value: Section | "all") => {
    resetScroll();
    if (searching) setScope(value);
    else if (value !== "all") setSection(value);
  };
  const changeQuery = (value: string) => {
    resetScroll();
    setQuery(value);
    if (!value.trim()) setScope("all");
  };
  const clearSearch = () => {
    changeQuery("");
    searchInput.current?.focus();
  };
  const currentLabel = active === "all" ? gt("Search results") : labels[active];
  return (
    <div className="@container/library flex min-h-0 flex-1 flex-col">
      <WorkspacePageContainer
        width="expanded"
        className="min-h-0 flex-1 gap-4 px-4 pt-4 pb-0 @[42rem]/library:gap-6 @[42rem]/library:pt-7"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{gt("Configuration library")}</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={gt("Refresh")}
            title={gt("Refresh")}
            onClick={refresh}
          >
            <RefreshCwIcon />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-40 flex-1">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                ref={searchInput}
                type="search"
                aria-label={gt("Search library")}
                placeholder={gt("Search library")}
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                className="[&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <InputGroupAddon align="inline-end">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={gt("Clear search")}
                    title={gt("Clear search")}
                    onClick={clearSearch}
                  >
                    <XIcon />
                  </Button>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
          <ToggleGroup
            aria-label={gt("Assistant")}
            value={[assistant ?? "all"]}
            onValueChange={(values) => {
              const value = values[0];
              if (value) {
                resetScroll();
                setAssistant(assistants.find((a) => a === value) ?? null);
              }
            }}
          >
            <Toggle value="all">{gt("All")}</Toggle>
            <Toggle value="claude">
              <ClaudeAI className="size-3.5" />
              Claude
            </Toggle>
            <Toggle value="codex">
              <OpenAI className="size-3.5" />
              Codex
            </Toggle>
          </ToggleGroup>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 border-t pt-3 @[42rem]/library:flex-row @[42rem]/library:gap-6 @[42rem]/library:pt-5">
          <nav
            aria-label={gt("Library sections")}
            className="hidden w-40 shrink-0 overflow-y-auto pb-4 @[42rem]/library:block"
          >
            {options.map(({ value, label, count: n, Icon }) => (
              <button
                key={value}
                type="button"
                aria-current={value === active ? "page" : undefined}
                onClick={() => chooseSection(value)}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  value === active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {label}
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{n}</span>
              </button>
            ))}
          </nav>
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-9 items-center gap-2 pb-2">
              <h3 className="hidden text-base font-semibold @[42rem]/library:block">
                {currentLabel}
              </h3>
              <div className="@[42rem]/library:hidden">
                <Select
                  items={options}
                  value={active}
                  onValueChange={(value) => {
                    if (value) chooseSection(value);
                  }}
                >
                  <SelectTrigger aria-label={gt("Library sections")} size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {options.map(({ value, label, count: n }) => (
                      <SelectItem key={value} value={value}>
                        {label} <span className="text-muted-foreground">{n}</span>
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <span
                aria-live="polite"
                aria-atomic="true"
                className="text-xs tabular-nums text-muted-foreground"
              >
                {count}
              </span>
            </div>
            {(manifest.error || catalog.invalidManifest || list.data.truncated) && (
              <p role="status" className="mb-3 text-sm text-muted-foreground">
                {manifest.error ??
                  (catalog.invalidManifest
                    ? gt("The skill manifest could not be read. Showing indexed files.")
                    : gt("The project index is incomplete."))}
              </p>
            )}
            <div
              ref={(node) => {
                results.current = node;
                if (!node) return;
                node.scrollTop = libraryScroll.current;
              }}
              onScroll={(event) => {
                libraryScroll.current = event.currentTarget.scrollTop;
              }}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t pb-6"
            >
              {count === 0 && (
                <Empty size="compact">
                  <EmptyDescription>{gt("No matching entries.")}</EmptyDescription>
                  {query && (
                    <Button variant="outline" size="sm" onClick={clearSearch}>
                      {gt("Clear search")}
                    </Button>
                  )}
                </Empty>
              )}
              {visible.map((item) => {
                const title =
                  item.section === "configuration" || item.section === "guides"
                    ? item.title.split("/").at(-1)
                    : item.title;
                const providers = assistants.filter((a) =>
                  item.editions.some((e) => e.assistant === a),
                );
                const Icon = sectionIcons[item.section];
                return (
                  <Link
                    key={item.section + "/" + item.title}
                    to="/ai-config"
                    search={{ project: key, file: item.first.path }}
                    className="group flex items-center gap-3 border-b border-border/65 px-1 py-3 outline-none hover:bg-accent/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @[42rem]/library:px-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-5 font-semibold break-words">
                        {title}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 line-clamp-2 break-words text-muted-foreground",
                          item.first.description
                            ? "text-sm leading-5"
                            : "font-mono text-xs leading-5",
                        )}
                      >
                        {item.first.description || item.first.path}
                      </span>
                      {active === "all" && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Icon aria-hidden className="size-3" />
                          {labels[item.section]}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 gap-2 text-muted-foreground">
                      {providers.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 text-xs">
                          {a === "claude" ? (
                            <ClaudeAI className="size-3.5" />
                          ) : (
                            <OpenAI className="size-3.5" />
                          )}
                          <span className="sr-only @[58rem]/library:not-sr-only">
                            {assistantName[a]}
                          </span>
                        </span>
                      ))}
                    </span>
                    <ChevronRightIcon
                      aria-hidden
                      className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
                    />
                  </Link>
                );
              })}
              {visibleExternal.map((entry) => (
                <article key={entry.id} className="border-b border-border/65 px-2 py-3">
                  <h4 className="text-sm font-semibold">{entry.id}</h4>
                  <p className="my-1 text-sm leading-5 text-muted-foreground">{entry.reason}</p>
                  {/^https?:\/\//iu.test(entry.source) && (
                    <a
                      className="inline-flex items-center gap-1 text-xs underline"
                      target="_blank"
                      rel="noreferrer"
                      href={entry.source}
                    >
                      {entry.source_label}
                      <ExternalLinkIcon aria-hidden className="size-3" />
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </WorkspacePageContainer>
    </div>
  );
}
