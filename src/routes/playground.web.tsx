import { createFileRoute } from "@tanstack/react-router";
import { IdePlayground } from "./playground.ide";

export const Route = createFileRoute("/playground/web")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Web Playground · HTML, CSS & JS live preview" },
      { name: "description", content: "Build and preview HTML/CSS/JS projects with a mobile-first IDE: multi-file projects, live preview, console, and AI assistance." },
    ],
  }),
  component: () => (
    <IdePlayground
      defaultKind="web"
      defaultProjectName="My Web Project"
      storageKey="playground-ide:web"
      track="web"
    />
  ),
});
