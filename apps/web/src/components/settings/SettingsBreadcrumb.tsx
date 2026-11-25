import { msg, useGT, useMessages } from "gt-react";

import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { SETTINGS_SECTION_LABELS } from "./settingsSearch";

const SETTINGS_LABEL = msg("Settings");

const SETTINGS_BREADCRUMB_LABELS: Readonly<Record<string, string>> = {
  ...SETTINGS_SECTION_LABELS,
  "/settings/diagnostics": msg("Diagnostics"),
  "/settings/open-source-licenses": msg("Open source licenses"),
};

function settingsBreadcrumbLabel(pathname: string): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  return SETTINGS_BREADCRUMB_LABELS[normalizedPathname] ?? null;
}

export function SettingsBreadcrumb({ pathname }: { pathname: string }) {
  const gt = useGT();
  const m = useMessages();
  const sectionLabel = settingsBreadcrumbLabel(pathname);

  return (
    <WorkspaceBreadcrumb ariaLabel={gt("Settings breadcrumb")}>
      {sectionLabel ? (
        <WorkspaceBreadcrumbItem className="sr-only">{m(SETTINGS_LABEL)}</WorkspaceBreadcrumbItem>
      ) : null}
      <WorkspaceBreadcrumbItem current className="truncate">
        <h1 className="truncate text-lg font-semibold tracking-tight md:text-2xl">
          {m(sectionLabel ?? SETTINGS_LABEL)}
        </h1>
      </WorkspaceBreadcrumbItem>
    </WorkspaceBreadcrumb>
  );
}
