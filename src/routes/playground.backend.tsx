import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe } from "lucide-react";
import { IdePlayground } from "./playground.ide";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ApiTester } from "@/components/playground/ApiTester";

export const Route = createFileRoute("/playground/backend")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Backend Playground · Write & test APIs" },
      { name: "description", content: "Write Node, Python, PHP, Java, Go, or C# backend snippets, then test any HTTP endpoint with the built-in API tester." },
    ],
  }),
  component: BackendPlaygroundRoute,
});

function BackendPlaygroundRoute() {
  const [apiOpen, setApiOpen] = useState(false);
  return (
    <div className="relative">
      <IdePlayground
        defaultKind="code"
        defaultLanguage="javascript"
        defaultProjectName="My Backend Project"
        storageKey="playground-ide:backend"
        track="backend"
      />
      <Sheet open={apiOpen} onOpenChange={setApiOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-4 right-4 z-40 h-12 rounded-full px-4 shadow-xl"
            style={{ background: "linear-gradient(160deg,#5fd38a,#4f8cff)", color: "#001028" }}
          >
            <Globe className="mr-1" size={16} /> API Tester
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle><Globe className="mr-1 inline" size={14} /> API Tester</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(80vh-3.5rem)]">
            <ApiTester />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
