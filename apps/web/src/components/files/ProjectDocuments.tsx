import type { EnvironmentId, ProjectEntry } from "@cod3/contracts";
import { useGT, useMessages } from "gt-react";
import {
  ChevronRightIcon,
  ClipboardListIcon,
  FileTextIcon,
  ListChecksIcon,
  MapIcon,
  TargetIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { projectDocsDirectory, findProjectDocuments } from "./projectDocuments.logic";
import { useProjectEntriesQuery } from "./projectFilesQueryState";

const documentIcons = [
  ListChecksIcon,
  TargetIcon,
  ClipboardListIcon,
  FileTextIcon,
  MapIcon,
] as const;

const rowStyles = {
  featured: {
    row: "gap-3 bg-info/5 px-3.5 py-3.5",
    icon: "size-9 rounded-lg bg-info/12",
    name: "truncate text-base font-semibold",
  },
  regular: { row: "gap-3 px-3.5 py-2", icon: "h-5 w-9", name: "truncate text-sm" },
  compact: {
    row: "gap-2 rounded-md px-1.5 py-1.5",
    icon: "size-5",
    name: "line-clamp-2 wrap-anywhere text-xs leading-4",
  },
};

export function ProjectDocumentLinks({
  entries,
  onOpenFile,
  selectedPath,
}: {
  entries: readonly ProjectEntry[];
  onOpenFile: (path: string) => void;
  /** The explorer passes its selection, including null when browsing a folder. */
  selectedPath?: string | null;
}) {
  const gt = useGT();
  const documents = findProjectDocuments(entries);
  if (!documents.length) return null;
  const compact = selectedPath !== undefined;
  const heading = gt("Project documents");

  return (
    <section
      aria-label={heading}
      className={cn("min-w-0 shrink-0", compact && "border-b border-border/60 px-2 pt-2 pb-2.5")}
    >
      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "mb-1 px-1.5 text-xs" : "mb-2.5 text-sm",
        )}
      >
        {heading}
      </h3>
      <div
        className={cn(
          "flex flex-col overflow-y-auto overscroll-contain",
          compact
            ? "max-h-44 gap-0.5"
            : "max-h-64 divide-y divide-border/60 rounded-xl border border-border/70 bg-background",
        )}
      >
        {documents.map(({ path, rank }, index) => {
          const name = path.slice(path.lastIndexOf("/") + 1);
          const folder = path.slice(0, path.length - name.length);
          const featured = !compact && rank === 0 && index === 0;
          const style = featured
            ? rowStyles.featured
            : compact
              ? rowStyles.compact
              : rowStyles.regular;
          const current = selectedPath === path;
          const Icon = documentIcons[rank] ?? FileTextIcon;
          return (
            <Tooltip key={path}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={path}
                    aria-current={current ? "page" : undefined}
                    onClick={() => onOpenFile(path)}
                    className={cn(
                      "relative flex w-full min-w-0 shrink-0 cursor-pointer items-center text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      style.row,
                      current && "bg-accent text-accent-foreground",
                    )}
                  />
                }
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex shrink-0 items-center justify-center",
                    style.icon,
                    rank === 0 ? "text-info-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className={featured ? "size-5" : "size-4"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block",
                      style.name,
                      !featured && (current || rank === 0) && "font-semibold",
                    )}
                  >
                    {featured ? name.slice(0, name.lastIndexOf(".")) : name}
                  </span>
                  {featured && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {path}
                    </span>
                  )}
                  {compact && folder && (
                    <span
                      aria-hidden
                      className="block truncate text-2xs leading-4 text-muted-foreground"
                    >
                      {folder}
                    </span>
                  )}
                </span>
                {folder && !compact && !featured && (
                  <span aria-hidden className="shrink-0 text-2xs text-muted-foreground">
                    {folder}
                  </span>
                )}
                {featured && (
                  <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-info-foreground" />
                )}
                {current && (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-info-foreground"
                  />
                )}
              </TooltipTrigger>
              <TooltipPopup>{path}</TooltipPopup>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}

export function ProjectDocuments(props: {
  environmentId: EnvironmentId;
  cwd: string;
  revision: string | null;
  onOpenFile: (path: string) => void;
}) {
  const messages = useMessages();
  const root = useProjectEntriesQuery(props.environmentId, props.cwd, "", props.revision, messages);
  const entries = root.data?.entries ?? [];
  const directory = projectDocsDirectory(entries);
  const docs = useProjectEntriesQuery(
    props.environmentId,
    props.cwd,
    directory ?? null,
    props.revision,
    messages,
  );
  return (
    <ProjectDocumentLinks
      entries={[...entries, ...(docs.data?.entries ?? [])]}
      onOpenFile={props.onOpenFile}
    />
  );
}
