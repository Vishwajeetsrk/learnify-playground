import { createFileRoute } from "@tanstack/react-router";
import { IdePlayground } from "./playground.ide";

export const Route = createFileRoute("/playground/mobile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mobile IDE · Code, preview & run on your phone" },
      { name: "description", content: "VS Code-style mobile IDE: write HTML/CSS/JS, Python, Node, Java and more, run code, preview output, and use AI assistance on the go." },
    ],
  }),
  component: () => (
    <IdePlayground
      defaultKind="web"
      defaultProjectName="My Mobile Project"
      storageKey="playground-ide:mobile"
    />
  ),
});
