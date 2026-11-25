import type { APIRoute } from "astro";

import { GITHUB_REPOSITORY_URL, MOBILE_SETUP_URL } from "../lib/site";
import { absoluteUrl, SITE_TAGLINE } from "../lib/seo";

// https://llmstxt.org: a plain index that tells AI agents which domain and links are official.
export const GET: APIRoute = () => {
  const body = `# cod3

> ${SITE_TAGLINE}. cod3 is a free, MIT-licensed fork of T3 Code. It runs Claude Code, Codex, Cursor, OpenCode, Grok, Antigravity, and other coding agents from one desktop, web, and mobile app.

The repository provides source code, build instructions, and releases for cod3.

## Official links

- [Download cod3](${absoluteUrl("/download")}): macOS, Windows, and Linux installers
- [Run the web app](${GITHUB_REPOSITORY_URL}#install)
- [Source code](${GITHUB_REPOSITORY_URL}): the MIT-licensed repository
- [Releases](${GITHUB_REPOSITORY_URL}/releases): release builds and changelogs
- [iOS app](${MOBILE_SETUP_URL})
- [Android app](${MOBILE_SETUP_URL})

## Upstream service policies

- [Security policy](${absoluteUrl("/security-policy")})
- [Privacy policy](${absoluteUrl("/privacy-policy")})
- [Terms of service](${absoluteUrl("/terms-of-service")})
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
