import { assert, it } from "@effect/vitest";

import {
  repositoryPathFromRemoteUrl,
  transportSafeSourceControlErrorValue,
} from "./SourceControlProvider.ts";

it("removes URL credentials, query parameters, and fragments from error transport values", () => {
  assert.strictEqual(
    transportSafeSourceControlErrorValue(
      "https://user:secret@example.test/org/repo/pull/42?token=secret#discussion",
    ),
    "https://example.test/org/repo/pull/42",
  );
});

it.each([
  ["git@github.com:Cod3Tools/cod3.git", "Cod3Tools/cod3"],
  ["github.com:Cod3Tools/cod3.git", "Cod3Tools/cod3"],
  ["gitlab.com:Cod3Tools/platform/cod3", "Cod3Tools/platform/cod3"],
  ["https://github.com/Cod3Tools/cod3.git", "Cod3Tools/cod3"],
  ["https://github.com/Cod3Tools/cod3.git?view=compact", "Cod3Tools/cod3"],
  ["https://github.com/Cod3Tools/cod3.git#section", "Cod3Tools/cod3"],
  ["C:/repos/cod3", null],
])("reads the repository path of %s", (remoteUrl, expected) => {
  assert.strictEqual(repositoryPathFromRemoteUrl(remoteUrl), expected);
});
