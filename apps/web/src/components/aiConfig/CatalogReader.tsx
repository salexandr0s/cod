import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useGT, useMessages } from "gt-react";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  Code2Icon,
  FilesIcon,
  ListTreeIcon,
  RefreshCwIcon,
} from "lucide-react";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import type { Project } from "~/types";
import { FileSurfaceAction } from "../files/fileSurfaceChrome";
import { findLocalMarkdownFragment } from "../chat/markdownFragments";
import { FileMarkdownPreview } from "../files/FileMarkdownPreview";
import { useProjectFileQuery } from "../files/projectFilesQueryState";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Empty, EmptyDescription } from "../ui/empty";
import { assistantName, type buildCatalog, linkedCatalogFile, packageFiles } from "./catalog";

const ReadOnlySourcePreview = lazy(() => import("../files/ReadOnlySourcePreview"));

export function CatalogReader({
  project,
  projectKey,
  path,
  catalog,
}: {
  project: Project;
  projectKey: string;
  path: string;
  catalog: ReturnType<typeof buildCatalog>;
}) {
  const gt = useGT();
  const messages = useMessages();
  const navigate = useNavigate();
  const { anchor } = useSearch({ from: "/_chat/ai-config" });
  const [showSource, setShowSource] = useState(false);
  const markdown = /\.(md|markdown)$/iu.test(path);
  const preview = useRef<HTMLDivElement>(null);
  const chosenHeading = useRef<HTMLElement | null>(null);
  const [outline, setOutline] = useState<{ id: string; label: string; level: number }[]>([]);
  const allowed = catalog.files.has(path);
  const file = useProjectFileQuery(
    project.environmentId,
    project.workspaceRoot,
    path,
    allowed,
    messages,
  );
  const search = { project: projectKey };
  const related = packageFiles(catalog.files, path);
  const item = catalog.items.find((item) =>
    item.editions.some((edition) => edition.path === path || related.includes(edition.path)),
  );
  const editions = item?.editions ?? [];
  const variants = new Set(editions.map((e) => e.path)).size > 1;
  const contents = file.data?.contents;
  // oxlint-disable-next-line cod3/no-unreasoned-state-sync -- Read the Markdown renderer's actual heading IDs after it commits the current document.
  useLayoutEffect(() => {
    const node = preview.current;
    if (!node || !allowed || file.error || contents === undefined || showSource) return;
    const headings = node.querySelectorAll<HTMLElement>(":is(h1,h2,h3,h4,h5,h6)[id]");
    setOutline(
      Array.from(headings, (heading) => ({
        id: heading.id,
        label: heading.textContent.trim(),
        level: Number(heading.tagName.slice(1)),
      })),
    );
    if (anchor) findLocalMarkdownFragment(node, anchor)?.scrollIntoView({ block: "start" });
  }, [anchor, contents, showSource, file.error, allowed]);
  const loading = gt("Loading…");
  const filenames = related.map((value) => ({ value, label: value.split("/").slice(3).join("/") }));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-6">
        <Button variant="ghost" size="sm" render={<Link to="/ai-config" search={search} />}>
          <ArrowLeftIcon />
          {gt("Back to library")}
        </Button>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {variants &&
            editions.map((e) => (
              <Button
                key={e.path}
                size="sm"
                variant={path === e.path || related.includes(e.path) ? "secondary" : "ghost"}
                render={<Link to="/ai-config" search={{ ...search, file: e.path }} />}
              >
                {e.assistant ? assistantName[e.assistant] : e.name}
              </Button>
            ))}
          {related.length > 1 && (
            <div className="max-w-[min(14rem,75vw)]">
              <Select
                items={filenames}
                value={path}
                onValueChange={(value) => {
                  if (value)
                    void navigate({ to: "/ai-config", search: { ...search, file: value } });
                }}
              >
                <SelectTrigger aria-label={gt("Skill files")} size="sm" variant="ghost">
                  <FilesIcon />
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {filenames.map((f) => (
                    <SelectItem value={f.value} key={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          )}
          {allowed &&
            markdown &&
            !showSource &&
            contents !== undefined &&
            !file.error &&
            outline.length > 1 && (
              <Menu
                onOpenChange={(open) => {
                  if (open) chosenHeading.current = null;
                }}
              >
                <MenuTrigger render={<Button variant="ghost" size="sm" />}>
                  <ListTreeIcon />
                  {gt("On this page")}
                </MenuTrigger>
                <MenuPopup align="end" finalFocus={() => chosenHeading.current ?? true}>
                  {outline.map((heading) => (
                    <MenuItem
                      key={heading.id}
                      onClick={() => {
                        const node =
                          preview.current &&
                          findLocalMarkdownFragment(
                            preview.current,
                            "#" + encodeURIComponent(heading.id),
                          );
                        if (node) {
                          node.tabIndex = -1;
                          chosenHeading.current = node;
                          node.scrollIntoView({ block: "start" });
                        }
                      }}
                    >
                      <span
                        className="block max-w-64 truncate"
                        style={{ paddingInlineStart: Math.min(heading.level - 1, 3) * 10 }}
                      >
                        {heading.label}
                      </span>
                    </MenuItem>
                  ))}
                </MenuPopup>
              </Menu>
            )}
          {allowed && markdown && (
            <FileSurfaceAction
              label={showSource ? gt("Show rendered markdown") : gt("Show markdown source")}
              pressed={showSource}
              onPress={() => setShowSource(!showSource)}
            >
              {showSource ? <BookOpenIcon /> : <Code2Icon />}
            </FileSurfaceAction>
          )}
          {allowed && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={gt("Refresh")}
              title={gt("Refresh")}
              onClick={file.refresh}
            >
              <RefreshCwIcon />
            </Button>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-5 pt-5 pb-3 sm:px-8">
        <p className="break-all font-mono text-xs text-muted-foreground">{path}</p>
        {item && (!markdown || !contents?.match(/^#\s+\S/mu)) && (
          <h2 className="mt-1.5 break-words text-xl font-semibold tracking-tight">
            {item.title.split("/").at(-1)}
          </h2>
        )}
      </div>
      {!allowed || file.error || contents === undefined ? (
        <Empty role={!allowed || file.error ? "alert" : "status"}>
          <EmptyDescription>
            {!allowed
              ? gt("This file is no longer in the project index.")
              : (file.error ?? loading)}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          {file.data?.truncated && (
            <p role="status" className="px-5 text-sm text-muted-foreground">
              {gt("Showing a partial preview.")}
            </p>
          )}
          {markdown && !showSource ? (
            <div ref={preview} className="scrollbar-gutter-both min-h-0 flex-1 overflow-auto">
              <FileMarkdownPreview
                cwd={project.workspaceRoot}
                relativePath={path}
                text={contents}
                environmentId={project.environmentId}
                workspaceMutationId={null}
                className="mx-auto max-w-3xl px-5 pt-2 pb-12 sm:px-8"
                renderDocumentLink={(href, children) => {
                  const target = linkedCatalogFile(catalog.files, path, href);
                  return target ? (
                    <Link
                      to="/ai-config"
                      search={{
                        ...search,
                        file: target.file,
                        ...(target.hash ? { anchor: "#" + target.hash } : {}),
                      }}
                    >
                      {children}
                    </Link>
                  ) : null;
                }}
              />
            </div>
          ) : (
            <Suspense fallback={<p role="status">{loading}</p>}>
              <ReadOnlySourcePreview name={path} text={contents} />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}
