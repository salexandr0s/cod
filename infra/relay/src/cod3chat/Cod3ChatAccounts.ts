import { createClerkClient } from "@clerk/backend";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Base64Url from "effect/encoding/Base64Url";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { RelayCod3ChatLink } from "@cod3/contracts/relay";

import * as RelayConfiguration from "../Config.ts";

const LINK_TOKEN_TTL_SECONDS = 10 * 60;
const COD3CHAT_REQUEST_TIMEOUT = "5 seconds";

const decodeLinkResponse = Schema.decodeUnknownEffect(
  Schema.Struct({ link: Schema.NullOr(RelayCod3ChatLink) }),
);

export class Cod3ChatNotConfigured extends Schema.TaggedError<Cod3ChatNotConfigured>()(
  "Cod3ChatNotConfigured",
  {},
) {
  override get message(): string {
    return "T3 Chat linking is not configured on this relay";
  }
}

export class ClerkUserLookupFailed extends Schema.TaggedError<ClerkUserLookupFailed>()(
  "ClerkUserLookupFailed",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not read the Clerk user's primary email";
  }
}

export class Cod3ChatRequestFailed extends Schema.TaggedError<Cod3ChatRequestFailed>()(
  "Cod3ChatRequestFailed",
  {
    operation: Schema.Literals(["get-link", "unlink"]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `T3 Chat '${this.operation}' request failed`;
  }
}

/**
 * Bridge to T3 Chat. T3 Chat owns the account link; the relay
 * signs link requests and asks T3 Chat for the linked account's plan.
 */
export class Cod3ChatAccounts extends Context.Service<
  Cod3ChatAccounts,
  {
    readonly available: boolean;
    readonly createLinkUrl: (input: {
      readonly userId: string;
    }) => Effect.Effect<string, Cod3ChatNotConfigured | ClerkUserLookupFailed>;
    readonly getLink: (input: {
      readonly userId: string;
    }) => Effect.Effect<RelayCod3ChatLink | null, Cod3ChatNotConfigured | Cod3ChatRequestFailed>;
    readonly unlink: (input: {
      readonly userId: string;
    }) => Effect.Effect<void, Cod3ChatNotConfigured | Cod3ChatRequestFailed>;
  }
>()("cod3-relay/cod3chat/Cod3ChatAccounts") {}

/** Token format shared with T3 Chat: `<base64url JSON payload>.<base64url HMAC-SHA256>`. */
export const signLinkToken = (
  secret: string,
  payload: { readonly sub: string; readonly email: string; readonly exp: number },
) => {
  const encoded = Base64Url.encode(JSON.stringify({ v: 1, ...payload }));
  const signature = hmac(
    sha256,
    new TextEncoder().encode(secret),
    new TextEncoder().encode(encoded),
  );
  return `${encoded}.${Base64Url.encode(signature)}`;
};

export const make = Effect.gen(function* () {
  const config = yield* RelayConfiguration.RelayConfiguration;
  const client = yield* HttpClient.HttpClient;
  const settings = config.cod3Chat;

  const requireSettings = settings
    ? Effect.succeed(settings)
    : Effect.fail(new Cod3ChatNotConfigured());

  // The timeout covers the body read so a stalled response still fails fast.
  const post = Effect.fn("relay.cod3chat.post")(function* (
    operation: Cod3ChatRequestFailed["operation"],
    path: string,
    userId: string,
  ) {
    const { baseUrl, linkSecret } = yield* requireSettings;
    return yield* HttpClientRequest.post(new URL(path, baseUrl).toString()).pipe(
      HttpClientRequest.bearerToken(Redacted.value(linkSecret)),
      HttpClientRequest.bodyJsonUnsafe({ clerkUserId: userId }),
      client.execute,
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((response) => response.json),
      Effect.timeout(COD3CHAT_REQUEST_TIMEOUT),
      Effect.mapError((cause) => new Cod3ChatRequestFailed({ operation, cause })),
    );
  });

  const lookupClerkPrimaryEmail = Effect.fn("relay.cod3chat.lookup_clerk_primary_email")(function* (
    userId: string,
  ) {
    return yield* Effect.tryPromise({
      try: async () => {
        const user = await createClerkClient({
          secretKey: Redacted.value(config.clerkSecretKey),
          publishableKey: config.clerkPublishableKey,
        }).users.getUser(userId);
        const email = user.primaryEmailAddress?.emailAddress;
        if (!email) throw new Error("Clerk user has no primary email address.");
        return email;
      },
      catch: (cause) => new ClerkUserLookupFailed({ cause }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: COD3CHAT_REQUEST_TIMEOUT,
        orElse: () => Effect.fail(new ClerkUserLookupFailed({ cause: "timed out" })),
      }),
    );
  });

  return Cod3ChatAccounts.of({
    available: settings !== undefined,
    createLinkUrl: Effect.fn("relay.cod3chat.create_link_url")(function* (input) {
      const { baseUrl, linkSecret } = yield* requireSettings;
      const email = yield* lookupClerkPrimaryEmail(input.userId);
      const now = yield* DateTime.now;
      const token = signLinkToken(Redacted.value(linkSecret), {
        sub: input.userId,
        email,
        exp: Math.floor(now.epochMilliseconds / 1_000) + LINK_TOKEN_TTL_SECONDS,
      });
      const url = new URL("/link/cod3", baseUrl);
      url.searchParams.set("token", token);
      return url.toString();
    }),
    getLink: Effect.fn("relay.cod3chat.get_link")(function* (input) {
      const body = yield* post("get-link", "/api/cod3/link", input.userId);
      const decoded = yield* decodeLinkResponse(body).pipe(
        Effect.mapError((cause) => new Cod3ChatRequestFailed({ operation: "get-link", cause })),
      );
      return decoded.link;
    }),
    unlink: Effect.fn("relay.cod3chat.unlink")(function* (input) {
      yield* post("unlink", "/api/cod3/unlink", input.userId);
    }),
  });
});

export const layer = Layer.effect(Cod3ChatAccounts, make);
