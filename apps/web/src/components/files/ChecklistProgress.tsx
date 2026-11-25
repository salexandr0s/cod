import { maskMarkdownFrontmatter } from "@cod3/shared/markdownFrontmatter";
import { LARGE_MARKDOWN_CHUNK_MAX_CHARS } from "@cod3/shared/markdownChunks";
import type { Element, Root } from "hast";
import { useGT } from "gt-react";
import { CheckCheckIcon, ListChecksIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { markdownTree } from "~/markdown/wordsHast";

function taskCounts(markdown: string) {
  // The reader virtualizes large documents. Don't parse a whole large file for its progress bar.
  if (markdown.length > LARGE_MARKDOWN_CHUNK_MAX_CHARS || !/\[[ xX]\]/.test(markdown)) return null;
  let done = 0;
  let total = 0;
  const visit = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      if (child.tagName === "input" && child.properties.type === "checkbox") {
        total++;
        if (child.properties.checked) done++;
      } else {
        visit(child);
      }
    }
  };
  visit(markdownTree(maskMarkdownFrontmatter(markdown), { skipHtml: true }));
  return total ? { done, total } : null;
}

export function ChecklistProgress({ contents }: { contents: string }) {
  const gt = useGT();
  const counts = taskCounts(contents);
  if (counts === null) return null;
  const { done, total } = counts;
  const label = gt("{done} of {total} complete", { done, total });
  const finished = done === total;
  const Icon = finished ? CheckCheckIcon : ListChecksIcon;
  return (
    <div
      role="progressbar"
      aria-label={gt("Checklist progress")}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={label}
      className="shrink-0 border-b border-border/50 bg-muted/20"
    >
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-2.5">
        <Icon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            finished ? "text-success-foreground" : "text-info-foreground",
          )}
        />
        <span className="text-xs font-medium text-foreground tabular-nums">{label}</span>
        <span className="ms-auto h-1.5 w-1/3 max-w-28 overflow-hidden rounded-full bg-foreground/10">
          <span
            className={cn("block h-full rounded-full", finished ? "bg-success" : "bg-info")}
            style={{ width: `${(done / total) * 100}%` }}
          />
        </span>
      </div>
    </div>
  );
}
