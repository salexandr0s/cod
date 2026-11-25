import { describe, expect, it } from "vite-plus/test";

import {
  COD3_MCP_TOOL_NAMES,
  resolveCod3McpSummaryAction,
  resolveCod3McpToolDefinition,
  resolveCod3McpToolPresentation,
} from "./cod3McpToolPresentation.ts";

describe("resolveCod3McpToolPresentation", () => {
  it("recognizes every cod3 tool across provider prefixes and completion suffixes", () => {
    for (const tool of COD3_MCP_TOOL_NAMES) {
      const presentation = resolveCod3McpToolPresentation(tool);
      for (const prefix of [
        "mcp__cod3__",
        "mcp__cod3_code__",
        "mcp__cod3-direct__",
        "cod3-code.",
        "cod3.",
        "cod3-direct.",
        "mcp__cod3_code_direct__",
        "cod3_code/",
        "cod3:",
        "mcp_cod3_",
        "cod3 ",
        "cod3 · ",
      ]) {
        expect(resolveCod3McpToolPresentation(`${prefix}${tool} completed`), tool).toEqual(
          presentation,
        );
      }
      expect(resolveCod3McpToolPresentation(`mcp__another-server__${tool}`), tool).toBeNull();
    }
  });

  it("matches OpenCode 2's per-thread server names, whose thread ids hold underscores", () => {
    expect(
      resolveCod3McpToolPresentation("cod3-thread_opencode2-adapter_delegate_task")?.displayName,
    ).toBe("Delegate a child task");
    expect(resolveCod3McpToolPresentation("cod3-thread_opencode2-adapter_not_a_tool")).toBeNull();
  });
});

describe("resolveCod3McpToolDefinition", () => {
  it("labels an action tool call as the action it ran", () => {
    expect(
      resolveCod3McpToolDefinition("mcp__cod3__preview_act", { action: "type" })?.labels,
    ).toEqual(resolveCod3McpToolDefinition("preview_type")?.labels);
    expect(
      resolveCod3McpToolDefinition("cod3_thread_transfer", { action: "fork" })?.displayName,
    ).toBe(resolveCod3McpToolDefinition("cod3_thread_fork")?.displayName);
    expect(resolveCod3McpToolDefinition("preview_act", { action: "unknown" })?.labels[2]).toBe(
      "Used",
    );
  });
});

describe("resolveCod3McpSummaryAction", () => {
  it("summarizes an action tool by the action each call ran", () => {
    expect(resolveCod3McpSummaryAction("mcp__cod3__cod3_queue", { action: "list" })).toBe(
      "queue-list",
    );
    expect(resolveCod3McpSummaryAction("cod3_queue", { action: "edit" })).toBe("queue-edit");
    expect(resolveCod3McpSummaryAction("cod3_thread_transfer", { action: "status" })).toBe(
      "thread-transfers",
    );
    expect(resolveCod3McpSummaryAction("cod3_thread_configure", {})).toBe("thread-configuration");
    expect(resolveCod3McpSummaryAction("schedule_task", { scheduledTaskId: "task-1" })).toBe(
      "schedule-update",
    );
    expect(resolveCod3McpSummaryAction("delegate_task", { task: "x" })).toBe("delegate");
  });
});
