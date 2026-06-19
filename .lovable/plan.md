
# Playground Pro — Upgrade Plan

Goal: lift the existing `/playground` (Code, Web, Mobile) to a professional, VS-Code-feel IDE without removing any current functionality. Everything below is additive or a drop-in replacement behind the same UI.

## What stays exactly as-is

- 3 routes/tabs: `/playground/ide` (Code), `/playground/web`, `/playground/mobile` — same URLs, same `IdePlayground` shell.
- Existing templates, file tree, ZIP export, inline rename, asset uploader with progress, share-link, autosave to `localStorage`, AI assistant panels (`AiDebugPanel`, `WebAiDebugPanel`), Wandbox + Piston providers, project-overview preview for Mobile, settings drawer, themes.
- All current keyboard shortcuts, quick-key bar, fullscreen, console panel, output panel.

Anything new is added behind feature flags or new tabs so a regression in one piece can't break the rest.

## Decisions baked in

- **Free-only stack.** Judge0 public CE (`https://ce.judge0.com`, no key, rate-limited) as primary executor; Piston (`emkc.org` or user-set self-hosted URL) as fallback; Wandbox kept as a third option. Auto-route per language to whichever provider supports it (Kotlin/Dart → Piston, Ruby/Bash → Wandbox, etc.).
- **AI assistant stays on Lovable AI Gateway** (`google/gemini-3-flash-preview`) via the existing `debugCode` server fn. OpenRouter is *not* added — it requires a user-supplied key and Lovable AI already covers every requested action (Explain, Fix, Generate, Optimize, Convert, Tests, Docs). If you later want OpenRouter as an additional provider, that's a follow-up.
- **No Android Studio / Xcode pretense.** Mobile tab keeps the project-overview preview and gains a permanent banner with the exact disclaimer text you specified.

## Phase 1 — Execution engine: Judge0 primary, Piston fallback

Files: `src/lib/executors.ts`, new `src/components/playground/ExecutionStats.tsx`.

1. Add a `judge0` provider alongside `wandbox` and `piston`:
   - `POST /submissions?base64_encoded=false&wait=true` against `https://ce.judge0.com`.
   - Static `language_id` map for: Python, Java, C, C++, C#, Go, Rust, PHP, Node.js, TypeScript, Kotlin (matches CE's published IDs).
   - Return `stdout`, `stderr`, `compile_output`, `status.description`, `time` (s), `memory` (KB), `exit_code`.
2. `runCode(lang, src, stdin, provider, opts)`:
   - Default provider becomes `judge0`.
   - Auto-route: if chosen provider lacks the language, transparently switch (current behavior, extended for judge0).
   - `opts.fallback`: judge0 → piston → wandbox chain on transient errors (429/403/5xx).
3. Surface runtime info (`time`, `memory`, `exit code`, `provider used`) under the Output panel via a new `ExecutionStats` strip.
4. Settings drawer gets two new fields: "Judge0 base URL" and "Piston base URL" (already half-wired) so users can point at self-hosted Docker instances. Defaults stay public.

## Phase 2 — Code tab: starter templates + DB consoles

Files: `src/lib/playground/templates.ts`, `src/components/playground/DbConsole.tsx` (exists, extend), new `src/components/playground/PgConsole.tsx`.

1. Verify/add starter `CodeTemplate` for every requested language (Python, Java, C, C++, C#, Go, Rust, PHP, Node.js, TypeScript, Kotlin). Most exist; fill gaps.
2. Database section, accessed from the Code tab toolbar (new `Database` button next to Run):
   - **SQLite** via existing `sqljs` integration — Run Queries, Create/Insert/Update/Delete, result table, "Export CSV".
   - **PostgreSQL** via `@electric-sql/pglite` (WASM, in-browser, no server). New tab inside the DB sheet, same UX as the SQLite console.
   - Both consoles share a query history (localStorage) and a results grid with copy/export.
3. Add `bun add @electric-sql/pglite` (small WASM bundle, lazy-loaded only when the DB sheet opens).

## Phase 3 — Web tab: Sandpack for React, multi-file already done

Files: `src/routes/playground.web.tsx`, `src/lib/playground/templates.ts`, new `src/components/playground/SandpackPreview.tsx`.

1. Keep current HTML/CSS/JS multi-file preview (already aggregates all `.html`/`.css`/`.js` and inlines assets).
2. Add **TypeScript** + **React** as new project kinds inside the Web track:
   - When the active project's entry is `App.tsx` / `index.tsx`, render with `@codesandbox/sandpack-react` instead of the iframe.
   - Sandpack runs entirely in-browser; no backend.
   - Existing Mobile/Tablet/Desktop device frame wraps the Sandpack preview, same controls.
3. New templates (web kind):
   - Portfolio, Landing Page, Dashboard, Blog, Todo App, Calculator (exists), Weather App.
   - One React + TS template per category, plus the current HTML/CSS/JS variants.
4. Auto-refresh + console viewer unchanged (the existing console bridge already captures `console.*`).

## Phase 4 — Mobile tab: snippet execution + new templates + disclaimer

Files: `src/routes/playground.mobile.tsx`, `src/lib/playground/multi-templates.ts`.

1. Permanent info banner at the top of the Mobile preview:
   > "Mobile Playground supports code execution, syntax validation, and learning snippets. Full Android/iOS app rendering requires Android Studio, Xcode, or Flutter SDK."
2. Kotlin / Swift / Dart now actually execute (Phase 1 routes them through Piston). Java was already runnable.
3. Add multi-file templates: Login Screen, Calculator, Notes App, Expense Tracker, Weather App, Profile Screen — one per Kotlin / Swift / Flutter where reasonable. Each loads into the file tree with realistic structure (`MainActivity.kt` + `activity_main.xml`, `ContentView.swift`, `lib/main.dart` + `pubspec.yaml`).
4. AI Explain button is already wired via `AiDebugPanel`; expose it more prominently next to Run on mobile.

## Phase 5 — Editor / UX polish

Files: `src/routes/playground.ide.tsx`, `src/lib/playground/themes.ts`.

1. **Multi-tab editor strip** above Monaco: open files as tabs (click in file tree opens a tab, ⌘W closes). Already partially present — formalize, persist open-tab order in state.
2. **Command palette** (⌘K): jump to file, switch language, run, toggle theme, open DB console. Uses existing `cmdk` (shadcn `Command`).
3. **Find & Replace**: enable Monaco's built-in `editor.action.startFindReplaceAction` via a toolbar button (Monaco already ships it; just expose a button on mobile where ⌘F is hard to type).
4. **Auto Save** indicator: existing autosave gets a visible "Saved · 2s ago" pill in the header.
5. **Dark / Light mode**: already in `themes.ts`. Add a top-bar toggle (was only in Settings drawer).
6. **Session restore**: already via localStorage; add a "Recent projects" picker in the Templates sheet.
7. **Performance**: lazy-load Monaco, Sandpack, PGlite, sql.js, JSZip via dynamic `import()` so first paint of `/playground` stays under ~150 KB JS.

## Phase 6 — Sharing & export polish

- Share link already works (base64 in `#share=`). Add a "Copy as Gist-style markdown" button for code projects.
- ZIP export already includes assets; add a `project.json` manifest so re-import is trivial later.

## Out of scope (explicitly not doing)

- OpenRouter integration (Lovable AI covers all AI actions key-free).
- Real Android/iOS emulation.
- Account-based cloud sync (would need Lovable Cloud + auth; ask if wanted later).

## Technical notes (for the implementer)

- New deps: `@codesandbox/sandpack-react`, `@electric-sql/pglite`. Both pure-JS / WASM, Worker-safe.
- Judge0 CE public endpoint is rate-limited; the fallback chain (judge0 → piston → wandbox) and the existing per-day usage counter cover this. Surface the active provider in `ExecutionStats`.
- `process.env`-style secrets are not required; everything in this plan is keyless.
- Every new module behind a dynamic `import()` so existing routes still build and ship if any single piece breaks.
- No edits to `src/integrations/supabase/*` or `src/routeTree.gen.ts`.

## Rollout order

1. Phase 1 (executors) — biggest user-visible win, no UI breakage risk.
2. Phase 5.1–5.4 (tabs, palette, autosave pill) — pure UX, low risk.
3. Phase 3 (Sandpack + React/TS templates).
4. Phase 4 (Mobile templates + banner).
5. Phase 2 (PGlite console).
6. Phase 6 (export polish).

Each phase ships independently; nothing in a later phase is required for an earlier one to work.
