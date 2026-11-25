import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  ArchiveIcon,
  FlaskConicalIcon,
  BotIcon,
  createLucideIcon,
  CalendarClockIcon,
  FileDiffIcon,
  FolderTreeIcon,
  GitBranchIcon,
  GlobeIcon,
  InfoIcon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  PanelsTopLeftIcon,
  KeyboardIcon,
  KeyRoundIcon,
  MicIcon,
  PaletteIcon,
  SearchIcon,
  ServerIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SmartphoneIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { resolveEventKeys } from "@cod3/shared/keybindings";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { T, useGT, useMessages } from "gt-react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Kbd } from "../ui/kbd";
import {
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { scrollToSettingsTarget } from "./settingsLayout";
import {
  searchSettings,
  revealSettingsSearchTarget,
  settingsNavGroups,
  SETTINGS_NAV_LABELS,
  SETTINGS_SECTION_LABELS,
  type SettingsPath,
  type SettingsSearchItem,
} from "./settingsSearch";
import {
  useAvailableSettingsSearchItems,
  useHasSecretProvidersEnvironment,
} from "./useAvailableSettingsSearchItems";
import { handleSettingsSectionKeyDown } from "./settingsSectionNavigation";
import { workspaceAreaProps } from "../../lib/workspaceFocus";

const SnapShotIcon = createLucideIcon("snap-shot", [
  [
    "path",
    {
      d: "M8 3H6a3 3 0 0 0-3 3v2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2",
      key: "capture-frame",
    },
  ],
  ["rect", { width: "10", height: "8", x: "7", y: "8", rx: "2", key: "window" }],
  ["circle", { cx: "12", cy: "12", r: "1.5", key: "lens" }],
]);

const Cod3ConnectSidebarSignIn = lazy(() =>
  import("../clerk/Cod3ConnectSidebarSignIn").then((module) => ({
    default: module.Cod3ConnectSidebarSignIn,
  })),
);
const Cod3ConnectSidebarAvatar = lazy(() =>
  import("../clerk/Cod3ConnectSidebarSignIn").then((module) => ({
    default: module.Cod3ConnectSidebarAvatar,
  })),
);

const SETTINGS_SECTION_ICONS: Readonly<
  Record<SettingsPath, ComponentType<{ className?: string }>>
> = {
  "/settings/general": Settings2Icon,
  "/settings/diagnostics": WrenchIcon,
  "/settings/voice": MicIcon,
  "/settings/appearance": PaletteIcon,
  "/settings/chat": MessageSquareTextIcon,
  "/settings/diffs": FileDiffIcon,
  "/settings/projects": PanelsTopLeftIcon,
  "/settings/keybindings": KeyboardIcon,
  "/settings/snap-shot": SnapShotIcon,
  "/settings/providers": BotIcon,
  "/settings/threads": MessagesSquareIcon,
  "/settings/browser": GlobeIcon,
  "/settings/devices": SmartphoneIcon,
  "/settings/scheduled-tasks": CalendarClockIcon,
  "/settings/source-control": GitBranchIcon,
  "/settings/worktrees": FolderTreeIcon,
  "/settings/connections": ServerIcon,
  "/settings/access": ShieldCheckIcon,
  "/settings/secrets": KeyRoundIcon,
  "/settings/maintenance": WrenchIcon,
  "/settings/labs": FlaskConicalIcon,
  "/settings/about": InfoIcon,
  "/settings/archived": ArchiveIcon,
};

// Detail pages without a nav entry highlight the page that links to them.
const SETTINGS_DETAIL_PAGE_PARENTS: Readonly<Record<string, SettingsPath>> = {
  "/settings/diagnostics": "/settings/maintenance",
  "/settings/open-source-licenses": "/settings/about",
};

// Attached only to the highlighted result, so it runs whenever the highlight lands on a row.
function scrollResultIntoView(row: HTMLElement | null) {
  row?.scrollIntoView({ block: "nearest" });
}

function SettingsSectionIcon({ to }: { to: SettingsPath }) {
  const Icon = SETTINGS_SECTION_ICONS[to];
  return <Icon className="size-4 h-5 shrink-0 text-(--sidebar-icon-color)" />;
}

export function SettingsSidebarNav({
  pathname,
  compactOpen,
  onRequestSearch,
  onChoose,
}: {
  pathname: string;
  compactOpen: boolean;
  onRequestSearch: () => void;
  onChoose: () => void;
}) {
  const gt = useGT();
  const m = useMessages();
  const navArea = workspaceAreaProps("settings-nav", 0, gt("Settings sections"));
  const navigate = useNavigate();
  const currentHash = useLocation({ select: (location) => location.hash });
  const activePath = SETTINGS_DETAIL_PAGE_PARENTS[pathname] ?? pathname;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const searchableItems = useAvailableSettingsSearchItems();
  const navGroups = settingsNavGroups(useHasSecretProvidersEnvironment());
  const results = searchSettings(query, searchableItems, m);
  const isSearching = query.trim().length > 0;
  const hasResults = results.length > 0;
  const maxResultIndex = Math.max(results.length - 1, 0);
  // Persist the clamp so a shrink-then-recover of results keeps the clamped highlight.
  if (activeResultIndex > maxResultIndex) {
    setActiveResultIndex(maxResultIndex);
  }

  // oxlint-disable-next-line cod3/no-unreasoned-state-sync -- window keydown listener for the find and slash search shortcuts
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const eventKeys = resolveEventKeys(event);
      const isFindShortcut =
        eventKeys.has("f") && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
      // Shift is allowed only when the layout types "/" with it (German Shift+7); Shift on
      // the physical Slash key types "?" or "," instead.
      const isSlashShortcut =
        eventKeys.has("/") &&
        (event.key === "/" || !event.shiftKey) &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey;
      if (!isFindShortcut && !isSlashShortcut) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        ((isSlashShortcut &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)) ||
          target.closest(
            '[role="dialog"]:not([data-app-modal]), [aria-modal="true"]:not([data-app-modal]), [data-slot$="popup"]:not([data-app-modal]), [data-keybinding-capture]',
          ) !== null)
      ) {
        return;
      }

      event.preventDefault();
      flushSync(onRequestSearch);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRequestSearch]);

  const handleSectionClick = (to: SettingsPath) => {
    onChoose();
    void navigate({
      to,
      hash: "",
      replace: true,
      hashScrollIntoView: false,
    });
  };

  const clearSearch = () => {
    setQuery("");
    setActiveResultIndex(0);
  };
  const handleSearchResultClick = (item: SettingsSearchItem) => {
    clearSearch();
    if (compactOpen) flushSync(onChoose);
    const targetId = item.targetId ?? item.id;
    revealSettingsSearchTarget(targetId);
    if (pathname === item.to && currentHash.replace(/^#/, "") === targetId) {
      scrollToSettingsTarget(targetId);
      return;
    }
    void navigate({
      to: item.to,
      hash: targetId,
      replace: true,
      hashScrollIntoView: false,
      state: { settingsTargetHighlight: true },
    });
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape" && isSearching) {
      event.preventDefault();
      event.stopPropagation();
      clearSearch();
      return;
    }
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResultIndex((activeResultIndex + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResultIndex((activeResultIndex - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const result = results[activeResultIndex];
      if (result) handleSearchResultClick(result);
    }
  };

  return (
    <nav
      {...navArea}
      role="navigation"
      id="settings-sections"
      className={cn(
        "col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col bg-sidebar text-sidebar-foreground md:row-span-2 md:row-start-1 md:border-e",
        !compactOpen && "max-md:hidden",
      )}
    >
      <div className="hidden h-16 shrink-0 items-center gap-2.5 px-5 md:flex">
        <span className="grid size-8 place-items-center rounded-lg border border-sidebar-border bg-background text-sidebar-foreground">
          <Settings2Icon aria-hidden className="size-4" />
        </span>
        <span className="text-lg font-semibold tracking-tight">{gt("Settings")}</span>
      </div>
      <div className="px-3 py-3 md:pt-0">
        <InputGroup role="presentation">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          {/* Native search inputs clear on Escape even during IME composition. */}
          <InputGroupInput
            ref={searchInputRef}
            nativeInput
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveResultIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder={gt("Search settings")}
            aria-label={gt("Search settings")}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isSearching && hasResults}
            aria-controls={isSearching && hasResults ? "settings-search-results" : undefined}
            aria-activedescendant={
              isSearching && results[activeResultIndex]
                ? `settings-search-result-${results[activeResultIndex].id}`
                : undefined
            }
          />
          <InputGroupAddon align="inline-end">
            {isSearching ? (
              <Button
                type="button"
                size="icon-micro"
                variant="ghost-muted"
                className="shrink-0"
                aria-label={gt("Clear settings search")}
                onClick={() => {
                  clearSearch();
                  searchInputRef.current?.focus();
                }}
              >
                <XIcon className="size-3" />
              </Button>
            ) : (
              <span className="max-md:hidden">
                <Kbd>/</Kbd>
              </span>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
      <SidebarContent>
        <div className="px-3 pt-1 pb-4">
          {isSearching && results.length === 0 ? (
            <p
              role="status"
              className="px-2 py-6 text-center text-xs text-sidebar-muted-foreground"
            >
              <T>No settings found</T>
            </p>
          ) : null}
          {isSearching ? (
            <SidebarMenu
              id={hasResults ? "settings-search-results" : undefined}
              role={hasResults ? "listbox" : undefined}
              aria-label={hasResults ? gt("Settings search results") : undefined}
            >
              {results.map((item, index) => (
                <SidebarMenuItem
                  key={item.id}
                  role="presentation"
                  ref={index === activeResultIndex ? scrollResultIntoView : undefined}
                >
                  <SidebarMenuButton
                    id={`settings-search-result-${item.id}`}
                    role="option"
                    aria-selected={index === activeResultIndex}
                    tabIndex={-1}
                    size="sm"
                    isActive={index === activeResultIndex}
                    className="h-auto min-h-11 items-center"
                    onMouseMove={() => setActiveResultIndex(index)}
                    onClick={() => handleSearchResultClick(item)}
                  >
                    <SettingsSectionIcon to={item.to} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug font-medium text-sidebar-foreground">
                        {m(item.title)}
                      </span>
                      <span className="block truncate text-xs text-sidebar-muted-foreground">
                        {m(SETTINGS_SECTION_LABELS[item.to])}
                      </span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          ) : (
            <div onKeyDown={handleSettingsSectionKeyDown} className="flex flex-col gap-4">
              {navGroups.map((group, index) => (
                <div key={group.heading} className="flex flex-col gap-1">
                  <h3
                    id={`settings-nav-group-${index}`}
                    className="px-2 text-xs font-semibold text-sidebar-muted-foreground"
                  >
                    {m(group.heading)}
                  </h3>
                  {/* The heading stays outside the group it names so NVDA does not read the name twice. */}
                  <div role="group" aria-labelledby={`settings-nav-group-${index}`}>
                    <SidebarMenu>
                      {group.paths.map((to) => {
                        const Icon = SETTINGS_SECTION_ICONS[to];
                        const isActive = activePath === to || activePath.startsWith(`${to}/`);
                        return (
                          <SidebarMenuItem key={to}>
                            <SidebarMenuButton
                              variant="navigation"
                              className="max-md:min-h-11"
                              data-settings-section={to}
                              aria-current={isActive ? "page" : undefined}
                              isActive={isActive}
                              onClick={() => handleSectionClick(to)}
                            >
                              <Icon aria-hidden />
                              <span className="min-w-0 flex-1 truncate">
                                {m(SETTINGS_NAV_LABELS[to])}
                              </span>
                              {isActive ? (
                                <span
                                  aria-hidden
                                  className="absolute start-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                                />
                              ) : null}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <Suspense fallback={null}>
          <Cod3ConnectSidebarSignIn />
        </Suspense>
        <Suspense fallback={null}>
          <Cod3ConnectSidebarAvatar />
        </Suspense>
      </SidebarFooter>
    </nav>
  );
}
