import type { APIRoute } from "astro";

import { buildCod3ProjectFileJsonSchema } from "@cod3/shared/cod3ProjectFile";

export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(buildCod3ProjectFileJsonSchema(), null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
