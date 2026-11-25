import { Discovery } from "@cod3/client-runtime/relay";
import type { EnvironmentId } from "@cod3/contracts";
import { T, useGT, Var } from "gt-react";
import { useState } from "react";

import { useRelayEnvironmentDiscovery } from "../../state/environments";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button, InlineButton } from "../ui/button";
import { useCod3ConnectAccountPage } from "./Cod3ConnectAccountPages";

export function RemoveCod3ConnectEnvironmentDialog({
  environmentLabel,
  environmentId,
  onCancel,
  onConfirm,
}: {
  readonly environmentLabel: string | null;
  readonly environmentId: EnvironmentId | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const accountPage = useCod3ConnectAccountPage();
  const gt = useGT();
  const discovery = useRelayEnvironmentDiscovery();
  const registration = environmentId
    ? Discovery.relayEnvironmentRegistration(discovery, environmentId)
    : "unknown";
  const [shown, setShown] = useState({ label: environmentLabel, registration });
  if (
    environmentLabel !== null &&
    (environmentLabel !== shown.label || registration !== shown.registration)
  ) {
    setShown({ label: environmentLabel, registration });
  }
  const openAccountPage = accountPage.open;
  const accountPageLink = openAccountPage ? (
    <InlineButton
      onClick={() => {
        onCancel();
        openAccountPage();
      }}
    >
      <T>cod3 Connect settings</T>
    </InlineButton>
  ) : (
    gt("cod3 Connect settings")
  );

  return (
    <>
      <AlertDialog
        open={environmentLabel !== null}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <T>
                Remove <Var>{shown.label}</Var> from this device?
              </T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T>This forgets its pairing, credentials, and cached threads here.</T>
            </AlertDialogDescription>
            <AlertDialogDescription>
              {shown.registration === "registered" ? (
                <T>
                  It stays on your cod3 Connect account and keeps its host space. Deregister it in{" "}
                  <Var>{accountPageLink}</Var> to free it.
                </T>
              ) : shown.registration === "unregistered" ? (
                gt("It's no longer on your cod3 Connect account.")
              ) : (
                <T>
                  This doesn't change your cod3 Connect account. To deregister it there, use{" "}
                  <Var>{accountPageLink}</Var>.
                </T>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              <T>Cancel</T>
            </AlertDialogClose>
            <Button variant="destructive" onClick={onConfirm}>
              <T>Remove from this device</T>
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
      {accountPage.portals}
    </>
  );
}
