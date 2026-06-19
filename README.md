# Lovable Playground

A multi-track in-browser playground with a Monaco editor, live preview, code
runner, mobile starters, and an AI assistant. Built on TanStack Start + Vite +
React 19, with Lovable Cloud (Supabase) for auth, storage, and AI Gateway.

## Tracks

| Track | What it runs | Preview |
| --- | --- | --- |
| **Web** | HTML + CSS + JS | Sandboxed iframe with bridge shims for `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`, `caches`, `serviceWorker` |
| **Code** | Python / Node / Go / Rust / … via Piston | Run-log panel with stdout, stderr, timing, memory |
| **Mobile** | Android Kotlin · iOS Swift · Flutter · static-site PWA | Native projects export to ZIP; web-based mobile starters preview in iframe |

## Live preview features

- Split-view toggle (editors ↔ preview) with draggable resizer
- **Fit / Auto-fit** mode that scales the iframe to its content
- **Fullscreen** preview button
- **Reset Preview** restores the default split + Fit mode
- **Auto-reload** on every file change (`index.html`, `style.css`, `script.js`)
- **Persist toggle** keeps `localStorage` / `sessionStorage` snapshots across reloads
- **Errors panel** groups repeated runtime errors and parses script/line info
- **Auto-recovery** intercepts known sandbox `SecurityError`s and applies shims

## Sharing & autosave

- **Autosave** debounced to `localStorage` with a saved-status indicator
- **Share link** generates a read-only URL containing the project code, the
  persist toggle state, and the current preview-storage snapshot

## Smoke test

A one-click harness that loads every built-in template in a hidden sandboxed
iframe and reports failures. Open the templates sheet → **Smoke test**.

The summary panel shows:

- Total templates, pass rate, last-run timestamp
- Independent **Web vs Mobile** breakdown (passed / failed per platform)
- **Top error categories** — `Security / sandbox`, `Asset 404 / load`,
  `Syntax`, `Reference`, `Type`, `Network`, `Runtime`
- **Diff vs previous run** — which templates regressed, recovered, or newly
  started failing on specific assets / errors
- **Retry failed templates** reruns only the templates that errored or 404'd
  in the last run; results merge back into the existing summary
- **Platform filter** (`all` · `web` · `mobile`) scopes the per-template list

Native mobile templates (Kotlin / Swift / Flutter) can't execute in a browser
iframe, so they get a static sanity check (entry file present, file count > 0)
and are tagged `static` in the results.

## Project layout

```
src/
  routes/
    playground.ide.tsx        # main IDE shell (editor + preview + smoke test UI)
    playground.web.tsx        # web track entry
    playground.mobile.tsx     # mobile track entry
  lib/playground/
    web-bundle.ts             # iframe bridge, sandbox shims, preview doc builder
    smoke-test.ts             # smoke harness, summary, diff, categorize helpers
    templates.ts              # single-file web templates
    multi-templates.ts        # mobile + multi-file starters
    mobile-export.ts          # Android / iOS / Flutter ZIP exporters
```

## Development

```bash
bun install
bun run dev      # runs Vite + TanStack Start
```

Routing is file-based (`src/routes/`); `routeTree.gen.ts` is auto-generated —
don't edit it. Server logic lives in `*.functions.ts` modules called from
components, never in `src/server/`.
