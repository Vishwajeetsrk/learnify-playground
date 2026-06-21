## Goal
Ship 5 connected improvements: richer pre-check info in errors, full mobile responsiveness audit, persistent debug log table, end-to-end `runId` tracing, and Copy/Replay buttons in the AI panel.

## 1. Pre-check details surfaced in the error panel

**Server** (`src/lib/ai.functions.ts`)
- Change `hasEndpoints()` → `probeEndpoints(model, key)` that returns `{ available: boolean; providers: string[]; status: number }`.
- Attach the probe result to each entry in the `attempts[]` array (e.g. `{ model, ok, ms, providers, error }`).
- On final failure, include attempts (with providers) in the thrown error message AND in the structured response shape.

**Client** (`src/components/ai-debug-panel.tsx`)
- Error panel renders a compact table: model · status · providers (or "no endpoints") · latency.
- Highlights which model finally succeeded vs. which were skipped.

## 2. Mobile / responsive audit

Scope: site nav, landing (`src/routes/index.tsx`), playground shells, IDE layout, AI debug panel, contributors section, dialogs.

Concrete fixes:
- `site-nav.tsx`: collapse star counter + Follow + Star into icon-only buttons under `sm`, wrap inside `grid-cols-[minmax(0,1fr)_auto]`.
- `index.tsx` hero + CTA section: stack on mobile, single-column contributors grid → 2 cols sm → 4 cols md.
- `playground.ide.tsx` / IDE chrome: convert horizontal toolbars to wrap + scroll-x with `min-w-0`; ensure editor and preview stack vertically below `md`.
- `ai-debug-panel.tsx`: action chips already wrap; ensure input + button stack on `<sm` (`flex-col sm:flex-row`).
- Add `truncate`/`min-w-0` to all heading rows.
- Confirm dialogs (`byo-key-button`) use `sm:max-w-md` and full-width on mobile.

No new design tokens; reuse existing semantic tokens.

## 3. Supabase table `ai_debug_events`

Migration creates:
```
ai_debug_events (
  id uuid pk,
  user_id uuid not null,         -- auth.uid()
  run_id text not null,
  language text,
  executor text,
  exit_code int,
  key_source text,               -- 'user-byo' | 'env'
  success boolean not null,
  final_model text,
  attempts jsonb not null,       -- [{model, ok, ms, providers, error}]
  error text,                    -- redacted message if failed
  code_bytes int, stderr_bytes int, reply_bytes int,
  created_at timestamptz default now()
)
```
- GRANTs to `authenticated` + `service_role`.
- RLS: users can SELECT/INSERT/DELETE own rows; admins (via existing `has_role` if present, else owner-only) can read all — owner-only for now since no role table exists.
- Server fn inserts after each call, using the request bearer (`requireSupabaseAuth`). If unauthenticated, skip insert silently.
- Never store `code`, `stdin`, `stdout`, `stderr` content or the API key — only sizes + redacted summaries.

## 4. End-to-end `runId`

- Server already generates `reqId` → rename to `runId` everywhere and return it in success and error payloads.
- AI panel: store `lastRunId` in state; show it as a small monospace badge in the panel header and in the error card.
- Console: continue using `[ai/debug]` structured logs with `runId`.

## 5. Copy debug info + Replay last request

In `ai-debug-panel.tsx`:
- Keep `lastRequest` (the exact `data` payload sent) and `lastResponse|lastError` + `attempts` + `runId` in state.
- **Copy debug info**: writes a JSON blob (runId, language, executor, exitCode, attempts, error, model, key source — NOT the code body or key) to the clipboard via `navigator.clipboard.writeText`.
- **Replay**: re-invokes `ask({ data: lastRequest })` with the same payload, preserving prior state.
- Both buttons live in the error panel and (Copy only) next to the success reply.

## Out of scope
- Admin dashboard UI for `ai_debug_events` (table only; can be built later).
- Web Playground AI panel — same hooks already, but only the code-IDE panel gets the new UI in this pass; the web panel can mirror later if you want.

## Order of operations
1. Migration for `ai_debug_events` (needs approval before code that writes to it).
2. Server fn: rename `reqId`→`runId`, add `providers` to attempts, return `runId`+`attempts` always.
3. AI panel: error table, runId badge, Copy + Replay.
4. Responsive pass across nav, landing, IDE, dialogs.
