import type { ComponentProps } from "react";
import type { EnvironmentId, ScopedThreadRef } from "@cod3/contracts";

import ChatMarkdown from "~/components/ChatMarkdown";
import { resolvePathLinkTarget } from "@cod3/shared/fileLinks";
import { maskMarkdownFrontmatter } from "@cod3/shared/markdownFrontmatter";

export function FileMarkdownPreview(props: {
  readonly cwd: string;
  readonly relativePath: string;
  readonly text: string;
  readonly threadRef?: ScopedThreadRef;
  readonly environmentId?: EnvironmentId;
  readonly renderDocumentLink?: ComponentProps<typeof ChatMarkdown>["renderDocumentLink"];
  readonly workspaceMutationId: string | null;
  readonly className?: string;
  readonly onTaskListChange?:
    | ((input: { readonly markerOffset: number; readonly checked: boolean }) => void)
    | undefined;
}) {
  const lastSeparator = Math.max(
    props.relativePath.lastIndexOf("/"),
    props.relativePath.lastIndexOf("\\"),
  );
  const imageBaseDir =
    lastSeparator >= 0
      ? resolvePathLinkTarget(props.relativePath.slice(0, lastSeparator + 1), props.cwd)
      : props.cwd;

  return (
    <ChatMarkdown
      text={maskMarkdownFrontmatter(props.text)}
      cwd={props.cwd}
      imageBaseDir={imageBaseDir}
      threadRef={props.threadRef}
      environmentId={props.environmentId}
      renderDocumentLink={props.renderDocumentLink}
      workspaceMutationId={props.workspaceMutationId}
      className={props.className ?? "mx-auto max-w-4xl px-6 py-5"}
      onTaskListChange={props.onTaskListChange}
    />
  );
}
