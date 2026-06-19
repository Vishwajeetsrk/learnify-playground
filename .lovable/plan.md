## Mobile Playground IDE — Plan

The current `/playground/mobile` route crashes on SSR ("Element type is invalid"). I'll fix that first, then restructure the page into a real mobile IDE: themed editor + multi-file projects + live web preview + AI assistant suite.

The single 1,188-line route file is the source of most current issues (hard to maintain, mixes concerns, ships server-only paths into render). I will break it into focused modules under `src/components/playground/` and `src/lib/playground/` so we can iterate without regressions.

---

### 1. Fix the SSR crash

- Identify the bad element (likely a Radix re-export or a Monaco/dropdown render path running during SSR).
- Wrap Monaco editor and any browser-only widgets in `<ClientOnly>` with a fallback skeleton.
- Guard `localStorage`/`window` reads behind `useEffect` / `useHydrated`.
- Verify with a quick Playwright load against `/playground/mobile`.

### 2. Theme system + editor polish

- Add a `usePlaygroundTheme` hook persisted to localStorage with: **App theme** (Light / Dark / AMOLED) and **Editor theme** (VS Code Dark / Dracula / Monokai / GitHub Dark).
- Material-3-flavored top bar (segmented for: Project ▸ Save ▸ Run ▸ Share ▸ AI ▸ Settings) that survives narrow widths using the grid + `min-w-0` + `shrink-0` pattern.
- Quick toolbar above the keyboard with: Tab, `{ }`, `( )`, `;`, `=`, `<`, `>`, Undo, Redo, Save, Run, Fullscreen.
- Fullscreen editor toggle + landscape-friendly layout.

### 3. Multi-file projects + file explorer + templates

- New `playground_files` table (project_id, path, language, content) + grants + RLS scoped to the owning project.
- Migration runs on Lovable Cloud.
- VS Code-style left drawer: tree, create file/folder, rename, delete, duplicate, search.
- Tabs along the top of the editor with dirty indicator + middle-click close.
- Autosave every 10s (debounced) with a "Saved · 2s ago" indicator; restore unsaved work on reload via localStorage draft cache.
- One-tap starter templates: Calculator (HTML/JS), Todo, Login page, Chat UI, Notes, Expense Tracker, Python hello, Node hello, Java hello.

### 4. Live web preview system

- For HTML/CSS/JS projects, render a sandboxed `<iframe srcDoc>` preview that combines the project's `index.html` + `style.css` + `script.js`.
- Capture `console.log/info/warn/error` from inside the iframe via `postMessage` and render them in a Console panel.
- Viewport toggle: Mobile (375×667), Tablet (768×1024), Desktop (1280×800) with a zoom-to-fit transform.
- Auto-refresh on save (debounced 400ms).

### 5. AI assistant suite

- Drawer with five actions: **Explain**, **Fix Errors**, **Improve**, **Convert language** (target picker), **Generate from prompt**.
- Each action calls `debugCode` (extended) on the Lovable AI Gateway with a task-specific system prompt; streamed responses render as markdown with a one-tap "Apply to editor" button on returned code blocks.
- AI usage respects existing rate-limit + credit-exhausted error handling already in `ai.functions.ts`.

### 6. Out of scope for this pass (tracked, not built)

- ZIP import/export, Judge0 integration (we already have Wandbox + Piston which covers every listed language), full snippet library, learning guides, share links, cloud project sharing. I'll add stubs/empty states where the UI references them so they're easy to fill in next.

---

### Technical details

**New files**
- `src/components/playground/MobileTopBar.tsx`, `EditorPane.tsx`, `QuickKeyBar.tsx`, `FileExplorer.tsx`, `TabBar.tsx`, `WebPreview.tsx`, `ConsolePanel.tsx`, `AiAssistantSheet.tsx`, `SettingsSheet.tsx`, `PhoneFrame.tsx` (kept).
- `src/lib/playground/templates.ts` — starter project templates.
- `src/lib/playground/theme.ts` — theme tokens + hook.
- `src/lib/playground/web-bundle.ts` — combine HTML/CSS/JS + console bridge.
- `src/lib/playground-files.functions.ts` — CRUD server fns for files.
- Migration: `playground_files` table + GRANTs + RLS via `playground_projects` ownership.

**Routing**
- `/playground/mobile` becomes a shell that loads the active project + file tree, then renders `<MobileTopBar>`, `<TabBar>`, `<EditorPane>`, and a bottom sheet that switches between Preview / Console / Logcat / AI.

**SSR safety**
- All Monaco, iframe preview, localStorage reads, and `navigator.clipboard` calls go behind `<ClientOnly>` or `useEffect`.

**State**
- Single `useReducer` in the route for `{ project, files, activeFileId, dirty, draft }`.
- Theme + editor settings live in a separate Zustand-free `useSyncExternalStore` hook backed by localStorage.

This plan is large but each section ships independently. After approval I'll start with steps 1–2 in one batch (crash + theme/top bar), then steps 3–5.
