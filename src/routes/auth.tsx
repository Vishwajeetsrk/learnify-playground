import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Sign in — Playground" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const { redirect } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: redirect ?? "/playground" });
  }, [user, loading, redirect, navigate]);

  async function submit(mode: "in" | "up") {
    setBusy(true);
    const { error } = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success(mode === "in" ? "Welcome back" : "Account created");
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Sign in to save and run your code projects.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="in">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">Sign in</TabsTrigger>
              <TabsTrigger value="up">Create account</TabsTrigger>
            </TabsList>
            {(["in", "up"] as const).map((m) => (
              <TabsContent key={m} value={m} className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`email-${m}`}>Email</Label>
                  <Input id={`email-${m}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pw-${m}`}>Password</Label>
                  <Input id={`pw-${m}`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" disabled={busy || !email || password.length < 6} onClick={() => submit(m)}>
                  {m === "in" ? "Sign in" : "Create account"}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
