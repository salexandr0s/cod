import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { Cod3ProjectFile, COD3_PROJECT_FILE_SCHEMA_URL } from "@cod3/contracts";

import { fromLenientJson } from "./schemaJson.ts";

export const Cod3ProjectFileFromJson = fromLenientJson(Cod3ProjectFile);

const decodeCod3ProjectFile = Schema.decodeExit(Cod3ProjectFileFromJson);

export function parseCod3ProjectFile(contents: string): Cod3ProjectFile | null {
  const decoded = decodeCod3ProjectFile(contents);
  return Exit.isSuccess(decoded) ? decoded.value : null;
}

export function buildCod3ProjectFileJsonSchema(): Record<string, unknown> {
  const document = Schema.toJsonSchemaDocument(Cod3ProjectFile, { onExcessProperty: "error" });
  const jsonSchema: Record<string, unknown> = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: COD3_PROJECT_FILE_SCHEMA_URL,
    ...document.schema,
  };
  if (document.definitions && Object.keys(document.definitions).length > 0) {
    jsonSchema.$defs = document.definitions;
  }
  return jsonSchema;
}
