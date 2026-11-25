import { AgentFeedbackKind, AgentFeedbackTrace } from "@cod3/contracts";
import { resolveCod3McpToolId } from "@cod3/shared/cod3McpToolPresentation";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

// Code points, as the scrubber caps them, so a valid input stays a valid report after redaction.
const FeedbackText = Schema.String.check(Schema.isMaxCodePoints(300));

/** Turns the outline of a requested report covers at least. */
export const FEEDBACK_TRACE_TURNS = 5;

const reportFields = {
  kind: AgentFeedbackKind,
  subject: Schema.String.annotate({ description: "cod3 tool name, `cod3` command, or `general`." }),
  expected: FeedbackText,
  actual: FeedbackText,
  workaround: FeedbackText.annotate({ description: "What you did instead, or empty." }),
  // Annotate before the default: an annotation after it never reaches the JSON schema.
  userRequested: Schema.Boolean.annotate({ description: "The user asked for this report." }).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
  ),
};

export const FeedbackInput = Schema.Struct({
  ...reportFields,
  turns: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))
    .annotate({
      description: "How many recent turns, counting this one, the problem spans.",
    })
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
});

export const FeedbackTrace = AgentFeedbackTrace;
export type FeedbackTrace = AgentFeedbackTrace;

const storedFields = {
  id: Schema.String,
  threadId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  source: Schema.Literals(["mcp", "cli"]),
  sent: Schema.Boolean,
};

export const FeedbackReport = Schema.Struct({
  ...reportFields,
  ...storedFields,
  trace: Schema.NullOr(FeedbackTrace),
});

/** What `cod3_feedback` answers: the report, with only the size of what its trace attached. */
export const FeedbackSubmitResult = Schema.Struct({
  ...reportFields,
  ...storedFields,
  trace: Schema.NullOr(FeedbackTrace.mapFields(Struct.omit(["entries"]))),
});

export const FEEDBACK_AWAITING_APPROVAL_NOTE =
  "The user sees this report in a card and chooses there whether to send it and whether to include the conversation. Nothing is sent until they do, and you will not learn their choice. Do not wait for it or send it another way. Call again only if the user asks to change it; that shows a new card.";

/** What `cod3_feedback` answers for a requested report: shown to the user, not yet sent. */
export const FeedbackAwaitingApproval = Schema.Struct({
  status: Schema.Literal("awaiting_approval"),
  note: Schema.String,
});
export type FeedbackAwaitingApproval = typeof FeedbackAwaitingApproval.Type;

export const FEEDBACK_OFF_MESSAGE =
  "Agent feedback is off. Turn it on in cod3 under Settings > Labs, then try again.";

export class FeedbackOffError extends Schema.TaggedError<FeedbackOffError>()(
  "FeedbackOffError",
  {},
) {
  override get message() {
    return FEEDBACK_OFF_MESSAGE;
  }
}

export type FeedbackSource = "mcp" | "cli";

// Requested reports count when their card is shown, unprompted ones when stored.
export const MAX_REPORTS_PER_TURN = 3;
// Reports from no turn, such as `cod3 feedback`, have no turn to count in.
export const MAX_REPORTS_OUTSIDE_TURNS_PER_HOUR = 10;

export class FeedbackLimitError extends Schema.TaggedError<FeedbackLimitError>()(
  "FeedbackLimitError",
  { scope: Schema.Literals(["turn", "hour", "cards"]) },
) {
  override get message() {
    switch (this.scope) {
      case "turn":
        return `This turn already sent ${MAX_REPORTS_PER_TURN} agent feedback reports; nothing was sent.`;
      case "cards":
        return `This turn already showed the user ${MAX_REPORTS_PER_TURN} agent feedback reports to approve; nothing was shown.`;
      case "hour":
        return `This machine already sent ${MAX_REPORTS_OUTSIDE_TURNS_PER_HOUR} agent feedback reports outside a turn in the last hour; nothing was sent.`;
    }
  }
}

export class FeedbackNotRequestedError extends Schema.TaggedError<FeedbackNotRequestedError>()(
  "FeedbackNotRequestedError",
  { source: Schema.Literals(["mcp", "cli"]) },
) {
  override get message() {
    return this.source === "cli"
      ? "Agent feedback is set to When I ask: ask your agent in a thread to send it, so you can approve what is sent."
      : "Agent feedback is set to When I ask: send a report only when the user asks for one.";
  }
}

export class FeedbackStorageError extends Schema.TaggedError<FeedbackStorageError>()(
  "FeedbackStorageError",
  { cause: Schema.Defect() },
) {
  override get message() {
    return "Could not save agent feedback.";
  }
}

/** The MCP client label `cod3 feedback` signs in with, so its reports count as `cli`. */
export const FEEDBACK_CLI_CLIENT_LABEL = "cod3 feedback cli";

/** Listed `cod3` command paths a report may name. A CLI test keeps this in step with binCli. */
export const COD3_CLI_COMMANDS: ReadonlyArray<string> = [
  "cod3",
  "cod3 help",
  "cod3 serve",
  "cod3 app",
  "cod3 pair",
  "cod3 auth",
  "cod3 auth connect-device",
  "cod3 auth connect-device approve",
  "cod3 auth connect-device list",
  "cod3 auth connect-device revoke",
  "cod3 auth pairing",
  "cod3 auth pairing create",
  "cod3 auth pairing list",
  "cod3 auth pairing revoke",
  "cod3 auth session",
  "cod3 auth session issue",
  "cod3 auth session list",
  "cod3 auth session revoke",
  "cod3 environment",
  "cod3 environment link",
  "cod3 environment list",
  "cod3 environment unlink",
  "cod3 browser",
  "cod3 browser setup",
  "cod3 project",
  "cod3 project add",
  "cod3 project remove",
  "cod3 project rename",
  "cod3 thread",
  "cod3 thread list",
  "cod3 thread start",
  "cod3 thread send",
  "cod3 thread show",
  "cod3 feedback",
  "cod3 feedback list",
  "cod3 workflow",
  "cod3 workflow start",
  "cod3 workflow list",
  "cod3 workflow show",
  "cod3 workflow resume",
  "cod3 workflow cancel",
  "cod3 workflow signal",
  "cod3 workflow questions",
  "cod3 workflow hooks",
  "cod3 workflow store",
  "cod3 workflow store list",
  "cod3 workflow store set",
  "cod3 workflow store delete",
  "cod3 up",
  "cod3 status",
  "cod3 service",
  "cod3 service install",
  "cod3 service restart",
  "cod3 service uninstall",
  "cod3 service status",
  "cod3 service protect",
  "cod3 update",
  "cod3 install",
  "cod3 uninstall",
  "cod3 theme",
  "cod3 theme set",
  "cod3 theme clear",
  "cod3 theme show",
  "cod3 trace",
  "cod3 trace summary",
  "cod3 doctor",
  "cod3 policy",
  "cod3 policy show",
  "cod3 policy check",
  "cod3 policy templates",
  "cod3 policy settings",
  "cod3 triage",
  "cod3 connect",
  "cod3 connect link",
  "cod3 connect login",
  "cod3 connect logout",
  "cod3 connect publish",
  "cod3 connect status",
  "cod3 connect unlink",
];

export type FeedbackInput = typeof FeedbackInput.Type;
export type FeedbackReport = typeof FeedbackReport.Type;

export const FEEDBACK_SUBJECT_MESSAGE =
  "Set subject to the exact cod3 tool name, the cod3 command, or `general`.";

// The shared resolver knows the presented tools; the prefix covers the rest, such as these.
// Codex also registers `cod3-direct` for cod3 tools it keeps out of Code Mode.
const COD3_PREFIX =
  /^(?:mcp__cod3(?:[-_]?code)?(?:[-_]direct)?__|cod3(?:[-_]?code)?(?:[-_]direct)?[.:/])/iu;

/** The bare name of a registered cod3 tool however a provider prefixed it, else undefined. */
export const resolveCod3ToolName = (name: string, toolNames: ReadonlyArray<string>) => {
  const tool = resolveCod3McpToolId(name) ?? name.replace(COD3_PREFIX, "");
  if (toolNames.includes(tool)) return tool;
  // OpenCode 2 prefixes tools with `cod3-<thread>_`, underscores and all: the longest name wins.
  if (!/^cod3-/iu.test(name)) return undefined;
  return toolNames
    .filter((candidate) => name.endsWith(`_${candidate}`))
    .toSorted((a, b) => b.length - a.length)[0];
};

/** The stored subject, or undefined when the value names no cod3 tool, `cod3` command, or `general`. */
export const resolveFeedbackSubject = (value: string, toolNames: ReadonlyArray<string>) => {
  const subject = value.trim();
  if (subject === "general" || COD3_CLI_COMMANDS.includes(subject)) return subject;
  return resolveCod3ToolName(subject, toolNames);
};
