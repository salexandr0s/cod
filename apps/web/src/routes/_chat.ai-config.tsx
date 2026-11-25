import { createFileRoute } from "@tanstack/react-router";
import { AiConfigPage } from "../components/aiConfig/AiConfigPage";

export const Route = createFileRoute("/_chat/ai-config")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): { project?: string; file?: string; anchor?: string } => ({
    ...(typeof raw.project === "string" && raw.project ? { project: raw.project } : {}),
    ...(typeof raw.anchor === "string" && raw.anchor.startsWith("#") ? { anchor: raw.anchor } : {}),
    ...(typeof raw.file === "string" && raw.file ? { file: raw.file } : {}),
  }),
  component: AiConfigPage,
});
