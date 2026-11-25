import { useGT } from "gt-react";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { Button } from "../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface SidebarThreadHeaderProps {
  projectScope: ReactNode;
  onNewThread: (event: ReactMouseEvent) => void;
  newThreadShortcutLabel: string | null | undefined;
  newThreadInProjectShortcutLabel: string | null | undefined;
  showNewThreadInProjectHint: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchBlur: () => void;
  onSearchKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  isSearching: boolean;
  searchResultCount: number;
  activeSearchResultIndex: number;
  onClearSearch: () => void;
}

export function SidebarThreadHeader({
  projectScope,
  onNewThread,
  newThreadShortcutLabel,
  newThreadInProjectShortcutLabel,
  showNewThreadInProjectHint,
  searchInputRef,
  searchQuery,
  onSearchQueryChange,
  onSearchKeyDown,
  onSearchBlur,
  isSearching,
  searchResultCount,
  activeSearchResultIndex,
  onClearSearch,
}: SidebarThreadHeaderProps) {
  const gt = useGT();
  const resultsVisible = isSearching && searchResultCount > 0;
  // Shrinking results can remove the active option; never leave aria-activedescendant pointing at it.
  const activeResultExists = resultsVisible && activeSearchResultIndex < searchResultCount;
  const newThreadLabel = newThreadShortcutLabel
    ? gt("New thread ({shortcut})", { shortcut: newThreadShortcutLabel })
    : gt("New thread");

  return (
    <div className="@container/thread-header flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1.5">
        {projectScope}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={gt("New thread")}
                onClick={onNewThread}
              />
            }
          >
            <PlusIcon aria-hidden />
          </TooltipTrigger>
          <TooltipPopup side="bottom">
            {newThreadLabel}
            {showNewThreadInProjectHint && (
              <div className="text-muted-foreground">
                {newThreadInProjectShortcutLabel
                  ? gt("New thread in current project: Shift+click ({shortcut})", {
                      shortcut: newThreadInProjectShortcutLabel,
                    })
                  : gt("New thread in current project: Shift+click")}
              </div>
            )}
          </TooltipPopup>
        </Tooltip>
      </div>
      <InputGroup variant="ghost">
        <InputGroupAddon>
          <SearchIcon aria-hidden className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          ref={searchInputRef}
          nativeInput
          type="text"
          inputMode="search"
          autoComplete="off"
          size="sm"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          onKeyDown={onSearchKeyDown}
          onBlur={onSearchBlur}
          placeholder={gt("Search threads")}
          aria-label={gt("Search threads")}
          role="combobox"
          aria-keyshortcuts="/"
          aria-autocomplete="list"
          aria-expanded={resultsVisible}
          aria-controls={resultsVisible ? "sidebar-thread-search-results" : undefined}
          aria-activedescendant={
            activeResultExists
              ? `sidebar-thread-search-result-${activeSearchResultIndex}`
              : undefined
          }
        />
        {searchQuery.length > 0 && (
          <InputGroupAddon align="inline-end">
            <Button
              size="icon-xs"
              variant="ghost-muted"
              aria-label={gt("Clear thread search")}
              onClick={() => {
                onClearSearch();
                searchInputRef.current?.focus();
              }}
            >
              <XIcon aria-hidden />
            </Button>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}
