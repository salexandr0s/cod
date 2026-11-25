import { UserButton, useAuth } from "@clerk/react";
import { T, useMessages } from "gt-react";
import { LogInIcon, RotateCwIcon } from "lucide-react";

import { hasCloudPublicConfig } from "../../cloud/publicConfig";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { retryClerkLoad, useClerkLoadFailed } from "./clerkLoadFailure";
import { COD3_CONNECT_ACCOUNT_PAGES } from "./Cod3ConnectAccountPages";
import { useCod3ConnectAuthPrompt } from "./useCod3ConnectAuthPrompt";

export function Cod3ConnectSidebarSignIn() {
  if (!hasCloudPublicConfig()) return null;

  return <ConfiguredCod3ConnectSidebarSignIn />;
}

export function Cod3ConnectSidebarAvatar() {
  if (!hasCloudPublicConfig()) return null;

  return <ConfiguredCod3ConnectSidebarAvatar />;
}

function ConfiguredCod3ConnectSidebarAvatar() {
  const { isLoaded, isSignedIn } = useAuth();
  const m = useMessages();

  if (!isLoaded || !isSignedIn) return null;

  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: "size-7",
          // Clerk's unlayered trigger reset (padding, radius, background) beats layered utilities.
          userButtonTrigger: "mb-1! rounded-lg! p-1! hover:bg-sidebar-row-hover!",
        },
      }}
    >
      {COD3_CONNECT_ACCOUNT_PAGES.map((page) => (
        <UserButton.UserProfilePage
          key={page.url}
          label={m(page.label)}
          labelIcon={page.icon}
          url={page.url}
        >
          {page.content}
        </UserButton.UserProfilePage>
      ))}
    </UserButton>
  );
}

function ConfiguredCod3ConnectSidebarSignIn() {
  const { isLoaded, isSignedIn } = useAuth();
  const loadFailed = useClerkLoadFailed();
  const { openAuthPrompt } = useCod3ConnectAuthPrompt();

  if (loadFailed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={retryClerkLoad}>
            <RotateCwIcon />
            <span>
              <T>Retry cod3 Connect</T>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }
  if (!isLoaded || isSignedIn) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={openAuthPrompt}>
          <LogInIcon />
          <span>
            <T>Sign in to cod3 Connect</T>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
