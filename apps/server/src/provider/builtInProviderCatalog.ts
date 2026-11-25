import type { ProviderDriverKind, ProviderInstanceId, ServerProvider } from "@cod3/contracts";
import type * as Stream from "effect/Stream";
import type { ManagedServerProvider } from "@cod3/provider-core/server/snapshot";

export type ProviderSnapshotSource = {
  readonly instanceId: ProviderInstanceId;
  readonly driverKind: ProviderDriverKind;
  readonly getSnapshot: ManagedServerProvider["getSnapshot"];
  readonly refresh: ManagedServerProvider["refresh"];
  readonly streamChanges: Stream.Stream<ServerProvider>;
};
