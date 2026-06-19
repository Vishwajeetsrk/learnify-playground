import { createFileRoute } from "@tanstack/react-router";
import { IdePlayground } from "./playground.ide";

export const Route = createFileRoute("/playground/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Code Playground · Run Python, Node, Java & more" },
      { name: "description", content: "A fast mobile-first code playground with Monaco editor, multi-language runners, console output, and AI debugging." },
    ],
  }),
  component: () => (
    <IdePlayground
      defaultKind="code"
      defaultLanguage="python"
      defaultProjectName="My Code Project"
      storageKey="playground-ide:code"
    />
  ),
});
