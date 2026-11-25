import { assert, describe, it } from "@effect/vitest";

import {
  COD3_DEVICE_TOOL_INSTRUCTIONS,
  COD3_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH,
  COD3_ORCHESTRATION_INSTRUCTIONS,
  cod3AcpPromptWithInstructions,
  cod3OrchestrationPrompt,
  cod3OrchestrationSystemPrompt,
} from "./orchestrationInstructions.ts";

describe("cod3 device instructions", () => {
  it("route device work through device_open and give Claude the line that loads the tools", () => {
    for (const intent of ["`device_list`", "`device_open`", "`agent-device`", "ssh", "`hostId`"]) {
      assert.include(COD3_DEVICE_TOOL_INSTRUCTIONS, intent);
    }
    assert.notInclude(COD3_DEVICE_TOOL_INSTRUCTIONS, "ToolSearch");
    const loadLine =
      " Load them with ToolSearch `select:mcp__cod3__device_list,mcp__cod3__device_open,mcp__cod3__device_screenshot,mcp__cod3__device_close`.";
    assert.include(COD3_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH, loadLine);
    assert.equal(
      COD3_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH.replace(loadLine, ""),
      COD3_DEVICE_TOOL_INSTRUCTIONS,
    );
  });

  it("open the app before the returned command's snapshots, screenshots and input", () => {
    assert.include(
      COD3_DEVICE_TOOL_INSTRUCTIONS,
      "its snapshots, screenshots and input need `open <app>` first,",
    );
  });

  it("keep the failure rule from taking over or closing a session another thread holds", () => {
    // agent-device's DEVICE_IN_USE advice is to rerun with the owner's --session or close it first.
    assert.include(
      COD3_DEVICE_TOOL_INSTRUCTIONS,
      "follow its advice once, but never reuse or close another session; if it still fails,",
    );
  });

  it("reach OpenCode and Cursor only when the session holds device access", () => {
    assert.include(cod3OrchestrationSystemPrompt(true, true), COD3_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(cod3OrchestrationSystemPrompt(true, false), "## cod3 devices");
    assert.isUndefined(cod3OrchestrationSystemPrompt(false, true));

    const firstRun = (hasDeviceTools: boolean) =>
      cod3OrchestrationPrompt({
        prompt: "Check the login screen.",
        hasCod3Mcp: true,
        hasDeviceTools,
        orchestrationDelivered: false,
        deviceInstructionsDelivered: false,
      });
    assert.include(firstRun(true), COD3_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(firstRun(false), "## cod3 devices");

    const laterRun = (deviceInstructionsDelivered: boolean) =>
      cod3OrchestrationPrompt({
        prompt: "Check the login screen.",
        hasCod3Mcp: true,
        hasDeviceTools: true,
        orchestrationDelivered: true,
        deviceInstructionsDelivered,
      });
    assert.include(laterRun(false), COD3_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(laterRun(false), COD3_ORCHESTRATION_INSTRUCTIONS.trim());
    assert.equal(laterRun(true), "Check the login screen.");

    // A provider's own guidance reaches a conversation that already had the rest.
    const providerRun = (providerInstructionsDelivered: boolean) =>
      cod3OrchestrationPrompt({
        prompt: "Check the login screen.",
        hasCod3Mcp: true,
        hasDeviceTools: false,
        orchestrationDelivered: true,
        deviceInstructionsDelivered: false,
        providerInstructions: "Mark awaited shells.",
        providerInstructionsDelivered,
      });
    assert.include(providerRun(false), "Mark awaited shells.");
    assert.notInclude(providerRun(false), COD3_ORCHESTRATION_INSTRUCTIONS.trim());
    assert.equal(providerRun(true), "Check the login screen.");
  });

  it("reach ACP agents again when device access changes mid-thread", () => {
    const state = { interactionMode: "default", hasCod3Mcp: true, hasDeviceTools: false } as const;
    const withDevices = cod3AcpPromptWithInstructions({
      prompt: "Check the login screen.",
      state: { ...state, hasDeviceTools: true },
      previousState: state,
    });
    assert.include(withDevices, COD3_DEVICE_TOOL_INSTRUCTIONS);
    assert.equal(
      cod3AcpPromptWithInstructions({ prompt: "Again.", state, previousState: state }),
      "Again.",
    );
    assert.notInclude(cod3AcpPromptWithInstructions({ prompt: "Hi.", state }), "## cod3 devices");
  });
});
