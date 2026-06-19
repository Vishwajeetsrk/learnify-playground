import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProjectKind = z.enum(["code", "web"]);

const SaveInput = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  kind: ProjectKind.default("web"),
  language: z.string().max(50).optional().default(""),
  code: z.string().max(200_000).optional().default(""),
  html: z.string().max(200_000).optional().default(""),
  css: z.string().max(200_000).optional().default(""),
  js: z.string().max(200_000).optional().default(""),
});

export const listMobileProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("playground_projects")
      .select("id,name,updated_at")
      .eq("kind", "web")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { projects: data ?? [] };
  });

export const loadMobileProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("playground_projects")
      .select("id,name,html,css,js,kind")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found");
    return row;
  });

export const saveMobileProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveInput.parse(i))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("playground_projects")
        .update({
          name: data.name,
          html: data.html,
          css: data.css,
          js: data.js,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select("id,name,updated_at")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("playground_projects")
      .insert({
        user_id: context.userId,
        name: data.name,
        kind: data.kind,
        html: data.html,
        css: data.css,
        js: data.js,
      })
      .select("id,name,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameMobileProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("playground_projects")
      .update({ name: data.name, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMobileProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("playground_projects")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
